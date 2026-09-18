import type { AccessibilityReport, FunctionalReport } from '../../../src/core/schemas/reports.js';

export function functional(over: Partial<FunctionalReport> = {}): FunctionalReport {
  return {
    schemaVersion: 1,
    courseId: 'c',
    mode: 'contract',
    target: 'build/index.html',
    targetHash: 'sha256:x',
    profile: 'dev',
    viewports: [1440],
    durationMs: 1,
    screens: [{ id: 's1', index: 0, viewport: 1440, ok: true, errors: [], overflow: [], missingIds: [] }],
    interactions: [],
    scoring: { checked: false, expectedPercent: null, actualPercent: null, ok: true },
    navigation: { ok: true, detail: '' },
    resources: { glossary: 0, references: 0, ok: true, detail: '' },
    progress: { persisted: true, resetOk: true },
    keyboard: { ok: true, focusVisible: true, detail: '' },
    offline: { blockedRequests: [] },
    consoleErrors: [],
    crawl: null,
    summary: { pass: true, failures: [] },
    ...over,
  };
}

export function accessibility(violations: AccessibilityReport['screens'][number]['violations'] = []): AccessibilityReport {
  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) if (v.impact) totals[v.impact]++;
  return {
    schemaVersion: 1,
    courseId: 'c',
    target: 't',
    engine: 'axe',
    tags: [],
    screens: [{ id: 's1', viewport: 1440, violations }],
    totals,
  };
}

export const violation = (id: string, impact: 'minor' | 'moderate' | 'serious' | 'critical') => ({
  id,
  impact,
  help: `${id} help`,
  helpUrl: `https://dequeuniversity.com/rules/axe/4.13/${id}`,
  nodes: ['#a'],
});
