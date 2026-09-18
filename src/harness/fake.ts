/**
 * Deterministic fixture harness for tests and offline demos (`COURSEFORGE_HARNESS=fake`).
 *
 * Lookup for a request (subject sanitised for filenames), first hit wins:
 *   <dir>/<promptTemplate>/<subject>.c<cycle>.json → <subject>.json → default.c<cycle>.json → default.json
 * Envelope: { output, failure?: {class, message}, delayMs?, files?: {"<path>": "<content>"} }.
 * `files` are written exactly where told (relative paths resolve against the first writable path, else cwd);
 * the pipeline's write audit is what catches violations.
 */
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { HarnessFailureSchema } from '../core/enums.js';
import { readJson, writeFileRaw } from '../core/fsx.js';
import { sha256 } from '../core/hash.js';
import { failure, sanitizeName } from './shared.js';
import type { AgentHarness, AgentTaskRequest, AgentTaskResult, HarnessProbe } from './types.js';

export const FakeResponseSchema = z.object({
  output: z.unknown().optional(),
  failure: z.object({ class: HarnessFailureSchema, message: z.string() }).nullish(),
  delayMs: z.number().int().min(0).optional(),
  files: z.record(z.string(), z.string()).optional(),
});
export type FakeResponse = z.infer<typeof FakeResponseSchema>;

/** `fail` | `fail:<class>` | `invalid-json` | `timeout` | `slow:<ms>`. */
export type FakeMode = string;

export interface FakeHarnessOptions {
  fixturesDir?: string;
  responder?: (req: AgentTaskRequest) => FakeResponse | Promise<FakeResponse>;
  mode?: FakeMode;
}

export interface FakeCall {
  taskId: string;
  role: string;
  subject: string | null;
  cycle: number;
  promptTemplate: string;
  startedAt: number;
  endedAt: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function fixtureCandidates(dir: string, req: Pick<AgentTaskRequest, 'promptTemplate' | 'subject' | 'cycle'>): string[] {
  const base = join(dir, sanitizeName(req.promptTemplate));
  const names = req.subject ? [`${sanitizeName(req.subject)}.c${req.cycle}.json`, `${sanitizeName(req.subject)}.json`] : [];
  names.push(`default.c${req.cycle}.json`, 'default.json');
  return names.map((n) => join(base, n));
}

export class FakeHarness implements AgentHarness {
  readonly name = 'fake' as const;
  readonly calls: FakeCall[] = [];
  constructor(private readonly opts: FakeHarnessOptions = {}) {}

  async probe(): Promise<HarnessProbe> {
    return { name: 'fake', available: true, version: 'fake-1', authenticated: true, flags: [], detail: 'fixture harness' };
  }

  async run(req: AgentTaskRequest): Promise<AgentTaskResult> {
    const startedAt = Date.now();
    const result = (ok: boolean, output: unknown, fail: AgentTaskResult['failure']): AgentTaskResult => {
      const endedAt = Date.now();
      this.calls.push({
        taskId: req.taskId,
        role: req.role,
        subject: req.subject,
        cycle: req.cycle,
        promptTemplate: req.promptTemplate,
        startedAt,
        endedAt,
      });
      return {
        ok,
        output,
        failure: fail,
        backend: 'fake',
        backendVersion: 'fake-1',
        model: 'fake',
        usage: null,
        durationMs: endedAt - startedAt,
        toolsUsed: null,
        promptHash: sha256(req.prompt),
        rawLogPath: null,
      };
    };

    const mode = this.opts.mode ?? process.env.COURSEFORGE_FAKE_MODE ?? '';
    if (mode === 'fail' || mode.startsWith('fail:')) {
      const cls = HarnessFailureSchema.catch('process_error').parse(mode.slice(5) || 'process_error');
      return result(false, null, failure(cls, `fake harness mode ${mode}`));
    }
    if (mode === 'timeout') return result(false, null, failure('timeout', 'fake harness mode timeout'));
    if (mode === 'invalid-json') return result(true, '{"truncated": ', null);
    const slow = /^slow:(\d+)$/.exec(mode);
    if (slow) await sleep(Number(slow[1]));

    let response: FakeResponse;
    if (this.opts.responder) {
      response = FakeResponseSchema.parse(await this.opts.responder(req));
    } else {
      const dir = this.opts.fixturesDir ?? process.env.COURSEFORGE_FIXTURES;
      const candidates = dir ? fixtureCandidates(dir, req) : [];
      const hit = candidates.find((p) => existsSync(p));
      if (!hit) {
        const where = dir ? candidates.join(', ') : '(no fixtures dir: set fixturesDir or COURSEFORGE_FIXTURES)';
        return result(false, null, failure('invalid_request', `fake harness: no fixture for ${req.taskId}; expected one of ${where}`));
      }
      response = readJson(hit, FakeResponseSchema);
    }

    if (response.delayMs) await sleep(response.delayMs);
    const root = req.writablePaths[0] ?? req.cwd;
    for (const [p, content] of Object.entries(response.files ?? {})) writeFileRaw(isAbsolute(p) ? p : resolve(root, p), content);
    if (response.failure) return result(false, null, failure(response.failure.class, response.failure.message));
    return result(true, response.output ?? null, null);
  }
}
