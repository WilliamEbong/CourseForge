/**
 * Release reports: `qa-report.md`, `source-report.md`, `release-manifest.json`. Pure and deterministic.
 */
import { SEVERITIES } from '../core/enums.js';
import type { Citation, ClaimRecord, SourceRecord } from '../core/schemas/content.js';
import type { CourseModel } from '../core/schemas/model.js';
import {
  type AccessibilityReport,
  type BuildReport,
  type FunctionalReport,
  type ReleaseDecision,
  type ReleaseManifest,
  ReleaseManifestSchema,
} from '../core/schemas/reports.js';
import type { Finding } from '../core/schemas/review.js';
import { compareFindings } from '../review/adjudicate.js';
import { UNRESOLVED_STATUSES } from '../review/findings.js';
import { cell } from '../review/report.js';

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const yn = (v: boolean | null) => (v === null ? 'not checked' : v ? 'pass' : 'fail');
const IMPACT_RANK: Record<string, number> = { critical: 3, serious: 2, moderate: 1, minor: 0 };

function decisionLines(decision: ReleaseDecision): string[] {
  const L = [`**Decision: ${decision.decision.toUpperCase()}**`, ''];
  if (decision.reasons.length > 0) {
    L.push('| Code | Detail | Findings |', '|---|---|---|');
    for (const r of decision.reasons) L.push(`| ${r.code} | ${cell(r.detail)} | ${cell(r.findingIds.join(', '))} |`);
    L.push('');
  }
  return L;
}

