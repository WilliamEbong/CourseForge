/**
 * Runs one agent task through the selected harness: prompt assembly → harness.run → zod validation, with
 * bounded, classified retries (schema feedback retry, transient backoff). Also the write audit that
 * guarantees an agent cannot touch files outside what its plan allows.
 */
import { isAbsolute, join, resolve } from 'node:path';
import type { z } from 'zod';
import { STAGE_CODES } from '../core/enums.js';
import { CfError } from '../core/errors.js';
import { diffTrees, exists, hashTree, writeJson } from '../core/fsx.js';
import { COURSE_FILES, localStateDir, matchesPattern } from '../core/paths.js';
import { isSchemaName, SCHEMAS, type TaskSpec } from '../core/schemas/index.js';
import { toWireSchema } from '../core/wire-schema.js';
import { assemblePrompt } from '../harness/prompt.js';
import { type AgentTaskResult, RETRYABLE_FAILURES } from '../harness/types.js';
import { abs, type RunContext } from './context.js';
import { logEvent } from './store.js';

export interface TaskRunOptions {
  subject: string | null;
  subjectTitle?: string;
  cycle: number;
  /** Stage-specific JSON context for the `{{extra}}` template variable. */
  extra?: unknown;
  /** Extra input paths, repo-relative or absolute (in addition to the TaskSpec's). */
  inputs?: { path: string; description: string }[];
  instructions?: string;
  locks?: string[];
}

export interface TaskRunResult<T> {
  output: T;
  result: AgentTaskResult;
}

const AUDIT_EXCLUDE = ['logs/', '.lock', 'versions/'];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffScale(): number {
  const v = Number(process.env.COURSEFORGE_BACKOFF_SCALE ?? (process.env.COURSEFORGE_TEST ? '0' : '1'));
  return Number.isFinite(v) ? v : 1;
}

function wireSchemaPath(name: string): string {
  return join(localStateDir(), 'wire-schemas', `${name}.json`);
}

/** Plan paths are repo-relative (`<courseRelRoot>/<path>`); resolve against the repository root. */
export function repoPath(ctx: Pick<RunContext, 'repo'>, p: string): string {
  return isAbsolute(p) ? p : resolve(ctx.repo, p);
}

function schemaFor(name: string): z.ZodType {
  if (!isSchemaName(name)) throw new CfError('UNKNOWN_SCHEMA', `Unknown output schema "${name}"`, { exitCode: 2 });
  return SCHEMAS[name].schema;
}

function templateVars(ctx: RunContext, spec: TaskSpec, o: TaskRunOptions): Record<string, string> {
  const c = ctx.manifest.course;
  return {
    courseId: ctx.courseId,
    courseTitle: c.title,
    stage: ctx.stage ?? '',
    role: spec.role,
    subject: o.subject ?? '',
    subjectTitle: o.subjectTitle ?? '',
    audience: c.audience ?? 'Not specified',
    language: c.language,
    riskTier: c.risk_tier,
    jurisdiction: c.jurisdiction ?? 'Not specified',
    durationMinutes: String(c.target_duration_minutes ?? 'Not specified'),
    cycle: String(o.cycle),
    instructions: o.instructions?.trim() ? o.instructions : 'None',
    extra: o.extra === undefined ? '{}' : JSON.stringify(o.extra, null, 2),
    locks: o.locks?.length ? o.locks.join(', ') : 'none',
  };
}

