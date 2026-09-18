/**
 * Helpers shared by the CLI adapters: process runner seam, npm-shim resolution, raw-log writing,
 * lenient JSON extraction and the failure taxonomy mapping.
 */
import { existsSync } from 'node:fs';
import { delimiter, isAbsolute, join, relative, resolve } from 'node:path';
import type { HarnessFailure } from '../core/enums.js';
import { writeFileRaw } from '../core/fsx.js';
import { type ProcessResult, runProcess } from '../core/proc.js';
import { type AgentTaskResult, RETRYABLE_FAILURES } from './types.js';

export interface RunOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
}
/** Injectable process runner (tests pass a fake that returns recorded stdout). */
export type Runner = (argv: readonly string[], opts: RunOptions) => Promise<ProcessResult>;
export const defaultRunner: Runner = (argv, opts) => runProcess(argv, opts);

export type ParsedOutput = Pick<AgentTaskResult, 'ok' | 'output' | 'failure' | 'usage' | 'model' | 'toolsUsed'>;

export function failure(cls: HarnessFailure, message: string): NonNullable<AgentTaskResult['failure']> {
  return { class: cls, message: message.slice(0, 2000), retryable: RETRYABLE_FAILURES.has(cls) };
}

export function failed(cls: HarnessFailure, message: string, extra: Partial<ParsedOutput> = {}): ParsedOutput {
  return { ok: false, output: null, failure: failure(cls, message), usage: null, model: null, toolsUsed: null, ...extra };
}

/** First `x.y.z` version token in CLI output, or null for garbage. */
export function parseVersion(text: string | null | undefined): string | null {
  const m = /(?<![\d.])(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)(?![\d.])/.exec(text ?? '');
  return m ? (m[1] ?? null) : null;
}

/** Long option names advertised in a `--help` text. */
export function scanFlags(help: string): string[] {
  return [...new Set(help.match(/--[a-z][a-z0-9-]*/g) ?? [])].sort();
}

/** Safe single path segment for log file names. */
export function sanitizeName(s: string): string {
  return (
    s
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^\.+/, '_')
      .slice(0, 120) || '_'
  );
}

export function writeRawLogs(logDir: string, taskId: string, stdout: string, stderr: string): string {
  const base = join(logDir, sanitizeName(taskId));
  writeFileRaw(`${base}.stdout`, stdout);
  writeFileRaw(`${base}.stderr`, stderr);
  return `${base}.stdout`;
}

/** Parses JSON, tolerating a Markdown code fence and surrounding prose. Returns undefined when impossible. */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim();
  const fence = /```(?:json)?\s*\n?([\s\S]*?)```/i.exec(t);
  for (const candidate of [t, fence?.[1]?.trim()]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next */
    }
  }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  return undefined;
}

/** Every line of `text` that parses as a JSON object (noise lines are skipped). */
export function jsonLines(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l.startsWith('{')) continue;
    try {
      const v = JSON.parse(l) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) out.push(v as Record<string, unknown>);
    } catch {
      /* noise or truncated line */
    }
  }
  return out;
}

export function classifyStatus(status: number | null | undefined): HarnessFailure | null {
  if (status === undefined || status === null) return null;
  if (status === 401 || status === 403) return 'authentication_failed';
  if (status === 402) return 'billing_error';
  if (status === 404) return 'model_not_found';
  if (status === 408) return 'timeout';
  if (status === 413 || status === 400 || status === 422) return 'invalid_request';
  if (status === 429) return 'rate_limit';
  if (status === 529) return 'overloaded';
  if (status >= 500) return 'server_error';
  return null;
}

const TEXT_RULES: [RegExp, HarnessFailure][] = [
  [
    /not logged in|please run \/login|\blogin required|authentication[_ ](error|failed)|invalid (api|x-api)[ -]key|oauth token|unauthori[sz]ed|\b401\b/i,
    'authentication_failed',
  ],
  [/credit balance|billing|insufficient[_ ]quota|payment required|\b402\b/i, 'billing_error'],
  [/overloaded|\b529\b|server is busy/i, 'overloaded'],
  [/rate[_ ]?limit|too many requests|usage limit|\b429\b/i, 'rate_limit'],
  [/model[_ ]not[_ ]found|unknown model|model .{0,80}(not found|does not exist|not supported|not available)|\b404\b/i, 'model_not_found'],
  [/max[_ ]?(output[_ ])?tokens|output token limit|context[_ ]length|context window/i, 'max_output_tokens'],
  [/timed? ?out|deadline exceeded|\b408\b/i, 'timeout'],
  [/invalid[_ ]request|bad request|\b400\b/i, 'invalid_request'],
  [/internal server error|server[_ ]error|api[_ ]error|bad gateway|service unavailable|\b50[0-4]\b/i, 'server_error'],
];

/** Maps free-form CLI/API error text to the failure taxonomy (null when nothing matches). */
export function classifyText(text: string): HarnessFailure | null {
  for (const [re, cls] of TEXT_RULES) if (re.test(text)) return cls;
  return null;
}

/** Process-level failures that pre-empt output parsing. */
export function processFailure(code: number | null, timedOut: boolean, spawnError: string | null): ParsedOutput | null {
  if (spawnError) return failed('unavailable', `Could not start agent CLI: ${spawnError}`);
  if (timedOut || code === 143) return failed('timeout', 'Agent process timed out and was terminated');
  return null;
}

/** Directories not inside `cwd` (deduplicated, order kept). */
export function outsideDirs(cwd: string, paths: readonly string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const rel = relative(resolve(cwd), resolve(p));
    const inside = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
    if (!inside && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * Resolves an npm-installed CLI to its real target so we avoid spawning through `cmd.exe` shims on Windows
 * (8191-char limit, quoting of JSON arguments). Returns null when the shim/target is not found on PATH.
 */
export function resolveNpmTarget(shimName: string, targetUnderNodeModules: string): string | null {
  const dirs = (process.env.PATH ?? process.env.Path ?? '').split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    const hasShim = [shimName, `${shimName}.cmd`].some((n) => existsSync(join(dir, n)));
    const target = join(dir, 'node_modules', targetUnderNodeModules);
    if (hasShim && existsSync(target)) return target;
  }
  return null;
}
