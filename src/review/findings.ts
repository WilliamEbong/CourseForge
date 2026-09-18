/**
 * Finding normalisation: reviewer / validator / QA output → stored `Finding` records with deterministic IDs.
 */
import { type FindingCategory, SEVERITIES, type Severity, STAGE_CODES, type Stage } from '../core/enums.js';
import type { Finding, FindingSet, FindingStatus } from '../core/schemas/review.js';

/** Statuses that still count as unresolved (not fixed, waived or rejected). */
export const UNRESOLVED_STATUSES: readonly FindingStatus[] = ['open', 'accepted', 'deferred'];

export interface CheckIssue {
  checkId: string;
  severity: Severity;
  category: FindingCategory;
  location: string;
  problem: string;
  evidence?: string[];
  recommendedAction?: string;
  artifactId?: string | null;
}

const seq = (n: number) => String(n).padStart(3, '0');
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function normaliseFindings(input: {
  stage: Stage;
  cycle: number;
  reviews: { reviewer: string; artifactId: string | null; set: FindingSet }[];
}): Finding[] {
  const prefix = `${STAGE_CODES[input.stage]}-C${input.cycle}`;
  const reviews = [...input.reviews].sort((a, b) => cmp(a.reviewer, b.reviewer) || cmp(a.artifactId ?? '', b.artifactId ?? ''));
  const out: Finding[] = [];
  for (const r of reviews) {
    for (const f of r.set.findings) {
      out.push({
        findingId: `${prefix}-${seq(out.length + 1)}`,
        stage: input.stage,
        reviewer: r.reviewer,
        source: 'reviewer',
        cycle: input.cycle,
        artifactId: r.artifactId,
        severity: f.severity,
        category: f.category,
        location: f.location,
        problem: f.problem,
        evidence: [...f.evidence],
        recommendedAction: f.recommendedAction,
        confidence: f.confidence,
        status: 'open',
        mergedFrom: [],
        checkId: null,
      });
    }
  }
  return out;
}

function checkFindings(
  source: 'validator' | 'qa',
  infix: 'V' | 'Q',
  input: { stage: Stage; cycle: number; startIndex?: number; issues: CheckIssue[] },
): Finding[] {
  const start = input.startIndex ?? 0;
  return input.issues.map((i, n) => ({
    findingId: `${STAGE_CODES[input.stage]}-C${input.cycle}-${infix}${seq(start + n + 1)}`,
    stage: input.stage,
    reviewer: `${source}:${i.checkId}`,
    source,
    cycle: input.cycle,
    artifactId: i.artifactId ?? null,
    severity: i.severity,
    category: i.category,
    location: i.location,
    problem: i.problem,
    evidence: [...(i.evidence ?? [])],
    recommendedAction: i.recommendedAction ?? '',
    confidence: 'high',
    status: 'open',
    mergedFrom: [],
    checkId: i.checkId,
  }));
}

/** Deterministic validator failures as findings (`SB-C0-V001`…). `startIndex` = number already minted. */
export function validatorFindings(input: { stage: Stage; cycle: number; startIndex?: number; issues: CheckIssue[] }): Finding[] {
  return checkFindings('validator', 'V', input);
}

/** Functional / accessibility QA failures as findings (`QA-C0-Q001`…). */
export function qaFindings(input: { stage: Stage; cycle: number; startIndex?: number; issues: CheckIssue[] }): Finding[] {
  return checkFindings('qa', 'Q', input);
}

/** Unresolved findings whose severity is in `severities`. */
export function openBlocking(findings: readonly Finding[], severities: readonly Severity[]): Finding[] {
  return findings.filter((f) => UNRESOLVED_STATUSES.includes(f.status) && severities.includes(f.severity));
}

export function countBySeverity(findings: readonly Finding[]): Record<Severity, number> {
  const out = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const f of findings) out[f.severity]++;
  return out;
}
