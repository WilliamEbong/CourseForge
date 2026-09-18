/**
 * Claude Code adapter: `claude -p` in stream-json mode, prompt on stdin, schema inline via `--json-schema`.
 *
 * Isolation from user-global configuration is done with flags only (never CLAUDE_CONFIG_DIR, which would
 * break OAuth): `--safe-mode` (no CLAUDE.md, plugins, hooks, output styles, MCP) + `--setting-sources project`
 * + `--strict-mcp-config`. `--bare` is NOT used: it disables OAuth/keychain auth. Verified live on 2.1.258:
 * the init event reports `plugins: []`, `mcp_servers: []`, `output_style: "default"` under these flags.
 *
 * All modes run with `--permission-mode dontAsk` (anything not pre-approved is denied, never prompted);
 * artifact-write tasks get `--settings` allow rules for Edit (which also governs Write) on their writable
 * paths only. The hard guarantee is still the pipeline's `guarded()` hash audit.
 */
import { platform } from 'node:os';
import { join } from 'node:path';
import { HARNESS_FAILURES, type HarnessFailure } from '../core/enums.js';
import { sha256 } from '../core/hash.js';
import {
  classifyStatus,
  classifyText,
  defaultRunner,
  failed,
  jsonLines,
  outsideDirs,
  type ParsedOutput,
  parseJsonLoose,
  parseVersion,
  processFailure,
  type Runner,
  resolveNpmTarget,
  scanFlags,
  writeRawLogs,
} from './shared.js';
import type { AgentHarness, AgentTaskRequest, AgentTaskResult, AgentUsage, HarnessProbe } from './types.js';

const NETWORK_TOOLS = new Set(['WebSearch', 'WebFetch']);
/** Accepted by 2.1.x but hidden from `--help`. */
const HIDDEN_FLAGS = ['--max-turns'];

export interface ClaudeHarnessOptions {
  runner?: Runner;
  /** argv prefix used to invoke the CLI (default: resolved native exe, else `claude`). */
  command?: string[];
}

export function resolveClaudeCommand(): string[] {
  if (platform() === 'win32') {
    const exe = resolveNpmTarget('claude', join('@anthropic-ai', 'claude-code', 'bin', 'claude.exe'));
    if (exe) return [exe];
  }
  return ['claude'];
}

/** `C:\a\b` → `//c/a/b` (Claude permission rules use POSIX-normalised absolute paths with a `//` anchor). */
export function toRulePath(abs: string): string {
  const posix = abs.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
  return `/${posix.startsWith('/') ? posix : `/${posix}`}`.replace(/\/+$/, '');
}

/** Pure: request + probed flags → argv (without the executable). The prompt is never in argv. */
export function buildClaudeArgv(req: AgentTaskRequest, probe: Pick<HarnessProbe, 'flags'>): string[] {
  const known = new Set([...probe.flags, ...HIDDEN_FLAGS]);
  const has = (f: string) => probe.flags.length === 0 || known.has(f);
  const argv = ['-p', '--output-format', 'stream-json', '--verbose'];
  if (has('--safe-mode')) argv.push('--safe-mode');
  if (has('--setting-sources')) argv.push('--setting-sources', 'project');
  if (has('--strict-mcp-config')) argv.push('--strict-mcp-config');
  argv.push('--permission-mode', 'dontAsk');

  const write = req.writeMode === 'artifact-write';
  const tools = req.agentTools.filter(
    (t) => (req.network || !NETWORK_TOOLS.has(t)) && (write || (t !== 'Write' && t !== 'Edit' && t !== 'NotebookEdit')),
  );
  argv.push('--tools', tools.join(','));

  const allow: string[] = [];
  if (write) {
    for (const p of req.writablePaths) {
      const r = toRulePath(p);
      allow.push(`Edit(${r})`, `Edit(${r}/**)`);
    }
  }
  if (req.network) allow.push(...tools.filter((t) => NETWORK_TOOLS.has(t)));
  if (allow.length && has('--settings')) argv.push('--settings', JSON.stringify({ permissions: { allow } }));

  const addDirs = outsideDirs(req.cwd, [...req.readOnlyPaths, ...(write ? req.writablePaths : [])]);
  if (addDirs.length && has('--add-dir')) argv.push('--add-dir', ...addDirs);

  if (Object.keys(req.outputSchema).length && has('--json-schema')) argv.push('--json-schema', JSON.stringify(req.outputSchema));
  if (req.systemPreamble && has('--append-system-prompt')) argv.push('--append-system-prompt', req.systemPreamble);
  // Structured output itself consumes a turn, so never go below 2.
  if (req.maxTurns > 0 && has('--max-turns')) argv.push('--max-turns', String(Math.max(2, req.maxTurns)));
  if (has('--no-session-persistence')) argv.push('--no-session-persistence');
  return argv;
}

