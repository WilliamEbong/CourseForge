import { describe, expect, it } from 'vitest';
import { RepairPlanSchema } from '../../../src/core/schemas/review.js';
import { applyAdjudication, preAdjudicate } from '../../../src/review/adjudicate.js';
import { normaliseFindings } from '../../../src/review/findings.js';
import { buildRepairPlan } from '../../../src/review/repair-plan.js';
import { overlap, shuffle } from './fixtures.js';

function setup() {
  const fx = overlap();
  const pre = preAdjudicate(normaliseFindings(fx), {
    lockedIds: new Set(fx.lockedIds),
    humanDecisions: fx.humanDecisions,
    repairSeverities: fx.repairSeverities,
  });
  const adj = applyAdjudication(pre, {
    decisions: [
      { findingId: 'SB-C1-005', verdict: 'defer-to-human', finalSeverity: 'minor', rationale: 'r', repairInstruction: null },
      { findingId: 'SB-C1-007', verdict: 'accept', finalSeverity: 'major', rationale: 'r', repairInstruction: 'Add one worked example.' },
    ],
    conflicts: [],
  });
  return { fx, pre, adj };
}

const plan = (seed?: number, target: 'model' | 'html-direct' | 'tooling-defect' = 'model') => {
  const { fx, pre, adj } = setup();
  return buildRepairPlan({
    stage: 'STORYBOARD',
    cycle: 1,
    artifactId: 'ART-SB',
    target,
    findings: seed === undefined ? adj.findings : shuffle(adj.findings, seed),
    lockConflicts: seed === undefined ? pre.lockConflicts : shuffle(pre.lockConflicts, seed),
    repairSeverities: fx.repairSeverities,
    instructions: adj.instructions,
  });
};

describe('buildRepairPlan @E4', () => {
  it('is schema-valid and groups actions by target', () => {
    const p = plan();
    expect(RepairPlanSchema.parse(p)).toEqual(p);
    expect(p.actions).toEqual([
      {
        actionId: 'A1-01',
        targetId: 'B-07',
        findingIds: ['SB-C1-009'],
        severity: 'blocker',
        category: 'safety',
        instruction: 'State that fit testing is required before first use.',
      },
      {
        actionId: 'A1-02',
        targetId: 'B-03',
        findingIds: ['SB-C1-001', 'SB-C1-003'],
        severity: 'major',
        category: 'accuracy',
        instruction:
          'Restore the qualification from section 21 to the employer duties statement.\nAdd the section 21 locator to the employer duties citation.',
      },
      {
        actionId: 'A1-03',
        targetId: 'B-05',
        findingIds: ['SB-C1-007'],
        severity: 'major',
        category: 'instructional',
        instruction: 'Add one worked example.',
      },
    ]);
  });

  it('partitions lock conflicts, deferred, rejected', () => {
    const p = plan();
    expect(p.lockConflicts).toEqual([{ findingId: 'SB-C1-008', targetId: 'Q-02' }]);
    expect(p.deferred).toEqual(['SB-C1-005']);
    expect(p.rejected).toEqual(['SB-C1-010']);
    expect(p.actions.flatMap((a) => a.findingIds)).not.toContain('SB-C1-008');
    expect(p.unrepairable).toEqual([]);
  });

  it('is byte-stable across shuffled inputs', () => {
    const base = JSON.stringify(plan());
    for (const seed of [3, 5, 11, 1234]) expect(JSON.stringify(plan(seed))).toBe(base);
  });

  it('keeps global and model-performance findings open as unrepairable', () => {
    const { adj } = setup();
    const [f] = adj.findings;
    if (!f) throw new Error('fixture');
    const p = buildRepairPlan({
      stage: 'COURSE_QA',
      cycle: 2,
      artifactId: null,
      target: 'model',
      findings: [
        { ...f, findingId: 'G-1', location: 'global', status: 'open' },
        { ...f, findingId: 'P-1', location: 'S-01', category: 'performance', status: 'open' },
        { ...f, findingId: 'K-1', location: 'S-02', status: 'open' },
      ],
      lockConflicts: [],
      repairSeverities: ['blocker', 'critical', 'major', 'minor'],
    });
    expect(p.unrepairable).toEqual(['G-1', 'P-1']);
    expect(p.actions.map((a) => [a.actionId, a.targetId])).toEqual([['A2-01', 'S-02']]);
  });

  it('routes everything to unrepairable for tooling defects', () => {
    const p = plan(undefined, 'tooling-defect');
    expect(p.actions).toEqual([]);
    expect(p.unrepairable).toEqual(['SB-C1-001', 'SB-C1-003', 'SB-C1-007', 'SB-C1-009']);
  });
});
