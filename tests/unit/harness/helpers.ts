import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessResult } from '../../../src/core/proc.js';
import type { Runner, RunOptions } from '../../../src/harness/shared.js';
import type { AgentTaskRequest } from '../../../src/harness/types.js';

export const tmp = (prefix = 'cf-harness-') => mkdtempSync(join(tmpdir(), prefix));

export const RAW = join(import.meta.dirname, '..', '..', 'fixtures', 'harness-raw');
export const raw = (rel: string) => readFileSync(join(RAW, rel), 'utf8');

export const SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, note: { type: 'string' } },
  required: ['ok', 'note'],
  additionalProperties: false,
};

export function makeRequest(over: Partial<AgentTaskRequest> = {}): AgentTaskRequest {
  const root = over.cwd ?? '/repo';
  return {
    taskId: 'TASK-1',
    runId: 'RUN-1',
    planId: 'PLAN-1',
    courseId: 'demo',
    stage: 'RESEARCH_BRIEF',
    role: 'research-reviewer',
    promptTemplate: 'review',
    subject: 'accuracy',
    cycle: 0,
    prompt: 'PROMPT BODY',
    systemPreamble: 'You are a CourseForge research-reviewer.',
    cwd: root,
    readOnlyPaths: [],
    writablePaths: [],
    agentTools: ['Read', 'Grep', 'Glob'],
    outputSchemaName: 'ReviewFindings',
    outputSchema: SCHEMA,
    outputSchemaPath: `${root}/schemas/review.schema.json`,
    writeMode: 'findings-only',
    network: false,
    timeoutSec: 60,
    maxTurns: 4,
    logDir: `${root}/logs/tasks`,
    ...over,
  };
}

export function proc(over: Partial<ProcessResult> = {}): ProcessResult {
  return { code: 0, signal: null, stdout: '', stderr: '', timedOut: false, durationMs: 5, spawnError: null, ...over };
}

export interface RecordedCall {
  argv: readonly string[];
  opts: RunOptions;
}

/** Runner answering by the first argv entry after the command prefix. */
export function scriptedRunner(answer: (args: readonly string[], opts: RunOptions) => ProcessResult): {
  runner: Runner;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const runner: Runner = async (argv, opts) => {
    calls.push({ argv, opts });
    return answer(argv.slice(1), opts);
  };
  return { runner, calls };
}
