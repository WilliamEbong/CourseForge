/** Maps QA reports to finding-shaped issues (the pipeline assigns ids/provenance). */
import type { FindingCategory, Severity } from '../core/enums.js';
import type { AccessibilityReport, FunctionalReport } from '../core/schemas/reports.js';
import { violationsByRule } from './axe.js';

export interface QaIssue {
  checkId: 'qa-functional' | 'qa-accessibility' | 'qa-responsive';
  severity: Severity;
  category: FindingCategory;
  location: string;
  problem: string;
  evidence: string[];
  recommendedAction: string;
}

export interface QaIssuePolicy {
  /** Axe impacts that are release-blocking (mapped to critical). */
  axeBlockingImpacts: readonly string[];
}

const IMPACT_SEVERITY: Record<string, Severity> = { critical: 'major', serious: 'major', moderate: 'major', minor: 'minor' };

export function qaIssues(functional: FunctionalReport, accessibility: AccessibilityReport, policy: QaIssuePolicy): QaIssue[] {
  const out: QaIssue[] = [];
  const fn = (severity: Severity, category: FindingCategory, location: string, problem: string, evidence: string[], action: string) =>
    out.push({ checkId: 'qa-functional', severity, category, location, problem, evidence, recommendedAction: action });

  // Layout and naming defects usually repeat on every screen: one issue per (viewport, element), listing screens.
  const grouped = new Map<string, { kind: 'overflow' | 'unnamed'; vp: number; what: string; ids: string[] }>();
  const group = (kind: 'overflow' | 'unnamed', vp: number, what: string, id: string) => {
    const key = `${kind}|${vp}|${what}`;
    const g = grouped.get(key) ?? { kind, vp, what, ids: [] };
    g.ids.push(id);
    grouped.set(key, g);
  };
  for (const s of functional.screens) {
    for (const m of s.missingIds) {
      fn(
        'critical',
        'functional',
        s.id,
        `Expected block id ${m} is missing from the DOM`,
        [`${s.id}@${s.viewport}`],
        'Render the block with its data-cf-block id.',
      );
    }
    const hard = s.errors.filter((e) => !e.startsWith('advisory:'));
    const unnamed = hard.filter((e) => e.startsWith('control without accessible name'));
    const other = hard.filter((e) => !unnamed.includes(e));
    if (other.length)
      fn(
        'critical',
        'functional',
        s.id,
        `Screen errors at ${s.viewport}px`,
        other.slice(0, 5),
        'Fix the runtime/page errors on this screen.',
      );
    for (const u of unnamed) group('unnamed', s.viewport, u.replace('control without accessible name: ', ''), s.id);
    for (const o of s.overflow) group('overflow', s.viewport, o, s.id);
  }
  for (const g of grouped.values()) {
    const evidence = [`screens (${g.ids.length}): ${g.ids.slice(0, 10).join(', ')}${g.ids.length > 10 ? ' …' : ''}`];
    if (g.kind === 'unnamed') {
      out.push({
        checkId: 'qa-accessibility',
        severity: 'critical',
        category: 'accessibility',
        location: g.ids[0] ?? 'global',
        problem: `Interactive control without an accessible name at ${g.vp}px: ${g.what}`,
        evidence,
        recommendedAction: 'Give every button/link visible text or an aria-label.',
      });
    } else {
      out.push({
        checkId: 'qa-responsive',
        severity: 'major',
        category: 'ui',
        location: g.ids[0] ?? 'global',
        problem: `${g.what.startsWith('clipped') ? 'Clipped content' : 'Horizontal overflow'} at ${g.vp}px: ${g.what}`,
        evidence,
        recommendedAction: 'Constrain widths (max-width, wrapping, overflow-x:auto for wide tables/code) at this viewport.',
      });
    }
  }
  for (const i of functional.interactions) {
    if (i.correctPath === 'fail' || i.incorrectPath === 'fail') {
      fn(
        'critical',
        'assessment',
        i.id,
        `Interaction (${i.mode}) does not behave per its answer key`,
        [i.detail],
        'Fix the interaction wiring or answer key.',
      );
    }
  }
  if (functional.scoring.checked && !functional.scoring.ok) {
    fn(
      'critical',
      'assessment',
      'assessment',
      'Graded scoring does not match the expected result',
      [
        `expected ${functional.scoring.expectedPercent}%`,
        `actual ${functional.scoring.actualPercent}%`,
        ...functional.summary.failures.filter((f) => f.startsWith('scoring:')),
      ],
      'Fix the scoring computation / pass threshold.',
    );
  }
  if (!functional.navigation.ok)
    fn('critical', 'functional', 'navigation', 'Navigation failure', [functional.navigation.detail], 'Fix next/prev/menu navigation.');
  if (!functional.resources.ok)
    fn(
      'critical',
      'functional',
      'resources',
      'Glossary/reference/citation dialogs failure',
      [functional.resources.detail],
      'Fix the resource dialogs.',
    );
  const prog = functional.summary.failures.filter((f) => f.startsWith('progress:'));
  if (functional.progress.persisted === false || functional.progress.resetOk === false) {
    fn('critical', 'functional', 'progress', 'Progress persistence or reset failure', prog, 'Fix progress storage / reset flow.');
  }
  if (functional.keyboard.ok === false) {
    out.push({
      checkId: 'qa-accessibility',
      severity: 'critical',
      category: 'accessibility',
      location: 'keyboard',
      problem: 'Primary controls are not keyboard operable',
      evidence: [functional.keyboard.detail],
      recommendedAction: 'Make navigation reachable with Tab and operable with Enter/Space/Arrow keys.',
    });
  }
  if (functional.keyboard.focusVisible === false) {
    out.push({
      checkId: 'qa-accessibility',
      severity: 'critical',
      category: 'accessibility',
      location: 'focus',
      problem: 'Keyboard focus is not visible on some controls',
      evidence: [functional.keyboard.detail],
      recommendedAction: 'Add a :focus-visible outline (≥2px, sufficient contrast) to all interactive elements.',
    });
  }
  if (functional.offline.blockedRequests.length) {
    fn(
      'critical',
      'functional',
      'global',
      'Course makes network requests (not self-contained/offline)',
      functional.offline.blockedRequests.slice(0, 10),
      'Inline or remove external resources.',
    );
  }
  if (functional.consoleErrors.length) {
    fn('major', 'functional', 'global', 'Console / page errors', functional.consoleErrors.slice(0, 10), 'Fix the script errors.');
  }
  for (const f of functional.summary.failures.filter((x) => /^(\d+px: )?(reachability|crawl truncated)/.test(x))) {
    fn(
      'critical',
      'functional',
      'global',
      f,
      [functional.crawl ? `${functional.crawl.states} states` : ''],
      'Make every screen reachable via its navigation controls.',
    );
  }

  for (const [rule, v] of violationsByRule(accessibility)) {
    const blocking = v.impact !== null && policy.axeBlockingImpacts.includes(v.impact);
    out.push({
      checkId: 'qa-accessibility',
      severity: blocking ? 'critical' : (IMPACT_SEVERITY[v.impact ?? 'minor'] ?? 'minor'),
      category: 'accessibility',
      location: v.screens[0] ?? 'global',
      problem: `axe ${rule} (${v.impact ?? 'unknown'}): ${v.help}`,
      evidence: [
        `screens: ${v.screens.slice(0, 8).join(', ')}${v.screens.length > 8 ? ` (+${v.screens.length - 8})` : ''}`,
        ...v.nodes,
        v.helpUrl,
      ],
      recommendedAction: `Fix per ${v.helpUrl}`,
    });
  }
  return out;
}
