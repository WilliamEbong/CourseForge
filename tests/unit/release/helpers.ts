import type { AccessibilityReport, FunctionalReport } from '../../../src/core/schemas/reports.js';
import type { Finding } from '../../../src/core/schemas/review.js';
import type { ReleaseGateInput } from '../../../src/release/gate.js';

export const finding = (over: Partial<Finding> = {}): Finding => ({
  findingId: 'QA-C0-001',
  stage: 'COURSE_QA',
  reviewer: 'ux-reviewer',
  source: 'reviewer',
  cycle: 0,
  artifactId: null,
  severity: 'minor',
  category: 'ux',
  location: 'S-01',
  problem: 'Problem.',
  evidence: [],
  recommendedAction: 'Fix it.',
  confidence: 'high',
  status: 'open',
  mergedFrom: [],
  checkId: null,
  ...over,
});

export const functional = (pass = true): FunctionalReport => ({
  schemaVersion: 1,
  courseId: 'demo',
  mode: 'contract',
  target: 'release/course.html',
  targetHash: 'sha256:x',
  profile: 'release',
  viewports: [1440, 768, 390],
  durationMs: 1000,
  screens: [
    { id: 'S-01', index: 0, viewport: 1440, ok: true, errors: [], overflow: [], missingIds: [] },
    { id: 'S-02', index: 1, viewport: 1440, ok: pass, errors: pass ? [] : ['TypeError'], overflow: [], missingIds: [] },
  ],
  interactions: [
    { id: 'S-02', mode: 'single', correctPath: 'pass', incorrectPath: pass ? 'pass' : 'fail', detail: 'ok' },
    { id: 'S-03', mode: 'matching', correctPath: 'pass', incorrectPath: 'skipped', detail: 'ok' },
  ],
  scoring: { checked: true, expectedPercent: 100, actualPercent: 100, ok: true },
  navigation: { ok: true, detail: 'menu ok' },
  resources: { glossary: 3, references: 2, ok: true, detail: 'ok' },
  progress: { persisted: true, resetOk: true },
  keyboard: { ok: true, focusVisible: true, detail: 'ok' },
  offline: { blockedRequests: [] },
  consoleErrors: [],
  crawl: null,
  summary: { pass, failures: pass ? [] : ['S-02: TypeError'] },
});

export const accessibility = (
  violations: { id: string; impact: 'minor' | 'moderate' | 'serious' | 'critical' | null; nodes?: string[] }[] = [],
): AccessibilityReport => ({
  schemaVersion: 1,
  courseId: 'demo',
  target: 'release/course.html',
  engine: 'axe-core 4.10',
  tags: ['wcag2a', 'wcag2aa'],
  screens: [
    {
      id: 'S-01',
      viewport: 1440,
      violations: violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: `Help for ${v.id}`,
        helpUrl: 'https://x',
        nodes: v.nodes ?? ['#a'],
      })),
    },
  ],
  totals: {
    critical: violations.filter((v) => v.impact === 'critical').length,
    serious: violations.filter((v) => v.impact === 'serious').length,
    moderate: violations.filter((v) => v.impact === 'moderate').length,
    minor: violations.filter((v) => v.impact === 'minor').length,
  },
});

export const passingInput = (): ReleaseGateInput => ({
  findings: [finding({ severity: 'minor' })],
  policy: { releaseBlockingSeverities: ['blocker', 'critical'], axeBlockingImpacts: ['serious', 'critical'] },
  functional: functional(true),
  accessibility: accessibility([{ id: 'region', impact: 'moderate' }]),
  build: { checks: [{ id: 'size-budget', pass: true, detail: '1.1 MB' }] },
  requiredArtifacts: ['release/course.html', 'release/qa-report.md'],
  presentArtifacts: ['release/course.html', 'release/qa-report.md', 'extra.json'],
  citations: { dangling: [], unresolvedInline: [] },
  lockConflicts: [],
  cyclesExhaustedWithBlockers: false,
  originalsModified: [],
  humanApprovalPending: false,
});
