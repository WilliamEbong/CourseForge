import { describe, expect, it } from 'vitest';
import { applyAdjudication, preAdjudicate } from '../../../src/review/adjudicate.js';
import { normaliseFindings } from '../../../src/review/findings.js';
import { buildRepairPlan } from '../../../src/review/repair-plan.js';
import { consolidatedReviewMarkdown } from '../../../src/review/report.js';
import { overlap, shuffle } from './fixtures.js';

describe('consolidatedReviewMarkdown', () => {
  it('is deterministic and contains the key sections', () => {
    const fx = overlap();
    const pre = preAdjudicate(normaliseFindings(fx), {
      lockedIds: new Set(fx.lockedIds),
      humanDecisions: fx.humanDecisions,
      repairSeverities: fx.repairSeverities,
    });
    const { findings } = applyAdjudication(pre, {
      decisions: [{ findingId: 'SB-C1-005', verdict: 'defer-to-human', finalSeverity: 'minor', rationale: '', repairInstruction: null }],
      conflicts: [],
    });
    const plan = buildRepairPlan({
      stage: 'STORYBOARD',
      cycle: 1,
      artifactId: 'ART-SB',
      target: 'model',
      findings,
      lockConflicts: pre.lockConflicts,
      repairSeverities: fx.repairSeverities,
    });
    const summaries = fx.reviews.map((r) => ({ reviewer: r.reviewer, summary: r.set.summary }));
    const md = consolidatedReviewMarkdown({ stage: 'STORYBOARD', cycle: 1, courseTitle: 'Chemical Risk', findings, plan, summaries });
    const again = consolidatedReviewMarkdown({
      stage: 'STORYBOARD',
      cycle: 1,
      courseTitle: 'Chemical Risk',
      findings: shuffle(findings, 9),
      plan,
      summaries: shuffle(summaries, 4),
    });
    expect(again).toBe(md);
    for (const h of [
      '# Consolidated review — Chemical Risk',
      '### Blocker (1)',
      '## Repair plan',
      '## Lock conflicts',
      '## Deferred to human',
    ]) {
      expect(md).toContain(h);
    }
    expect(md).toContain('SB-C1-009 (merged: SB-C1-002)');
    expect(md).toContain('SB-C1-008 → locked `Q-02`');
    expect(md).toMatch(/- SB-C1-005 \(minor, B-05\)/);
  });
});
