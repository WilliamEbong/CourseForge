/**
 * Codex adapter: `codex exec --json … -` with the prompt on stdin, schema from a file (`--output-schema`)
 * and the final message captured with `-o`. A missing `-o` file is a hard failure.
 *
 * Isolation: `--ignore-user-config --ignore-rules` skip `~/.codex/config.toml` and execpolicy rules.
 * The global `~/.codex/AGENTS.md` CANNOT be disabled by any flag in 0.144 (it is loaded unconditionally as
 * user instructions), so the role preamble is injected as `developer_instructions` and tells the agent to
 * ignore unrelated user-level instructions. No `danger-full-access`, no approval bypass, ever.
 *
 * Sandbox: `read-only` unless artifact-write, then `workspace-write` with `-C <repo>` + `--add-dir` for
 * writable roots outside it. The OS sandbox therefore permits the whole repo; the pipeline's `guarded()`
 * audit is what confines writes to the task's writable paths.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, exists, writeJson } from '../core/fsx.js';
import { sha256 } from '../core/hash.js';
import {
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
  sanitizeName,
  scanFlags,
  writeRawLogs,
} from './shared.js';
import type { AgentHarness, AgentTaskRequest, AgentTaskResult, AgentUsage, HarnessProbe } from './types.js';

export interface CodexHarnessOptions {
  runner?: Runner;
  /** argv prefix used to invoke the CLI (default: `node <codex.js>` when resolvable, else `codex`). */
  command?: string[];
}

export function resolveCodexCommand(): string[] {
  const script = resolveNpmTarget('codex', join('@openai', 'codex', 'bin', 'codex.js'));
  return script ? [process.execPath, script] : ['codex'];
}

export function codexLastMessagePath(req: Pick<AgentTaskRequest, 'logDir' | 'taskId'>): string {
  return join(req.logDir, `${sanitizeName(req.taskId)}.last.json`);
}