/** `system/api_retry.error` is already a category close to ours. */
function retryCategory(error: string): HarnessFailure | null {
  if (['oauth_org_not_allowed', 'account_on_hold', 'cloud_credential_error'].includes(error)) return 'authentication_failed';
  if (error === 'unknown') return null;
  return (HARNESS_FAILURES as readonly string[]).includes(error) ? (error as HarnessFailure) : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function usageOf(result: Record<string, unknown>): AgentUsage | null {
  const u = result.usage as Record<string, unknown> | undefined;
  const cost = num(result.total_cost_usd);
  if (!u && cost === null) return null;
  const input = u ? (num(u.input_tokens) ?? 0) + (num(u.cache_read_input_tokens) ?? 0) + (num(u.cache_creation_input_tokens) ?? 0) : null;
  return { inputTokens: input, outputTokens: u ? num(u.output_tokens) : null, costUsd: cost };
}

/** Parses `--output-format json` or `stream-json` stdout (noise lines tolerated). */
export function parseClaudeOutput(
  stdout: string,
  stderr: string,
  code: number | null,
  timedOut: boolean,
  spawnError: string | null = null,
): ParsedOutput {
  const pre = processFailure(code, timedOut, spawnError);
  if (pre) return pre;

  const events = jsonLines(stdout);
  let model: string | null = null;
  const tools = new Set<string>();
  let lastRetry: Record<string, unknown> | null = null;
  let result: Record<string, unknown> | null = null;
  for (const ev of events) {
    if (ev.type === 'system' && ev.subtype === 'init' && typeof ev.model === 'string') model = ev.model;
    if (ev.type === 'system' && ev.subtype === 'api_retry') lastRetry = ev;
    if (ev.type === 'assistant') {
      const msg = ev.message as { model?: unknown; content?: unknown } | undefined;
      if (typeof msg?.model === 'string') model = msg.model;
      if (Array.isArray(msg?.content)) {
        for (const c of msg.content as Record<string, unknown>[]) {
          if (c.type === 'tool_use' && typeof c.name === 'string' && c.name !== 'StructuredOutput') tools.add(c.name);
        }
      }
    }
    if (ev.type === 'result') result = ev;
  }
  if (result?.modelUsage && typeof result.modelUsage === 'object') {
    const first = Object.keys(result.modelUsage as object)[0];
    if (first) model = first;
  }
  const toolsUsed = events.length ? [...tools].sort() : null;

  if (!result) {
    if (lastRetry) {
      const status = num(lastRetry.error_status);
      const text = String(lastRetry.error ?? '');
      const cls = retryCategory(text) ?? classifyStatus(status) ?? classifyText(text) ?? 'process_error';
      return failed(cls, `Claude ended after API retries without a result (${text || status})`, { model, toolsUsed });
    }
    // Only classify stderr and non-JSON stdout lines: event payloads may quote arbitrary file content.
    const plain = stdout
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('{'))
      .join('\n');
    const text = `${stderr}\n${plain}`.trim();
    const cls = classifyText(text);
    if (cls) return failed(cls, text.slice(0, 500), { model, toolsUsed });
    return failed('process_error', `No result event in Claude output (exit ${code})${text ? `: ${text.slice(0, 300)}` : ''}`, {
      model,
      toolsUsed,
    });
  }

  const usage = usageOf(result);
  const resultText = typeof result.result === 'string' ? result.result : '';
  const subtype = String(result.subtype ?? '');
  if (result.is_error === true || (subtype && subtype !== 'success')) {
    const errors = Array.isArray(result.errors) ? (result.errors as unknown[]).map(String).join('; ') : '';
    const message = [subtype, resultText, errors].filter(Boolean).join(': ') || 'Claude reported an error';
    let cls = classifyStatus(num(result.api_error_status)) ?? classifyText(`${resultText} ${errors}`);
    if (!cls) cls = subtype === 'error_max_structured_output_retries' ? 'schema_invalid' : 'unknown';
    return { ...failed(cls, message), usage, model, toolsUsed };
  }

  let output: unknown = result.structured_output;
  if (output === undefined || output === null) {
    const parsed = parseJsonLoose(resultText);
    output = parsed === undefined ? resultText : parsed;
  }
  return { ok: true, output, failure: null, usage, model, toolsUsed };
}