export function qaReportMarkdown(input: {
  model: CourseModel | null;
  functional: FunctionalReport | null;
  accessibility: AccessibilityReport | null;
  build: BuildReport | null;
  findings: readonly Finding[];
  decision: ReleaseDecision;
  screenshots: readonly { screenId: string; viewport: number; path: string }[];
  courseTitle: string;
  releaseVersion: string;
}): string {
  const { model, functional: fn, accessibility: ax, build } = input;
  const L: string[] = [`# QA report — ${input.courseTitle}`, '', `Release version: ${input.releaseVersion}`, ''];
  L.push('## Release decision', '', ...decisionLines(input.decision));

  L.push('## Structure', '');
  const counts: [string, number][] = model
    ? [
        ['Objectives', model.objectives.length],
        ['Modules', model.modules.length],
        ['Screens', model.screens.length],
        ['Interactions', model.screens.filter((s) => s.interaction).length],
        ['Graded items', model.screens.filter((s) => s.graded).length],
        ['Visuals', model.visuals.length],
        ['Glossary entries', model.glossary.length],
        ['References', model.references.length],
      ]
    : build
      ? Object.entries(build.counts)
      : [];
  if (counts.length === 0) L.push('No course model or build report available.', '');
  else L.push('| Item | Count |', '|---|---|', ...counts.map(([k, v]) => `| ${k} | ${v} |`), '');

  L.push('## Functional results', '');
  if (!fn) L.push('Functional QA report not available.', '');
  else {
    const okScreens = fn.screens.filter((s) => s.ok).length;
    L.push(
      `Overall: **${fn.summary.pass ? 'PASS' : 'FAIL'}** · mode ${fn.mode} · profile ${fn.profile} · viewports ${fn.viewports.join(', ')}`,
      '',
      '| Check | Result |',
      '|---|---|',
      `| Screens rendered without error | ${okScreens}/${fn.screens.length} |`,
      `| Navigation | ${yn(fn.navigation.ok)} — ${cell(fn.navigation.detail)} |`,
      `| Resources (glossary/references) | ${yn(fn.resources.ok)} — ${cell(fn.resources.detail)} |`,
      `| Progress persisted / reset | ${yn(fn.progress.persisted)} / ${yn(fn.progress.resetOk)} |`,
      `| Keyboard / visible focus | ${yn(fn.keyboard.ok)} / ${yn(fn.keyboard.focusVisible)} |`,
      `| Offline (blocked external requests) | ${fn.offline.blockedRequests.length} |`,
      `| Console errors | ${fn.consoleErrors.length} |`,
      '',
    );
    if (fn.summary.failures.length) L.push('Failures:', '', ...fn.summary.failures.map((f) => `- ${f}`), '');

    L.push('### Interactions', '');
    const tally = (k: 'correctPath' | 'incorrectPath') => {
      const run = fn.interactions.filter((i) => i[k] !== 'skipped');
      const pass = run.filter((i) => i[k] === 'pass').length;
      return `${pass}/${run.length}${run.length ? ` (${Math.round((pass / run.length) * 100)}%)` : ''}`;
    };
    L.push(
      `Interactions tested: ${fn.interactions.length} · correct path pass rate ${tally('correctPath')} · incorrect path pass rate ${tally('incorrectPath')}`,
      '',
    );
    const failed = fn.interactions.filter((i) => i.correctPath === 'fail' || i.incorrectPath === 'fail');
    if (failed.length) {
      L.push('| Interaction | Mode | Correct | Incorrect | Detail |', '|---|---|---|---|---|');
      for (const i of failed) L.push(`| ${i.id} | ${i.mode} | ${i.correctPath} | ${i.incorrectPath} | ${cell(i.detail)} |`);
      L.push('');
    }

    L.push('### Scoring check', '');
    L.push(
      fn.scoring.checked
        ? `${fn.scoring.ok ? 'Pass' : 'Fail'}: expected ${fn.scoring.expectedPercent ?? 'n/a'}%, actual ${fn.scoring.actualPercent ?? 'n/a'}%`
        : 'Scoring was not checked.',
      '',
    );
  }

  L.push('## Accessibility', '');
  if (!ax) L.push('Accessibility report not available.', '');
  else {
    L.push(
      `Engine: ${ax.engine} · tags: ${ax.tags.join(', ')} · screens scanned: ${ax.screens.length}`,
      '',
      '| Impact | Violations |',
      '|---|---|',
      `| critical | ${ax.totals.critical} |`,
      `| serious | ${ax.totals.serious} |`,
      `| moderate | ${ax.totals.moderate} |`,
      `| minor | ${ax.totals.minor} |`,
      '',
    );
    const rules = new Map<string, { impact: string; help: string; nodes: number; screens: Set<string> }>();
    for (const s of ax.screens) {
      for (const v of s.violations) {
        const r = rules.get(v.id) ?? { impact: v.impact ?? 'unknown', help: v.help, nodes: 0, screens: new Set<string>() };
        r.nodes += v.nodes.length;
        r.screens.add(s.id);
        rules.set(v.id, r);
      }
    }
    const top = [...rules]
      .sort(([ia, a], [ib, b]) => (IMPACT_RANK[b.impact] ?? -1) - (IMPACT_RANK[a.impact] ?? -1) || b.nodes - a.nodes || cmp(ia, ib))
      .slice(0, 10);
    if (top.length) {
      L.push('### Top violations', '', '| Rule | Impact | Nodes | Screens | Help |', '|---|---|---|---|---|');
      for (const [id, r] of top) L.push(`| ${id} | ${r.impact} | ${r.nodes} | ${r.screens.size} | ${cell(r.help)} |`);
      L.push('');
    }
  }

  if (build) {
    L.push('## Build checks', '', '| Check | Result | Detail |', '|---|---|---|');
    for (const c of build.checks) L.push(`| ${c.id} | ${c.pass ? 'pass' : 'fail'} | ${cell(c.detail)} |`);
    L.push('', `Output: ${build.bytes} bytes · ${build.outputHash}`, '');
  }

  L.push('## Responsive screenshots', '');
  const shots = [...input.screenshots].sort((a, b) => cmp(a.screenId, b.screenId) || a.viewport - b.viewport);
  if (shots.length === 0) L.push('No screenshots captured.', '');
  else L.push('| Screen | Viewport | File |', '|---|---|---|', ...shots.map((s) => `| ${s.screenId} | ${s.viewport} | ${s.path} |`), '');

  L.push('## Open findings', '');
  const open = input.findings.filter((f) => UNRESOLVED_STATUSES.includes(f.status)).sort(compareFindings);
  if (open.length === 0) L.push('No unresolved findings.', '');
  for (const sev of SEVERITIES) {
    const group = open.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    L.push(`### ${sev} (${group.length})`, '', '| ID | Location | Category | Problem | Status |', '|---|---|---|---|---|');
    for (const f of group) L.push(`| ${f.findingId} | ${cell(f.location)} | ${f.category} | ${cell(f.problem)} | ${f.status} |`);
    L.push('');
  }

  L.push(
    '## Known limitations',
    '',
    '- Automated accessibility testing (axe-core) detects only a subset of WCAG failures; it is not a formal accessibility audit or conformance claim.',
    '- External links were not followed: QA runs offline, so link targets need a separate networked check.',
    '- Content accuracy is as of the source dates listed in the source report; regulations and guidance may have changed since.',
  );
  const flags = (model?.references ?? []).filter((r) => r.currentnessNotes).sort((a, b) => cmp(a.id, b.id));
  if (flags.length) {
    L.push('', '### Currentness flags', '');
    for (const r of flags) L.push(`- ${r.id} (${r.title}): ${(r.currentnessNotes ?? '').replace(/\r?\n/g, ' ')}`);
  }
  return `${L.join('\n').trimEnd()}\n`;
}

