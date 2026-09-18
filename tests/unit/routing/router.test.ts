import { describe, expect, it } from 'vitest';
import { STAGES, type Stage } from '../../../src/core/enums.js';
import { RoutingError } from '../../../src/core/errors.js';
import { ExecutionPlanSchema } from '../../../src/core/schemas/index.js';
import { resolveExecutionPlan } from '../../../src/routing/plan.js';
import { planInput, registries } from './helpers.js';

const summary = (stage: Stage) => {
  const p = resolveExecutionPlan(planInput(stage));
  return {
    generator: p.generator ? { role: p.generator.role, schema: p.generator.outputSchema, agentTools: p.generator.agentTools } : null,
    fanOut: p.generatorFanOut,
    reviewers: p.reviewers.map((r) => r.subject),
    skills: p.skills,
    tools: p.tools,
    validators: p.validators,
    repairer: p.repairer?.outputSchema ?? null,
    gate: p.humanGate.mode,
  };
};

describe('execution plan per stage @D1', () => {
  it('CONCEPT', () => {
    expect(summary('CONCEPT')).toEqual({
      generator: { role: 'concept-analyst', schema: 'concept-brief', agentTools: ['Read'] },
      fanOut: [],
      reviewers: ['concept-scope-safety'],
      skills: ['research-planning'],
      tools: ['glob', 'grep', 'read'],
      validators: ['schema', 'concept-complete'],
      repairer: 'repair-result',
      gate: 'auto',
    });
  });

  it('RESEARCH_DOSSIER fans out per section with web tools and five reviewers', () => {
    const s = summary('RESEARCH_DOSSIER');
    expect(s.generator).toEqual({ role: 'researcher', schema: 'dossier-section', agentTools: ['Read', 'WebSearch', 'WebFetch'] });
    expect(s.fanOut).toEqual(['M1', 'M2']);
    expect(s.reviewers).toEqual([
      'evidence-source',
      'domain-completeness',
      'currentness-jurisdiction',
      'safety-scope',
      'adversarial-research',
    ]);
    expect(s.tools).toEqual(['glob', 'grep', 'read', 'web-fetch', 'web-search']);
    expect(s.validators).toEqual(['schema', 'dossier-integrity', 'no-placeholders']);
  });

  it('STORYBOARD has the six-reviewer panel, full validator set and hybrid gate', () => {
    const s = summary('STORYBOARD');
    expect(s.reviewers).toEqual([
      'content-completeness',
      'instructional',
      'assessment',
      'citation-evidence',
      'accessibility-planning',
      'editorial-readability',
    ]);
    expect(s.skills).toEqual(
      expect.arrayContaining(['storyboard-authoring', 'scenario-design', 'assessment-design', 'instructional-graphics']),
    );
    expect(s.validators).toContain('no-drag-only');
    expect(s.gate).toBe('hybrid');
  });

  it('COURSE_QA has no generator, ten reviewers and a repairer', () => {
    const s = summary('COURSE_QA');
    expect(s.generator).toBeNull();
    expect(s.reviewers).toHaveLength(10);
    expect(s.repairer).toBe('repair-result');
  });

  it.each(['COURSE_MODEL', 'COURSE_BUILD', 'RELEASE'] as const)('%s is deterministic: no tasks, backend still recorded', (stage) => {
    const p = resolveExecutionPlan(planInput(stage));
    expect(p.generator).toBeNull();
    expect(p.reviewers).toEqual([]);
    expect(p.adjudicator).toBeNull();
    expect(p.repairer).toBeNull();
    expect(p.tools).toEqual([]);
    expect(p.compiler).not.toBeNull();
    expect(p.decisions.some((d) => d.kind === 'backend')).toBe(true);
  });

  it.each(STAGES)('%s plan is ExecutionPlanSchema-valid with plan-first metadata', (stage) => {
    const p = resolveExecutionPlan(planInput(stage));
    expect(ExecutionPlanSchema.safeParse(p).success).toBe(true);
    expect(p.planId).toMatch(/^PLAN-RUN-20260918T000000Z-abcd-[A-Z]{2}-r1$/);
    expect(p.registryHashes).toEqual(registries.hashes);
    expect(p.expectedOutputs.every((o) => o.startsWith('courses/demo-course/'))).toBe(true);
    expect(p.writablePaths.every((w) => w.startsWith('courses/demo-course/'))).toBe(true);
    for (const kind of ['stage', 'backend', 'gate', 'skill', 'tool'] as const)
      expect(p.decisions.filter((d) => d.kind === kind)).toHaveLength(1);
  });

  it('reviewer tasks are findings-only with no writable paths', () => {
    const p = resolveExecutionPlan(planInput('INSTRUCTIONAL_DESIGN'));
    for (const r of p.reviewers) {
      expect(r.writeMode).toBe('findings-only');
      expect(r.writablePaths).toEqual([]);
      expect(r.taskId).toBe(`${p.planId}:rev:${r.subject}`);
      expect(r.rubric).toBe(`prompts/rubrics/${r.subject}.md`);
    }
    expect(p.adjudicator?.outputSchema).toBe('adjudication');
  });

  it('intake modes shape the plan (preserve / review-only / improve)', () => {
    const preserve = resolveExecutionPlan(planInput('STORYBOARD', { mode: 'preserve' }));
    expect([preserve.generator, preserve.reviewers.length, preserve.repairer]).toEqual([null, 0, null]);
    expect(preserve.decisions.filter((d) => d.kind === 'reviewer').every((d) => d.selected === 'skipped')).toBe(true);
    const reviewOnly = resolveExecutionPlan(planInput('STORYBOARD', { mode: 'review-only' }));
    expect([reviewOnly.generator, reviewOnly.reviewers.length, reviewOnly.repairer]).toEqual([null, 6, null]);
    const improve = resolveExecutionPlan(planInput('STORYBOARD', { mode: 'improve' }));
    expect(improve.generator).toBeNull();
    expect(improve.repairer).not.toBeNull();
  });

  it('maxRepairCycles: course.yaml > per-stage policy > global', () => {
    expect(resolveExecutionPlan(planInput('STORYBOARD')).maxRepairCycles).toBe(3);
    const reg = structuredClone(registries);
    reg.policy.perStageMaxRepairCycles = { STORYBOARD: 1 };
    expect(resolveExecutionPlan(planInput('STORYBOARD', { registries: reg })).maxRepairCycles).toBe(1);
  });
});

