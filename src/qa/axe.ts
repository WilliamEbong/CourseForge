import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { AccessibilityReport } from '../core/schemas/reports.js';

export const DEFAULT_AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
export const AXE_ENGINE = 'axe-core 4.13';

export type AxeScreen = AccessibilityReport['screens'][number];
export type AxeViolation = AxeScreen['violations'][number];
type Impact = NonNullable<AxeViolation['impact']>;
const IMPACTS: readonly Impact[] = ['minor', 'moderate', 'serious', 'critical'];
const MAX_NODES = 10;

export async function runAxe(page: Page, opts: { include?: string; tags?: string[] } = {}): Promise<AxeViolation[]> {
  let builder = new AxeBuilder({ page }).withTags(opts.tags ?? DEFAULT_AXE_TAGS);
  if (opts.include) builder = builder.include(opts.include);
  const res = await builder.analyze();
  return res.violations.map((v) => ({
    id: v.id,
    impact: v.impact && (IMPACTS as readonly string[]).includes(v.impact) ? (v.impact as Impact) : null,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.slice(0, MAX_NODES).map((n) => n.target.map(String).join(' ')),
  }));
}

export function axeTotals(screens: AxeScreen[]): AccessibilityReport['totals'] {
  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const s of screens) for (const v of s.violations) if (v.impact) totals[v.impact] += 1;
  return totals;
}

export function buildAccessibilityReport(
  courseId: string,
  target: string,
  screens: AxeScreen[],
  tags: string[] = DEFAULT_AXE_TAGS,
): AccessibilityReport {
  return { schemaVersion: 1, courseId, target, engine: AXE_ENGINE, tags, screens, totals: axeTotals(screens) };
}

/** Rule id → { impact, screens it fails on, sample nodes } across all screens/viewports. */
export function violationsByRule(
  report: AccessibilityReport,
): Map<string, { impact: AxeViolation['impact']; help: string; helpUrl: string; screens: string[]; nodes: string[] }> {
  const map = new Map<string, { impact: AxeViolation['impact']; help: string; helpUrl: string; screens: string[]; nodes: string[] }>();
  for (const s of report.screens) {
    for (const v of s.violations) {
      const e = map.get(v.id) ?? { impact: v.impact, help: v.help, helpUrl: v.helpUrl, screens: [], nodes: [] };
      e.screens.push(`${s.id}@${s.viewport}`);
      for (const n of v.nodes) if (e.nodes.length < 5 && !e.nodes.includes(n)) e.nodes.push(n);
      map.set(v.id, e);
    }
  }
  return map;
}
