/**
 * The one semantic repair allowed during COURSE_BUILD (spec 05 bounded fallback): when a rendered visual
 * fails quality checks, an agent may restructure its VisualSpec once before the router falls back.
 */
import type { TaskSpec, VisualSpec } from '../core/schemas/index.js';
import { runAgentTask } from './agent.js';
import type { RunContext } from './context.js';
import { logDecisions } from './store.js';

export async function runVisualRepair(ctx: RunContext, spec: VisualSpec, issues: unknown): Promise<VisualSpec | null> {
  const task: TaskSpec = {
    taskId: `${ctx.runId}:BD:visual-repair`,
    role: 'visual-repairer',
    promptTemplate: 'visual-repair',
    subject: spec.id,
    rubric: null,
    skills: ['instructional-graphics'],
    tools: ['read'],
    agentTools: ['Read'],
    inputPaths: [],
    readOnlyPaths: [],
    writablePaths: [],
    outputSchema: 'visual-spec',
    writeMode: 'structured',
    network: false,
    timeoutSec: 600,
    maxTurns: 6,
  };
  logDecisions(ctx.dir, [
    {
      ts: ctx.now(),
      runId: ctx.runId,
      planId: null,
      stage: 'COURSE_BUILD',
      kind: 'fallback',
      subject: spec.id,
      input: 'render-quality-failed',
      selected: 'visual-repair',
      rule: 'VIS-REPAIR-001',
      fallback: true,
      reason: 'one semantic repair before renderer fallback',
    },
  ]);
  try {
    const { output } = await runAgentTask<VisualSpec>(ctx, task, { subject: spec.id, cycle: 0, extra: { spec, issues } });
    return output.id === spec.id ? output : null;
  } catch {
    return null;
  }
}
