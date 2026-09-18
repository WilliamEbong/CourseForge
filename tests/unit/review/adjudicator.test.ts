import { describe, expect, it } from 'vitest';
import { applyAdjudication, jaccard, preAdjudicate } from '../../../src/review/adjudicate.js';
import { normaliseFindings } from '../../../src/review/findings.js';
import { overlap, shuffle } from './fixtures.js';

const run = (seed?: number) => {
  const fx = overlap();
  const findings = normaliseFindings(fx);
  return preAdjudicate(seed === undefined ? findings : shuffle(findings, seed), {
    lockedIds: new Set(fx.lockedIds),
    humanDecisions: fx.humanDecisions,
    repairSeverities: fx.repairSeverities,
  });
};

describe('jaccard', () => {
  it('ignores case, punctuation and stop words', () => {
    expect(jaccard('The warning block.', 'warning BLOCK')).toBe(1);
    expect(jaccard('alpha beta', 'gamma delta')).toBe(0);
    expect(jaccard('alpha beta', 'alpha gamma')).toBeCloseTo(1 / 3);
    expect(jaccard('', 'the')).toBe(1);
  });
});

describe('preAdjudicate @E3', () => {
  it('merges overlapping findings from different reviewers', () => {
    const pre = run();
    expect(pre.mergedAway).toEqual({ 'SB-C1-002': 'SB-C1-009', 'SB-C1-004': 'SB-C1-001' });
    expect(pre.findings).toHaveLength(8);
    const b07 = pre.findings.find((f) => f.findingId === 'SB-C1-009');
    expect(b07).toMatchObject({ severity: 'blocker', mergedFrom: ['SB-C1-002'], evidence: ['AB-OHS-4 s.250', 'CLM-0012'] });
    const b03 = pre.findings.find((f) => f.findingId === 'SB-C1-001');
    expect(b03).toMatchObject({ severity: 'major', mergedFrom: ['SB-C1-004'], evidence: ['AB-OHS-4 s.21', 'CLM-0004'] });
  });

  it('takes the max severity, then highest confidence, then lowest id', () => {
    const [f] = normaliseFindings(overlap());
    if (!f) throw new Error('fixture');
    const a = { ...f, findingId: 'X-2', severity: 'minor' as const, confidence: 'high' as const, evidence: ['a'] };
    const b = { ...f, findingId: 'X-3', severity: 'major' as const, confidence: 'low' as const, evidence: ['b', 'a'] };
    const c = { ...f, findingId: 'X-1', severity: 'major' as const, confidence: 'low' as const, evidence: [] };
    const pre = preAdjudicate([a, b, c], { lockedIds: new Set(), humanDecisions: {}, repairSeverities: ['major'] });
    expect(pre.findings).toHaveLength(1);
    expect(pre.findings[0]).toMatchObject({ findingId: 'X-1', severity: 'major', mergedFrom: ['X-2', 'X-3'], evidence: ['a', 'b'] });
  });

  it('does not merge different categories or locations', () => {
    const [f] = normaliseFindings(overlap());
    if (!f) throw new Error('fixture');
    const pre = preAdjudicate([f, { ...f, findingId: 'Y-1', category: 'citation' }, { ...f, findingId: 'Y-2', location: 'B-99' }], {
      lockedIds: new Set(),
      humanDecisions: {},
      repairSeverities: ['major'],
    });
    expect(pre.findings).toHaveLength(3);
  });

  it('detects lock conflicts including field / child locations', () => {
    expect(run().lockConflicts).toEqual([{ findingId: 'SB-C1-008', targetId: 'Q-02' }]);
    const [f] = normaliseFindings(overlap());
    if (!f) throw new Error('fixture');
    const pre = preAdjudicate(
      [
        { ...f, findingId: 'Z-1', location: 'Q-02.stem' },
        { ...f, findingId: 'Z-2', location: 'Q-02/options' },
        { ...f, findingId: 'Z-3', location: 'Q-020' },
      ],
      { lockedIds: new Set(['Q-02']), humanDecisions: {}, repairSeverities: ['major'] },
    );
    expect(pre.lockConflicts.map((c) => c.findingId)).toEqual(['Z-1', 'Z-2']);
    expect(pre.actionable.map((a) => a.findingId)).toEqual(['Z-3']);
  });

  it('honours human decisions and computes the actionable set', () => {
    const pre = run();
    expect(pre.findings.find((f) => f.findingId === 'SB-C1-010')?.status).toBe('rejected');
    expect(pre.findings.find((f) => f.findingId === 'SB-C1-005')?.status).toBe('accepted');
    expect(pre.actionable.map((f) => f.findingId)).toEqual(['SB-C1-009', 'SB-C1-001', 'SB-C1-007', 'SB-C1-003', 'SB-C1-005']);
  });

  it('detects remove-vs-expand contradictions and flags needsAI', () => {
    const pre = run();
    expect(pre.contradictions).toEqual([
      { findingIds: ['SB-C1-005', 'SB-C1-007'], location: 'B-05', reason: expect.stringContaining('removing') },
    ]);
    expect(pre.needsAI).toBe(true);
  });

  it('needsAI is false for a clean, high-confidence minor set', () => {
    const [f] = normaliseFindings(overlap());
    if (!f) throw new Error('fixture');
    const pre = preAdjudicate([{ ...f, severity: 'minor' }], { lockedIds: new Set(), humanDecisions: {}, repairSeverities: ['minor'] });
    expect(pre.needsAI).toBe(false);
    expect(pre.contradictions).toEqual([]);
  });

  it('is stable under input shuffling', () => {
    const base = JSON.stringify(run());
    for (const seed of [1, 2, 3, 42, 99]) expect(JSON.stringify(run(seed))).toBe(base);
  });
});

describe('applyAdjudication @E3', () => {
  it('applies verdicts, maps merged ids, and warns on unknown ids', () => {
    const pre = run();
    const out = applyAdjudication(pre, {
      decisions: [
        { findingId: 'SB-C1-007', verdict: 'accept', finalSeverity: 'minor', rationale: 'r', repairInstruction: 'Add a short example.' },
        { findingId: 'SB-C1-005', verdict: 'reject', finalSeverity: 'minor', rationale: 'r', repairInstruction: null },
        { findingId: 'SB-C1-002', verdict: 'defer-to-human', finalSeverity: 'blocker', rationale: 'r', repairInstruction: null },
        { findingId: 'NOPE-1', verdict: 'accept', finalSeverity: 'major', rationale: 'r', repairInstruction: 'x' },
      ],
      conflicts: [],
    });
    const byId = new Map(out.findings.map((f) => [f.findingId, f]));
    expect(byId.get('SB-C1-007')).toMatchObject({ status: 'accepted', severity: 'minor' });
    expect(byId.get('SB-C1-005')?.status).toBe('rejected');
    expect(byId.get('SB-C1-009')?.status).toBe('deferred');
    expect(out.instructions).toEqual({ 'SB-C1-007': 'Add a short example.' });
    expect(out.warnings).toEqual([expect.stringContaining('NOPE-1')]);
  });

  it('null agent leaves findings untouched', () => {
    const pre = run();
    expect(applyAdjudication(pre, null)).toEqual({ findings: pre.findings, warnings: [], instructions: {} });
  });
});