describe('determinism and safety @D3 @D4', () => {
  it('identical input twice yields a deep-equal plan', () => {
    const visuals = [{ id: 'V-1', archetype: 'PROCESS', interaction: 'none', rendererOverride: null }];
    expect(resolveExecutionPlan(planInput('STORYBOARD', { visuals }))).toEqual(resolveExecutionPlan(planInput('STORYBOARD', { visuals })));
  });

  it('unknown stage throws RoutingError', () => {
    expect(() => resolveExecutionPlan(planInput('BOGUS' as Stage))).toThrow(RoutingError);
  });

  it('unknown visual archetype throws RoutingError', () => {
    const visuals = [{ id: 'V-9', archetype: 'SPIRAL', interaction: 'none', rendererOverride: null }];
    expect(() => resolveExecutionPlan(planInput('VISUAL_DIRECTION', { visuals }))).toThrow(RoutingError);
  });

  it('a stage whose reviewer disappeared from the registry throws RoutingError', () => {
    const reg = structuredClone(registries);
    delete reg.reviewers.reviewers['concept-scope-safety'];
    expect(() => resolveExecutionPlan(planInput('CONCEPT', { registries: reg }))).toThrow(RoutingError);
  });

  it('disabled reviewers are logged as skipped', () => {
    const reg = structuredClone(registries);
    const rev = reg.reviewers.reviewers.ui;
    if (rev) rev.enabled = false;
    const p = resolveExecutionPlan(planInput('COURSE_QA', { registries: reg }));
    expect(p.reviewers.map((r) => r.subject)).not.toContain('ui');
    expect(p.decisions.find((d) => d.kind === 'reviewer' && d.subject === 'ui')).toMatchObject({
      selected: 'skipped',
      reason: 'disabled in reviewers.json',
    });
  });
});

describe('tool bundle cannot expand @D6', () => {
  it.each(STAGES)('%s: every task tool is within the stage generator/reviewer tools', (stage) => {
    const def = registries.stages.stages[stage];
    const allowed = new Set([
      ...(def.generator?.tools ?? []),
      ...def.reviewers.flatMap((id) => registries.reviewers.reviewers[id]?.tools ?? []),
    ]);
    const p = resolveExecutionPlan(planInput(stage));
    for (const t of p.tools) expect(allowed.has(t), `${stage}: ${t}`).toBe(true);
    for (const task of [p.generator, p.adjudicator, p.repairer, ...p.reviewers]) {
      if (!task) continue;
      const agent = new Set(task.tools.flatMap((t) => registries.tools.tools[t]?.agentTools ?? []));
      expect(task.agentTools.every((a) => agent.has(a))).toBe(true);
      if (!task.network) expect(task.agentTools).not.toEqual(expect.arrayContaining(['WebSearch']));
    }
  });

  it('non-research tasks never get network or write tools', () => {
    const p = resolveExecutionPlan(planInput('STORYBOARD'));
    for (const task of [p.generator, p.adjudicator, p.repairer, ...p.reviewers]) {
      expect(task?.agentTools.some((a) => ['Write', 'Edit', 'WebSearch', 'WebFetch'].includes(a))).toBe(false);
    }
  });
});
