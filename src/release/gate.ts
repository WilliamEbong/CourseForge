/**
 * Pure release gate (plan §14). Every blocking condition yields a GateReason; `pass` iff there are none.
 * Monotonic by construction: adding findings or failures can only add reasons.
 */
import type { Severity } from '../core/enums.js';
import {
  type AccessibilityReport,
  type FunctionalReport,
  type GateReason,
  GateReasonSchema,
  type ReleaseDecision,
} from '../core/schemas/reports.js';
import type { Finding } from '../core/schemas/review.js';

export interface ReleaseGateInput {
  findings: readonly Finding[];
  policy: { releaseBlockingSeverities: readonly Severity[]; axeBlockingImpacts: readonly string[] };
  functional: FunctionalReport | null;
  accessibility: AccessibilityReport | null;
  build: { checks: readonly { id: string; pass: boolean; detail: string }[] } | null;
  requiredArtifacts: readonly string[];
  presentArtifacts: readonly string[];
  citations: { dangling: readonly string[]; unresolvedInline: readonly string[] };
  /** Finding IDs (or target IDs) of unresolved lock conflicts. */
  lockConflicts: readonly string[];
  cyclesExhaustedWithBlockers: boolean;
  originalsModified: readonly string[];
  humanApprovalPending: boolean;
  /** When true (default) a missing functional / accessibility / build report blocks release. */
  requireReports?: boolean;
}

const CODE_ORDER = GateReasonSchema.shape.code.options;
const BLOCKING_STATUSES = new Set(['open', 'accepted', 'deferred']);
const sorted = (xs: readonly string[]) => [...new Set(xs)].sort();

export function releaseGate(input: ReleaseGateInput): ReleaseDecision {
  const reasons: GateReason[] = [];
  const add = (code: GateReason['code'], detail: string, findingIds: string[] = []) => reasons.push({ code, findingIds, detail });
  const requireReports = input.requireReports ?? true;

  const blocking = input.findings.filter(
    (f) => BLOCKING_STATUSES.has(f.status) && input.policy.releaseBlockingSeverities.includes(f.severity),
  );
  if (blocking.length > 0) {
    const counts = input.policy.releaseBlockingSeverities
      .map((s) => [s, blocking.filter((f) => f.severity === s).length] as const)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `${n} ${s}`);
    add('OPEN_BLOCKING_FINDING', `Unresolved blocking findings: ${counts.join(', ')}`, sorted(blocking.map((f) => f.findingId)));
  }

  if (input.accessibility) {
    const rules = new Map<string, { impact: string; nodes: number; screens: Set<string> }>();
    for (const screen of input.accessibility.screens) {
      for (const v of screen.violations) {
        if (!v.impact || !input.policy.axeBlockingImpacts.includes(v.impact)) continue;
        const r = rules.get(v.id) ?? { impact: v.impact, nodes: 0, screens: new Set<string>() };
        r.nodes += Math.max(1, v.nodes.length);
        r.screens.add(`${screen.id}@${screen.viewport}`);
        rules.set(v.id, r);
      }
    }
    for (const [id, r] of rules) {
      add(
        'AXE_BLOCKING_VIOLATION',
        `${id} (${r.impact}): ${r.nodes} node(s) on ${r.screens.size} screen(s): ${sorted([...r.screens]).join(', ')}`,
      );
    }
  } else if (requireReports) {
    add('MISSING_ARTIFACT', 'Accessibility report missing');
  }

  if (input.functional) {
    if (!input.functional.summary.pass) {
      add('FUNCTIONAL_FAILURE', `Functional QA failed: ${input.functional.summary.failures.join('; ') || 'no detail'}`);
    }
  } else if (requireReports) {
    add('FUNCTIONAL_FAILURE', 'Functional QA report missing');
  }

  if (input.build) {
    for (const c of input.build.checks) if (!c.pass) add('BUILD_CHECK_FAILED', `${c.id}: ${c.detail}`);
  } else if (requireReports) {
    add('MISSING_ARTIFACT', 'Build report missing');
  }

  const present = new Set(input.presentArtifacts);
  for (const a of sorted(input.requiredArtifacts)) if (!present.has(a)) add('MISSING_ARTIFACT', `Required artifact missing: ${a}`);

  if (input.citations.dangling.length > 0) {
    add('CITATION_INTEGRITY', `Dangling citations: ${sorted(input.citations.dangling).join(', ')}`);
  }
  if (input.citations.unresolvedInline.length > 0) {
    add('CITATION_INTEGRITY', `Unresolved inline citations: ${sorted(input.citations.unresolvedInline).join(', ')}`);
  }

  if (input.lockConflicts.length > 0) {
    const ids = sorted(input.lockConflicts);
    add('LOCK_CONFLICT', `Unresolved lock conflicts: ${ids.join(', ')}`, ids);
  }
  if (input.cyclesExhaustedWithBlockers) add('CYCLES_EXHAUSTED', 'Repair cycles exhausted with blocking findings unresolved');
  if (input.originalsModified.length > 0) {
    add('ORIGINAL_MODIFIED', `Original files changed since ingest: ${sorted(input.originalsModified).join(', ')}`);
  }
  if (input.humanApprovalPending) add('HUMAN_APPROVAL_REQUIRED', 'Human release approval is pending');

  reasons.sort(
    (a, b) => CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code) || (a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0),
  );
  return { decision: reasons.length === 0 ? 'pass' : 'block', reasons };
}
