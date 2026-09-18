/** Human-readable consolidated review (`review/consolidated-review.md`). Deterministic. */
import { SEVERITIES, type Stage } from '../core/enums.js';
import type { Finding, RepairPlan } from '../core/schemas/review.js';
import { compareFindings } from './adjudicate.js';

/** Escape a value for a Markdown table cell. */
export function cell(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim() || '—';
}

export function consolidatedReviewMarkdown(input: {
  stage: Stage;
  cycle: number;
  courseTitle: string;
  findings: readonly Finding[];
  plan: RepairPlan | null;
  summaries: readonly { reviewer: string; summary: string }[];
}): string {
  const findings = [...input.findings].sort(compareFindings);
  const byId = new Map(findings.map((f) => [f.findingId, f]));
  const L: string[] = [];
  L.push(
    `# Consolidated review — ${input.courseTitle}`,
    '',
    `Stage: ${input.stage} · Cycle: ${input.cycle} · Findings: ${findings.length}`,
    '',
  );

  L.push('## Summary by severity', '', '| Severity | Total | Unresolved |', '|---|---|---|');
  for (const s of SEVERITIES) {
    const all = findings.filter((f) => f.severity === s);
    const open = all.filter((f) => f.status === 'open' || f.status === 'accepted' || f.status === 'deferred');
    L.push(`| ${s} | ${all.length} | ${open.length} |`);
  }
  L.push('');

  if (input.summaries.length > 0) {
    L.push('## Reviewer summaries', '');
    for (const s of [...input.summaries].sort((a, b) => (a.reviewer < b.reviewer ? -1 : a.reviewer > b.reviewer ? 1 : 0))) {
      L.push(`- **${s.reviewer}:** ${s.summary.replace(/\r?\n/g, ' ').trim()}`);
    }
    L.push('');
  }

  L.push('## Findings', '');
  for (const s of SEVERITIES) {
    const group = findings.filter((f) => f.severity === s);
    if (group.length === 0) continue;
    L.push(`### ${s[0]?.toUpperCase()}${s.slice(1)} (${group.length})`, '');
    L.push('| ID | Reviewer | Location | Category | Problem | Recommendation | Status |', '|---|---|---|---|---|---|---|');
    for (const f of group) {
      const id = f.mergedFrom.length ? `${f.findingId} (merged: ${f.mergedFrom.join(', ')})` : f.findingId;
      L.push(
        `| ${cell(id)} | ${cell(f.reviewer)} | ${cell(f.location)} | ${f.category} | ${cell(f.problem)} | ${cell(f.recommendedAction)} | ${f.status} |`,
      );
    }
    L.push('');
  }
  if (findings.length === 0) L.push('No findings.', '');

  const plan = input.plan;
  L.push('## Repair plan', '');
  if (!plan) {
    L.push('No repair plan for this cycle.', '');
  } else {
    L.push(`Target: \`${plan.target}\` · Actions: ${plan.actions.length}`, '');
    if (plan.actions.length > 0) {
      L.push('| Action | Target | Severity | Category | Findings | Instruction |', '|---|---|---|---|---|---|');
      for (const a of plan.actions) {
        L.push(
          `| ${a.actionId} | ${cell(a.targetId)} | ${a.severity} | ${a.category} | ${a.findingIds.join(', ')} | ${cell(a.instruction)} |`,
        );
      }
      L.push('');
    }
    if (plan.unrepairable.length) L.push(`Not repairable this cycle (remain open): ${plan.unrepairable.join(', ')}`, '');
    if (plan.rejected.length) L.push(`Rejected: ${plan.rejected.join(', ')}`, '');

    L.push('## Lock conflicts', '');
    if (plan.lockConflicts.length === 0) L.push('None.', '');
    else {
      L.push('These findings target locked content and need a human decision:', '');
      for (const c of plan.lockConflicts)
        L.push(`- ${c.findingId} → locked \`${c.targetId}\`: ${byId.get(c.findingId)?.problem ?? ''}`.trimEnd());
      L.push('');
    }
  }

  const deferred = findings.filter((f) => f.status === 'deferred');
  L.push('## Deferred to human', '');
  if (deferred.length === 0) L.push('None.', '');
  else {
    for (const f of deferred) L.push(`- ${f.findingId} (${f.severity}, ${cell(f.location)}): ${cell(f.problem)}`);
    L.push('');
  }
  return `${L.join('\n').trimEnd()}\n`;
}
