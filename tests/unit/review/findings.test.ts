import { describe, expect, it } from 'vitest';
import { FindingSchema, FindingSetSchema } from '../../../src/core/schemas/review.js';
import { countBySeverity, normaliseFindings, openBlocking, qaFindings, validatorFindings } from '../../../src/review/findings.js';
import { overlap, shuffle } from './fixtures.js';

const valid = {
  severity: 'major',
  category: 'accuracy',
  location: 'B-03',
  problem: 'p',
  evidence: ['X'],
  recommendedAction: 'r',
  confidence: 'high',
};

describe('finding schema @E2', () => {
  it('accepts every fixture finding set', () => {
    for (const r of overlap().reviews) expect(FindingSetSchema.safeParse(r.set).success).toBe(true);
  });

  it.each([
    ['unknown severity', { ...valid, severity: 'catastrophic' }],
    ['unknown category', { ...valid, category: 'vibes' }],
    ['unknown confidence', { ...valid, confidence: 'certain' }],
    ['empty location', { ...valid, location: '' }],
    ['missing problem', (({ problem: _, ...rest }) => rest)(valid)],
    ['missing evidence', (({ evidence: _, ...rest }) => rest)(valid)],
    ['extra key', { ...valid, findingId: 'X-1' }],
  ])('rejects %s', (_name, finding) => {
    expect(FindingSetSchema.safeParse({ summary: 's', findings: [finding] }).success).toBe(false);
  });

  it('rejects a set without summary', () => {
    expect(FindingSetSchema.safeParse({ findings: [valid] }).success).toBe(false);
  });
});

describe('normaliseFindings @E2', () => {
  it('assigns deterministic, sequential IDs by reviewer order', () => {
    const fx = overlap();
    const a = normaliseFindings(fx);
    const b = normaliseFindings({ ...fx, reviews: shuffle(fx.reviews, 7) });
    expect(b).toEqual(a);
    expect(a.map((f) => f.findingId)).toEqual(Array.from({ length: 10 }, (_, i) => `SB-C1-${String(i + 1).padStart(3, '0')}`));
    expect(a[0]?.reviewer).toBe('accuracy-reviewer');
    expect(a.at(-1)?.reviewer).toBe('safety-reviewer');
    for (const f of a) {
      expect(FindingSchema.parse(f)).toEqual(f);
      expect(f).toMatchObject({ source: 'reviewer', status: 'open', artifactId: 'ART-SB', cycle: 1 });
    }
  });

  it('mints validator and QA findings with V / Q infixes', () => {
    const issue = { checkId: 'ids-unique', severity: 'blocker' as const, category: 'structure' as const, location: 'B-01', problem: 'dup' };
    const v = validatorFindings({ stage: 'STORYBOARD', cycle: 0, issues: [issue, issue] });
    expect(v.map((f) => f.findingId)).toEqual(['SB-C0-V001', 'SB-C0-V002']);
    expect(v[0]).toMatchObject({ source: 'validator', reviewer: 'validator:ids-unique', checkId: 'ids-unique', evidence: [] });
    const q = qaFindings({ stage: 'COURSE_QA', cycle: 2, startIndex: 4, issues: [issue] });
    expect(q[0]).toMatchObject({ findingId: 'QA-C2-Q005', source: 'qa', reviewer: 'qa:ids-unique' });
  });

  it('counts and filters blocking findings', () => {
    const fs = normaliseFindings(overlap());
    expect(countBySeverity(fs)).toEqual({ blocker: 1, critical: 1, major: 4, minor: 3, style: 1 });
    const closed = fs.map((f) => (f.severity === 'blocker' ? { ...f, status: 'fixed' as const } : f));
    expect(openBlocking(closed, ['blocker', 'critical']).map((f) => f.findingId)).toEqual(['SB-C1-002']);
  });
});
