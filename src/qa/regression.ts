/** Before/after comparison of two QA runs (improved copy vs original, or consecutive repair cycles). */
import type { AccessibilityReport, FunctionalReport } from '../core/schemas/reports.js';

export interface QaRun {
  functional: FunctionalReport;
  accessibility: AccessibilityReport;
}

type Totals = AccessibilityReport['totals'];

export interface RegressionReport {
  newFailures: string[];
  fixedFailures: string[];
  a11y: { before: Totals; after: Totals };
  /** Share (0–100) of interactions whose correct and incorrect paths both passed; null when there are none. */
  interactionPassRate: { before: number | null; after: number | null };
  verdict: 'improved' | 'unchanged' | 'regressed';
}

/** Failure keys stable across runs: summary failures with volatile counts stripped, plus per-screen failures. */
function failureKeys(f: FunctionalReport): Set<string> {
  const keys = new Set<string>();
  for (const s of f.screens) if (!s.ok) keys.add(`screen ${s.id}@${s.viewport}`);
  for (const i of f.interactions) if (i.correctPath === 'fail' || i.incorrectPath === 'fail') keys.add(`interaction ${i.id}`);
  for (const x of f.summary.failures) if (!x.startsWith('screen ') && !x.startsWith('interaction ')) keys.add(x.replace(/\d+/g, '#'));
  return keys;
}

function passRate(f: FunctionalReport): number | null {
  if (!f.interactions.length) return null;
  const ok = f.interactions.filter((i) => i.correctPath !== 'fail' && i.incorrectPath !== 'fail').length;
  return Math.round((1000 * ok) / f.interactions.length) / 10;
}

const weight = (t: Totals) => t.critical * 1000 + t.serious * 100 + t.moderate * 10 + t.minor;

export function compareQaRuns(before: QaRun, after: QaRun): RegressionReport {
  const b = failureKeys(before.functional);
  const a = failureKeys(after.functional);
  const newFailures = [...a].filter((k) => !b.has(k)).sort();
  const fixedFailures = [...b].filter((k) => !a.has(k)).sort();
  const tb = before.accessibility.totals;
  const ta = after.accessibility.totals;
  const rb = passRate(before.functional);
  const ra = passRate(after.functional);
  const worse = newFailures.length > 0 || weight(ta) > weight(tb) || (rb !== null && ra !== null && ra < rb);
  const better = fixedFailures.length > 0 || weight(ta) < weight(tb) || (rb !== null && ra !== null && ra > rb);
  return {
    newFailures,
    fixedFailures,
    a11y: { before: tb, after: ta },
    interactionPassRate: { before: rb, after: ra },
    verdict: worse ? 'regressed' : better ? 'improved' : 'unchanged',
  };
}

export function regressionMarkdown(r: RegressionReport): string {
  const row = (k: keyof Totals) => `| ${k} | ${r.a11y.before[k]} | ${r.a11y.after[k]} |`;
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- none');
  return [
    `# QA regression report`,
    '',
    `**Verdict:** ${r.verdict}`,
    '',
    '## Accessibility violations (rule × screen)',
    '',
    '| impact | before | after |',
    '|---|---|---|',
    row('critical'),
    row('serious'),
    row('moderate'),
    row('minor'),
    '',
    `## Interaction pass rate`,
    '',
    `${r.interactionPassRate.before ?? 'n/a'}% → ${r.interactionPassRate.after ?? 'n/a'}%`,
    '',
    '## New failures',
    '',
    list(r.newFailures),
    '',
    '## Fixed failures',
    '',
    list(r.fixedFailures),
    '',
  ].join('\n');
}