export function sourceReportMarkdown(input: {
  references: readonly SourceRecord[];
  claims: readonly ClaimRecord[];
  screens: readonly { id: string; title: string; citations: readonly Citation[] }[];
  traceSummary: ReleaseManifest['trace'] | null;
}): string {
  const refs = [...input.references].sort((a, b) => cmp(a.id, b.id));
  const known = new Set(refs.map((r) => r.id));
  const claimsBy = new Map<string, Set<string>>();
  const screensBy = new Map<string, Set<string>>();
  const dangling = new Set<string>();
  const index = (m: Map<string, Set<string>>, src: string, who: string) => {
    if (!known.has(src)) dangling.add(`${src} (cited by ${who})`);
    m.set(src, (m.get(src) ?? new Set()).add(who));
  };
  for (const c of input.claims) for (const ct of c.citations) index(claimsBy, ct.sourceId, c.id);
  for (const s of input.screens) for (const ct of s.citations) index(screensBy, ct.sourceId, s.id);
  for (const d of input.traceSummary?.danglingReferences ?? []) dangling.add(d);

  const L: string[] = ['# Source report', ''];
  L.push(
    `Sources: ${refs.length} · Claims: ${input.claims.length} · Screens citing sources: ${input.screens.filter((s) => s.citations.length).length}`,
    '',
  );
  const t = input.traceSummary;
  if (t) {
    L.push(
      '## Traceability',
      '',
      `- Objectives: ${t.objectives} (assessed: ${t.assessedObjectives})`,
      `- Screens: ${t.screens}`,
      `- Sources cited: ${t.sourcesCited}`,
      `- Unassessed objectives: ${t.unassessedObjectives.length ? t.unassessedObjectives.join(', ') : 'none'}`,
      '',
    );
  }

  L.push('## Sources', '');
  if (refs.length === 0) L.push('No sources recorded.', '');
  for (const r of refs) {
    const list = (m: Map<string, Set<string>>) => [...(m.get(r.id) ?? [])].sort().join(', ') || 'none';
    L.push(`### ${r.id} — ${r.title}`, '', '| Field | Value |', '|---|---|');
    const fields: [string, string | null][] = [
      ['Author', r.author],
      ['Publisher', r.publisher],
      ['Type', r.type],
      ['Authority', r.authority],
      ['Date', r.date],
      ['Version', r.version],
      ['Accessed', r.accessed],
      ['Jurisdiction', r.jurisdiction],
      ['URL', r.url],
      ['DOI', r.doi],
      ['Currentness notes', r.currentnessNotes],
      ['Licence notes', r.licenseNotes],
    ];
    for (const [k, v] of fields) if (v) L.push(`| ${k} | ${cell(v)} |`);
    L.push('', `Cited by claims: ${list(claimsBy)}`, '', `Cited on screens: ${list(screensBy)}`, '');
  }

  L.push('## Uncited sources', '');
  const uncited = refs.filter((r) => !claimsBy.has(r.id) && !screensBy.has(r.id)).map((r) => r.id);
  L.push(uncited.length ? uncited.map((id) => `- ${id}`).join('\n') : 'None.', '');

  L.push('## Dangling citations', '');
  L.push(
    dangling.size
      ? [...dangling]
          .sort()
          .map((d) => `- ${d}`)
          .join('\n')
      : 'None.',
    '',
  );

  L.push('## Caveats', '');
  const caveats = refs.filter((r) => r.currentnessNotes || r.licenseNotes);
  if (caveats.length === 0) L.push('None recorded.');
  for (const r of caveats) {
    if (r.currentnessNotes) L.push(`- ${r.id}: ${r.currentnessNotes.replace(/\r?\n/g, ' ')}`);
    if (r.licenseNotes) L.push(`- ${r.id} (licence): ${r.licenseNotes.replace(/\r?\n/g, ' ')}`);
  }
  return `${L.join('\n').trimEnd()}\n`;
}

/** Schema-validated release manifest; the caller supplies every value (no clock here). */
export function buildReleaseManifest(input: Omit<ReleaseManifest, 'schemaVersion'>): ReleaseManifest {
  return ReleaseManifestSchema.parse({ schemaVersion: 1, ...input });
}