/** Runs a task and returns its schema-validated output. Throws CfError(kind=<failure class>) on failure. */
export async function runAgentTask<T>(ctx: RunContext, spec: TaskSpec, o: TaskRunOptions): Promise<TaskRunResult<T>> {
  const schema = schemaFor(spec.outputSchema) as z.ZodType<T>;
  const wire = toWireSchema(schema);
  const schemaPath = wireSchemaPath(spec.outputSchema);
  if (!exists(schemaPath)) writeJson(schemaPath, wire);

  const inputs = [...spec.inputPaths.map((p) => ({ path: p, description: 'stage input' })), ...(o.inputs ?? [])]
    .filter((x, i, arr) => arr.findIndex((y) => y.path === x.path) === i)
    .map((x) => ({ path: repoPath(ctx, x.path), description: x.description }))
    .filter((x) => exists(x.path));

  const assembled = assemblePrompt({
    role: spec.role,
    promptTemplate: spec.promptTemplate,
    vars: templateVars(ctx, spec, o),
    skills: spec.skills,
    rubric: spec.rubric,
    inputs,
    outputSchemaName: spec.outputSchema,
    writeMode: spec.writeMode,
    repoRoot: ctx.repo,
  });

  const taskId = `${spec.taskId}${o.subject ? `:${o.subject}` : ''}:c${o.cycle}`;
  const procCfg = ctx.registries.fallbacks.process;
  const maxAttempts = 1 + procCfg.retries;
  let schemaRetries = ctx.registries.fallbacks.schemaRetries;
  let prompt = assembled.prompt;
  let attempt = 0;
  let last: AgentTaskResult | null = null;

  while (attempt < maxAttempts + schemaRetries) {
    attempt++;
    const started = Date.now();
    logEvent(ctx.dir, {
      ts: ctx.now(),
      runId: ctx.runId,
      stage: ctx.stage,
      event: 'task.start',
      step: taskId,
      detail: { role: spec.role, subject: o.subject, attempt, backend: ctx.harnessName },
    });
    const result = await ctx.harness.run({
      taskId,
      runId: ctx.runId,
      planId: null,
      courseId: ctx.courseId,
      stage: ctx.stage ?? 'CONCEPT',
      role: spec.role,
      promptTemplate: spec.promptTemplate,
      subject: o.subject,
      cycle: o.cycle,
      prompt,
      systemPreamble: assembled.systemPreamble,
      cwd: ctx.repo,
      readOnlyPaths: [ctx.dir],
      writablePaths: spec.writablePaths.map((p) => repoPath(ctx, p.replace(/\/\*\*$/, ''))),
      agentTools: spec.agentTools,
      outputSchemaName: spec.outputSchema,
      outputSchema: wire,
      outputSchemaPath: schemaPath,
      writeMode: spec.writeMode,
      network: spec.network,
      timeoutSec: spec.timeoutSec,
      maxTurns: spec.maxTurns,
      logDir: abs(ctx, COURSE_FILES.tasks),
    });
    last = result;
    const durationMs = Date.now() - started;
    if (result.ok) {
      const parsed = schema.safeParse(result.output);
      if (parsed.success) {
        logEvent(ctx.dir, {
          ts: ctx.now(),
          runId: ctx.runId,
          stage: ctx.stage,
          event: 'task.end',
          step: taskId,
          status: 'ok',
          durationMs,
          detail: { backend: result.backend, version: result.backendVersion, usage: result.usage },
        });
        return { output: parsed.data, result };
      }
      const issues = parsed.error.issues.slice(0, 15).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
      logEvent(ctx.dir, {
        ts: ctx.now(),
        runId: ctx.runId,
        stage: ctx.stage,
        event: 'task.end',
        step: taskId,
        status: 'schema_invalid',
        durationMs,
        detail: { issues },
      });
      if (schemaRetries > 0) {
        schemaRetries--;
        prompt = `${assembled.prompt}\n\n## Correction required\nYour previous response did not validate against schema "${spec.outputSchema}":\n- ${issues.join('\n- ')}\nReturn a corrected, complete JSON object.`;
        continue;
      }
      throw new CfError(
        'AGENT_SCHEMA_INVALID',
        `${spec.role}${o.subject ? `/${o.subject}` : ''} returned output that does not match ${spec.outputSchema}: ${issues.join('; ')}`,
        {
          kind: 'schema_invalid',
          detail: { taskId, issues },
        },
      );
    }
    const failure = result.failure ?? { class: 'unknown' as const, message: 'unknown failure', retryable: false };
    logEvent(ctx.dir, {
      ts: ctx.now(),
      runId: ctx.runId,
      stage: ctx.stage,
      event: 'task.end',
      step: taskId,
      status: failure.class,
      durationMs,
      detail: { message: failure.message.slice(0, 500) },
    });
    if (RETRYABLE_FAILURES.has(failure.class) && attempt < maxAttempts) {
      const wait = (procCfg.backoffMs[attempt - 1] ?? procCfg.backoffMs.at(-1) ?? 2000) * backoffScale();
      if (wait > 0) await sleep(wait);
      continue;
    }
    throw new CfError('AGENT_FAILED', `${spec.role}${o.subject ? `/${o.subject}` : ''} failed (${failure.class}): ${failure.message}`, {
      kind: failure.class,
      detail: { taskId, rawLog: result.rawLogPath },
    });
  }
  throw new CfError('AGENT_FAILED', `${spec.role} exhausted retries`, { kind: last?.failure?.class ?? 'unknown' });
}

/** Task ID helper so plan TaskSpecs and logs line up. */
export function stageTaskPrefix(runId: string, stage: keyof typeof STAGE_CODES): string {
  return `${runId}:${STAGE_CODES[stage]}`;
}

/* ------------------------------------------------------------------ write audit */

export interface AuditSnapshot {
  tree: Map<string, string>;
}

export function auditBefore(ctx: RunContext): AuditSnapshot {
  return { tree: hashTree(ctx.dir, AUDIT_EXCLUDE) };
}

/**
 * Returns course-relative paths changed since `before` that are NOT allowed by `allowed` patterns.
 * For structured / findings-only agent work, `allowed` is empty: agents must not write at all.
 */
export function auditViolations(ctx: RunContext, before: AuditSnapshot, allowed: readonly string[]): string[] {
  const d = diffTrees(before.tree, hashTree(ctx.dir, AUDIT_EXCLUDE));
  const changed = [...d.added, ...d.changed, ...d.removed];
  return changed.filter((p) => !allowed.some((pat) => matchesPattern(p, pat.replace(/^\{course\}\//, ''))));
}