export class ClaudeHarness implements AgentHarness {
  readonly name = 'claude' as const;
  private readonly runner: Runner;
  private readonly command: string[];
  private probed: Promise<HarnessProbe> | null = null;

  constructor(opts: ClaudeHarnessOptions = {}) {
    this.runner = opts.runner ?? defaultRunner;
    this.command = opts.command ?? resolveClaudeCommand();
  }

  probe(): Promise<HarnessProbe> {
    this.probed ??= this.doProbe();
    return this.probed;
  }

  private async doProbe(): Promise<HarnessProbe> {
    const run = (args: string[]) => this.runner([...this.command, ...args], { timeoutMs: 30_000 });
    const ver = await run(['--version']);
    const version = ver.spawnError || ver.code !== 0 ? null : parseVersion(ver.stdout || ver.stderr);
    if (!version) {
      return {
        name: 'claude',
        available: false,
        version: null,
        authenticated: 'unknown',
        flags: [],
        detail: ver.spawnError ?? `claude --version failed (exit ${ver.code}): ${(ver.stderr || ver.stdout).trim().slice(0, 200)}`,
      };
    }
    const [help, auth] = await Promise.all([run(['--help']), run(['auth', 'status', '--json'])]);
    let authenticated: boolean | 'unknown' = 'unknown';
    const authJson = parseJsonLoose(auth.stdout) as { loggedIn?: unknown } | undefined;
    if (typeof authJson?.loggedIn === 'boolean') authenticated = authJson.loggedIn;
    return {
      name: 'claude',
      available: true,
      version,
      authenticated,
      flags: scanFlags(help.stdout),
      detail: authenticated === false ? 'claude CLI found but not logged in (run `claude` and /login)' : 'ok',
    };
  }

  async run(req: AgentTaskRequest): Promise<AgentTaskResult> {
    const probe = await this.probe();
    const promptHash = sha256(req.prompt);
    const base = { backend: 'claude' as const, backendVersion: probe.version, promptHash };
    if (!probe.available) {
      return { ...base, ...failed('unavailable', probe.detail), durationMs: 0, rawLogPath: null };
    }
    const argv = [...this.command, ...buildClaudeArgv(req, probe)];
    const res = await this.runner(argv, { cwd: req.cwd, stdin: req.prompt, timeoutMs: req.timeoutSec * 1000 });
    const rawLogPath = writeRawLogs(req.logDir, req.taskId, res.stdout, res.stderr);
    const parsed = parseClaudeOutput(res.stdout, res.stderr, res.code, res.timedOut, res.spawnError);
    return { ...base, ...parsed, durationMs: res.durationMs, rawLogPath };
  }
}