/** Pure: request + probed flags → argv (without the executable). The prompt is read from stdin (`-`). */
export function buildCodexArgv(req: AgentTaskRequest, probe: Pick<HarnessProbe, 'flags'>): string[] {
  const has = (f: string) => probe.flags.length === 0 || probe.flags.includes(f);
  const write = req.writeMode === 'artifact-write';
  const argv = ['exec', '--json'];
  if (has('--ignore-user-config')) argv.push('--ignore-user-config');
  if (has('--ignore-rules')) argv.push('--ignore-rules');
  if (has('--skip-git-repo-check')) argv.push('--skip-git-repo-check');
  if (has('--ephemeral')) argv.push('--ephemeral');
  argv.push('-C', req.cwd, '-s', write ? 'workspace-write' : 'read-only');
  argv.push('-c', 'approval_policy="never"');
  argv.push('-c', `web_search="${req.network ? 'live' : 'disabled'}"`);
  if (write && req.network) argv.push('-c', 'sandbox_workspace_write.network_access=true');
  if (req.systemPreamble) argv.push('-c', `developer_instructions=${JSON.stringify(req.systemPreamble)}`);
  if (write && has('--add-dir')) for (const d of outsideDirs(req.cwd, req.writablePaths)) argv.push('--add-dir', d);
  argv.push('--output-schema', req.outputSchemaPath, '-o', codexLastMessagePath(req), '-');
  return argv;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function errorText(ev: Record<string, unknown>): string {
  if (typeof ev.message === 'string') return ev.message;
  const e = ev.error as Record<string, unknown> | string | undefined;
  if (typeof e === 'string') return e;
  if (e && typeof e.message === 'string') return e.message;
  return JSON.stringify(ev).slice(0, 500);
}

/** Parses `codex exec --json` JSONL plus the `-o` file contents (null when the file is missing). */
export function parseCodexOutput(
  stdout: string,
  stderr: string,
  code: number | null,
  timedOut: boolean,
  lastMessage: string | null,
  spawnError: string | null = null,
): ParsedOutput {
  const pre = processFailure(code, timedOut, spawnError);
  if (pre) return pre;

  const events = jsonLines(stdout);
  const tools = new Set<string>();
  const errors: string[] = [];
  let turnFailed = false;
  let usage: AgentUsage | null = null;
  let model: string | null = null;
  for (const ev of events) {
    if (typeof ev.model === 'string') model = ev.model;
    if (ev.type === 'error') errors.push(errorText(ev));
    if (ev.type === 'turn.failed') {
      turnFailed = true;
      errors.push(errorText(ev));
    }
    if (ev.type === 'turn.completed' && ev.usage && typeof ev.usage === 'object') {
      const u = ev.usage as Record<string, unknown>;
      const prev: AgentUsage = usage ?? { inputTokens: 0, outputTokens: 0, costUsd: null };
      usage = {
        inputTokens: (prev.inputTokens ?? 0) + (num(u.input_tokens) ?? 0),
        outputTokens: (prev.outputTokens ?? 0) + (num(u.output_tokens) ?? 0),
        costUsd: null,
      };
    }
    const item = ev.item as Record<string, unknown> | undefined;
    if (ev.type === 'item.completed' && item && typeof item.type === 'string' && !['agent_message', 'reasoning'].includes(item.type)) {
      tools.add(item.type);
    }
  }
  const toolsUsed = events.length ? [...tools].sort() : null;
  const extra = { usage, model, toolsUsed };

  if (turnFailed || (errors.length && lastMessage === null)) {
    const msg = errors.join('; ') || 'Codex turn failed';
    return failed(classifyText(msg) ?? 'unknown', msg, extra);
  }
  if (lastMessage === null) {
    const text = `${stderr}\n${stdout}`.trim();
    if (code !== 0) {
      const cls = classifyText(stderr) ?? 'process_error';
      return failed(cls, `codex exited ${code}: ${text.slice(-500)}`, extra);
    }
    return failed('process_error', 'codex produced no -o output file', extra);
  }
  const parsed = parseJsonLoose(lastMessage);
  return { ok: true, output: parsed === undefined ? lastMessage : parsed, failure: null, ...extra };
}

export class CodexHarness implements AgentHarness {
  readonly name = 'codex' as const;
  private readonly runner: Runner;
  private readonly command: string[];
  private probed: Promise<HarnessProbe> | null = null;

  constructor(opts: CodexHarnessOptions = {}) {
    this.runner = opts.runner ?? defaultRunner;
    this.command = opts.command ?? resolveCodexCommand();
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
        name: 'codex',
        available: false,
        version: null,
        authenticated: 'unknown',
        flags: [],
        detail: ver.spawnError ?? `codex --version failed (exit ${ver.code}): ${(ver.stderr || ver.stdout).trim().slice(0, 200)}`,
      };
    }
    const [help, login] = await Promise.all([run(['exec', '--help']), run(['login', 'status'])]);
    const loginText = `${login.stdout}\n${login.stderr}`;
    let authenticated: boolean | 'unknown' = 'unknown';
    if (login.code === 0 && /logged in/i.test(loginText) && !/not logged in/i.test(loginText)) authenticated = true;
    else if (/not logged in/i.test(loginText)) authenticated = false;
    return {
      name: 'codex',
      available: true,
      version,
      authenticated,
      flags: scanFlags(help.stdout),
      detail: authenticated === false ? 'codex CLI found but not logged in (run `codex login`)' : 'ok',
    };
  }

  async run(req: AgentTaskRequest): Promise<AgentTaskResult> {
    const probe = await this.probe();
    const promptHash = sha256(req.prompt);
    const base = { backend: 'codex' as const, backendVersion: probe.version, promptHash };
    if (!probe.available) return { ...base, ...failed('unavailable', probe.detail), durationMs: 0, rawLogPath: null };

    if (!exists(req.outputSchemaPath)) writeJson(req.outputSchemaPath, req.outputSchema);
    const lastPath = codexLastMessagePath(req);
    ensureDir(req.logDir);
    rmSync(lastPath, { force: true });
    const argv = [...this.command, ...buildCodexArgv(req, probe)];
    const res = await this.runner(argv, { cwd: req.cwd, stdin: req.prompt, timeoutMs: req.timeoutSec * 1000 });
    const rawLogPath = writeRawLogs(req.logDir, req.taskId, res.stdout, res.stderr);
    const last = existsSync(lastPath) ? readFileSync(lastPath, 'utf8').trim() || null : null;
    const parsed = parseCodexOutput(res.stdout, res.stderr, res.code, res.timedOut, last, res.spawnError);
    return { ...base, ...parsed, durationMs: res.durationMs, rawLogPath };
  }
}
