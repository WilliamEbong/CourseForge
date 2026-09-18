/**
 * `courseforge doctor --live`: one tiny structured task per available, authenticated backend. Proves the
 * adapter works end to end and that user-global instructions/output styles do not leak into CourseForge tasks
 * (the reply must be exactly the requested JSON). Costs one small model call per backend; never run implicitly.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BACKENDS, type BackendName } from '../core/enums.js';
import { writeJson } from '../core/fsx.js';
import { createHarness, probeAll } from '../harness/factory.js';

export interface CanaryResult {
  backend: BackendName;
  ok: boolean;
  detail: string;
  durationMs: number;
}

const SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, word: { type: 'string' } },
  required: ['ok', 'word'],
  additionalProperties: false,
} as const;

export async function runCanary(repo: string): Promise<CanaryResult[]> {
  const probes = await probeAll();
  const dir = mkdtempSync(join(tmpdir(), 'cf-canary-'));
  const schemaPath = join(dir, 'canary.schema.json');
  writeJson(schemaPath, SCHEMA);
  const out: CanaryResult[] = [];
  for (const backend of BACKENDS) {
    const p = probes[backend];
    if (!p.available || p.authenticated === false) {
      out.push({ backend, ok: false, detail: p.available ? 'not authenticated' : 'not installed', durationMs: 0 });
      continue;
    }
    const res = await createHarness(backend).run({
      taskId: `canary-${backend}`,
      runId: 'canary',
      planId: null,
      courseId: 'canary',
      stage: 'CONCEPT',
      role: 'canary',
      promptTemplate: 'canary',
      subject: null,
      cycle: 0,
      prompt: 'This is a CourseForge environment check. Return {"ok": true, "word": "courseforge"} exactly — no other text.',
      systemPreamble: 'You are a CourseForge environment canary. Follow only this prompt. Output must match the JSON schema.',
      cwd: repo,
      readOnlyPaths: [],
      writablePaths: [],
      agentTools: [],
      outputSchemaName: 'canary',
      outputSchema: SCHEMA as unknown as Record<string, unknown>,
      outputSchemaPath: schemaPath,
      writeMode: 'structured',
      network: false,
      timeoutSec: 180,
      maxTurns: 2,
      logDir: dir,
    });
    const o = res.output as { ok?: unknown; word?: unknown } | null;
    const clean = res.ok && o?.ok === true && o.word === 'courseforge';
    out.push({
      backend,
      ok: clean,
      detail: clean
        ? `schema-valid isolated reply (${res.backendVersion ?? 'unknown version'})`
        : res.failure
          ? `${res.failure.class}: ${res.failure.message.slice(0, 160)}`
          : `unexpected reply: ${JSON.stringify(res.output).slice(0, 160)}`,
      durationMs: res.durationMs,
    });
  }
  return out;
}
