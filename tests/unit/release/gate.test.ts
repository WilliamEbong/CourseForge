import { describe, expect, it } from 'vitest';
import { SEVERITIES } from '../../../src/core/enums.js';
import { ReleaseDecisionSchema } from '../../../src/core/schemas/reports.js';
import { type Finding, FindingStatusSchema } from '../../../src/core/schemas/review.js';
import { type ReleaseGateInput, releaseGate } from '../../../src/release/gate.js';
import { accessibility, finding, functional, passingInput } from './helpers.js';

type Case = [name: string, patch: (i: ReleaseGateInput) => Partial<ReleaseGateInput>, codes: string[]];

const withFinding =
  (...fs: Finding[]) =>
  (i: ReleaseGateInput) => ({ findings: [...i.findings, ...fs] });

const cases: Case[] = [
  ['pass baseline', () => ({}), []],
  ['open blocker', withFinding(finding({ findingId: 'F-1', severity: 'blocker' })), ['OPEN_BLOCKING_FINDING']],
  ['open critical', withFinding(finding({ findingId: 'F-1', severity: 'critical' })), ['OPEN_BLOCKING_FINDING']],
  ['accepted critical still blocks', withFinding(finding({ severity: 'critical', status: 'accepted' })), ['OPEN_BLOCKING_FINDING']],
  ['deferred blocker blocks', withFinding(finding({ severity: 'blocker', status: 'deferred' })), ['OPEN_BLOCKING_FINDING']],
  ['waived blocker passes', withFinding(finding({ severity: 'blocker', status: 'waived' })), []],
  ['rejected blocker passes', withFinding(finding({ severity: 'blocker', status: 'rejected' })), []],
  ['fixed critical passes', withFinding(finding({ severity: 'critical', status: 'fixed' })), []],
  ['open major passes', withFinding(finding({ severity: 'major' })), []],
  [
    'serious axe blocks',
    () => ({ accessibility: accessibility([{ id: 'color-contrast', impact: 'serious' }]) }),
    ['AXE_BLOCKING_VIOLATION'],
  ],
  ['critical axe blocks', () => ({ accessibility: accessibility([{ id: 'label', impact: 'critical' }]) }), ['AXE_BLOCKING_VIOLATION']],
  ['moderate axe passes', () => ({ accessibility: accessibility([{ id: 'region', impact: 'moderate' }]) }), []],
  ['null-impact axe passes', () => ({ accessibility: accessibility([{ id: 'x', impact: null }]) }), []],
  ['functional failure', () => ({ functional: functional(false) }), ['FUNCTIONAL_FAILURE']],
  ['functional report missing', () => ({ functional: null }), ['FUNCTIONAL_FAILURE']],
  ['a11y report missing', () => ({ accessibility: null }), ['MISSING_ARTIFACT']],
  ['reports optional', () => ({ functional: null, accessibility: null, build: null, requireReports: false }), []],
  [
    'build check failed',
    (i) => ({ build: { checks: [...(i.build?.checks ?? []), { id: 'csp', pass: false, detail: 'hash mismatch' }] } }),
    ['BUILD_CHECK_FAILED'],
  ],
  ['missing artifact', (i) => ({ requiredArtifacts: [...i.requiredArtifacts, 'release/source-report.md'] }), ['MISSING_ARTIFACT']],
  ['dangling citation', () => ({ citations: { dangling: ['SRC-9'], unresolvedInline: [] } }), ['CITATION_INTEGRITY']],
  ['unresolved inline citation', () => ({ citations: { dangling: [], unresolvedInline: ['[SRC-X]'] } }), ['CITATION_INTEGRITY']],
  ['lock conflict', () => ({ lockConflicts: ['SB-C1-008'] }), ['LOCK_CONFLICT']],
  ['cycles exhausted', () => ({ cyclesExhaustedWithBlockers: true }), ['CYCLES_EXHAUSTED']],
  ['original modified', () => ({ originalsModified: ['originals/course.html'] }), ['ORIGINAL_MODIFIED']],
  ['human approval pending', () => ({ humanApprovalPending: true }), ['HUMAN_APPROVAL_REQUIRED']],
  [
    'several reasons, sorted by code',
    (i) => ({
      humanApprovalPending: true,
      citations: { dangling: ['SRC-9'], unresolvedInline: [] },
      findings: [...i.findings, finding({ findingId: 'F-2', severity: 'blocker' }), finding({ findingId: 'F-1', severity: 'critical' })],
    }),
    ['OPEN_BLOCKING_FINDING', 'CITATION_INTEGRITY', 'HUMAN_APPROVAL_REQUIRED'],
  ],
];

describe('releaseGate @J2', () => {
  it.each(cases)('%s', (_name, patch, codes) => {
    const base = passingInput();
    const d = releaseGate({ ...base, ...patch(base) });
    expect(ReleaseDecisionSchema.parse(d)).toEqual(d);
    expect(d.reasons.map((r) => r.code)).toEqual(codes);
    expect(d.decision).toBe(codes.length ? 'block' : 'pass');
  });

  it('lists blocking finding ids and counts axe violations per rule', () => {
    const d = releaseGate({
      ...passingInput(),
      findings: [finding({ findingId: 'F-2', severity: 'blocker' }), finding({ findingId: 'F-1', severity: 'critical' })],
      accessibility: accessibility([
        { id: 'color-contrast', impact: 'serious', nodes: ['#a', '#b'] },
        { id: 'label', impact: 'critical' },
      ]),
    });
    expect(d.reasons[0]).toMatchObject({ findingIds: ['F-1', 'F-2'], detail: expect.stringContaining('1 blocker, 1 critical') });
    expect(d.reasons.slice(1).map((r) => r.detail)).toEqual([
      'color-contrast (serious): 2 node(s) on 1 screen(s): S-01@1440',
      'label (critical): 1 node(s) on 1 screen(s): S-01@1440',
    ]);
  });

  it('property: adding any finding never turns block into pass', () => {
    let n = 0;
    for (const [, patch, codes] of cases.filter(([, , c]) => c.length > 0)) {
      const base = passingInput();
      const blocked = { ...base, ...patch(base) };
      const before = releaseGate(blocked);
      expect(before.decision, codes.join()).toBe('block');
      for (const severity of SEVERITIES) {
        for (const status of FindingStatusSchema.options) {
          const extra = finding({ findingId: `P-${n++}`, severity, status });
          const after = releaseGate({ ...blocked, findings: [...blocked.findings, extra] });
          expect(after.decision).toBe('block');
          expect(after.reasons.length).toBeGreaterThanOrEqual(before.reasons.length);
        }
      }
    }
    // and from a passing input, a finding can only keep pass or turn it into block
    for (const severity of SEVERITIES) {
      const d = releaseGate({ ...passingInput(), findings: [finding({ severity })] });
      expect(d.decision).toBe(severity === 'blocker' || severity === 'critical' ? 'block' : 'pass');
    }
  });
});
