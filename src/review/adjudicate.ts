/**
 * Deterministic pre-adjudication (dedupe, human decisions, lock conflicts, contradiction heuristics) and
 * application of the optional AI adjudicator's verdicts. Pure.
 */
import { CONFIDENCE_LEVELS, SEVERITY_RANK, type Severity } from '../core/enums.js';
import type { AdjudicationAgent, Finding } from '../core/schemas/review.js';

export interface PreAdjudication {
  findings: Finding[];
  /** duplicate id → kept id */
  mergedAway: Record<string, string>;
  lockConflicts: { findingId: string; targetId: string }[];
  contradictions: { findingIds: string[]; location: string; reason: string }[];
  actionable: Finding[];
  needsAI: boolean;
}

const STOP_WORDS = new Set(
  'a an the and or of to in on for with is are was were be been this that these those it its as at by from about into than then there their which who'.split(
    ' ',
  ),
);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !STOP_WORDS.has(t)),
  );
}

/** Token Jaccard similarity (lowercase words, stop-words removed). Two empty texts count as identical. */
export function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const confRank = (f: Finding) => CONFIDENCE_LEVELS.length - CONFIDENCE_LEVELS.indexOf(f.confidence);

/** Stable order: severity desc, location, category, findingId. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    cmp(a.location, b.location) ||
    cmp(a.category, b.category) ||
    cmp(a.findingId, b.findingId)
  );
}

/** Does `location` address a locked ID (exactly, or a field/child of it)? Returns that ID. */
export function lockedTarget(location: string, lockedIds: ReadonlySet<string>): string | null {
  if (lockedIds.has(location)) return location;
  for (const id of [...lockedIds].sort()) {
    if (location.startsWith(`${id}.`) || location.startsWith(`${id}/`)) return id;
  }
  return null;
}

const REMOVE = /\b(remove|removing|delete|deleting|cut|omit)\b/i;
const EXPAND = /\b(expand|expanding|add|adding|elaborate|extend)\b/i;

function merge(cluster: Finding[]): Finding {
  const [kept] = [...cluster].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || confRank(b) - confRank(a) || cmp(a.findingId, b.findingId),
  ) as [Finding];
  if (cluster.length === 1) return { ...kept };
  const others = cluster.filter((f) => f !== kept);
  const evidence = [...new Set([kept, ...others].flatMap((f) => f.evidence))];
  const mergedFrom = [...new Set([...kept.mergedFrom, ...others.flatMap((f) => [f.findingId, ...f.mergedFrom])])].sort();
  return { ...kept, evidence, mergedFrom };
}

export function preAdjudicate(
  findings: readonly Finding[],
  opts: {
    lockedIds: ReadonlySet<string>;
    humanDecisions: Record<string, 'accepted' | 'rejected'>;
    repairSeverities: readonly Severity[];
  },
): PreAdjudication {
  // Cluster in id order so the result does not depend on input order.
  const byId = [...findings].sort((a, b) => cmp(a.findingId, b.findingId));
  const clusters: Finding[][] = [];
  for (const f of byId) {
    const home = clusters.find(
      (c) =>
        c[0]?.artifactId === f.artifactId &&
        c[0]?.location === f.location &&
        c[0]?.category === f.category &&
        c.some((m) => jaccard(m.problem, f.problem) >= 0.8),
    );
    if (home) home.push(f);
    else clusters.push([f]);
  }

  const mergedAway: Record<string, string> = {};
  const merged = clusters.map((c) => {
    const m = merge(c);
    for (const f of c) if (f.findingId !== m.findingId) mergedAway[f.findingId] = m.findingId;
    const decision = [m.findingId, ...m.mergedFrom].map((id) => opts.humanDecisions[id]).find((d) => d !== undefined);
    if (decision) m.status = decision;
    return m;
  });
  merged.sort(compareFindings);

  const lockConflicts: PreAdjudication['lockConflicts'] = [];
  const actionable: Finding[] = [];
  for (const f of merged) {
    if ((f.status !== 'open' && f.status !== 'accepted') || !opts.repairSeverities.includes(f.severity)) continue;
    const target = lockedTarget(f.location, opts.lockedIds);
    if (target) lockConflicts.push({ findingId: f.findingId, targetId: target });
    else actionable.push(f);
  }

  const contradictions: PreAdjudication['contradictions'] = [];
  for (let i = 0; i < actionable.length; i++) {
    for (let j = i + 1; j < actionable.length; j++) {
      const a = actionable[i] as Finding;
      const b = actionable[j] as Finding;
      if (a.location !== b.location) continue;
      const opposed =
        (REMOVE.test(a.recommendedAction) && EXPAND.test(b.recommendedAction)) ||
        (EXPAND.test(a.recommendedAction) && REMOVE.test(b.recommendedAction));
      const divergent = a.category !== b.category && jaccard(a.recommendedAction, b.recommendedAction) < 0.2;
      if (opposed || divergent) {
        contradictions.push({
          findingIds: [a.findingId, b.findingId].sort(),
          location: a.location,
          reason: opposed ? 'one recommends removing content, the other expanding it' : 'divergent recommendations across categories',
        });
      }
    }
  }
  contradictions.sort((a, b) => cmp(a.location, b.location) || cmp(a.findingIds.join(), b.findingIds.join()));

  const needsAI =
    contradictions.length > 0 || actionable.some((f) => f.confidence === 'low' || f.severity === 'blocker' || f.severity === 'critical');

  return { findings: merged, mergedAway, lockConflicts, contradictions, actionable, needsAI };
}

export function applyAdjudication(
  pre: PreAdjudication,
  agent: AdjudicationAgent | null,
): { findings: Finding[]; warnings: string[]; instructions: Record<string, string> } {
  const findings = pre.findings.map((f) => ({ ...f }));
  const warnings: string[] = [];
  const instructions: Record<string, string> = {};
  for (const d of agent?.decisions ?? []) {
    const id = pre.mergedAway[d.findingId] ?? d.findingId;
    const f = findings.find((x) => x.findingId === id);
    if (!f) {
      warnings.push(`adjudicator referenced unknown finding ${d.findingId}; ignored`);
      continue;
    }
    if (d.verdict === 'accept') {
      f.status = 'accepted';
      f.severity = d.finalSeverity;
      if (d.repairInstruction) instructions[id] = d.repairInstruction;
    } else {
      f.status = d.verdict === 'reject' ? 'rejected' : 'deferred';
    }
  }
  findings.sort(compareFindings);
  return { findings, warnings, instructions };
}
