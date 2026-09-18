/** Plain-text renderings of PipelineApi results (the --json path prints the raw objects instead). */
import type { Finding, GateState, IntakeReport } from '../core/schemas/index.js';
import type { CourseSummary, RunOutcome, StatusReport } from '../pipeline/api.js';

const table = (rows: string[][]): string[] => {
  const widths = rows[0]?.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length))) ?? [];
  return rows.map((r) => `  ${r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i] ?? 0))).join('  ')}`.trimEnd());
};

export function formatOutcome(o: RunOutcome): string {
  const head = `${o.courseId}: ${o.status}${o.stoppedAt ? ` at ${o.stoppedAt}` : ''}${o.runId ? ` (run ${o.runId})` : ''}`;
  const stages = o.stages.length ? table(o.stages.map((s) => [s.stage, s.status])) : [];
  return [head, ...stages, o.message].filter(Boolean).join('\n');
}

export function formatStatus(s: StatusReport): string {
  const rows = s.stages.map((st) => [
    st.stage,
    st.status,
    st.mode,
    st.cyclesUsed ? `cycles ${st.cyclesUsed}` : '',
    st.openFindings ? `${st.openFindings} open` : '',
    st.gate?.status === 'pending' ? `gate: ${st.gate.reason}` : st.failure ? `failed: ${st.failure}` : '',
  ]);
  return [
    `${s.title} (${s.courseId}) — risk ${s.riskTier}`,
    `current ${s.currentStage} → target ${s.targetStage}${s.activeRunId ? `, run ${s.activeRunId}` : ''}`,
    ...table(rows),
    `Next: ${s.nextAction}`,
  ].join('\n');
}

export function formatCourseList(list: CourseSummary[]): string {
  if (!list.length) return 'No courses yet. Create one with: courseforge new "<title>"';
  return table([['COURSE', 'STAGE', 'STATUS', 'TITLE'], ...list.map((c) => [c.courseId, c.currentStage, c.status, c.title])]).join('\n');
}

export function formatFindings(findings: Finding[]): string {
  if (!findings.length) return 'No findings.';
  return findings.map((f) => `${f.findingId} [${f.severity}/${f.category}] ${f.status} — ${f.location}: ${f.problem}`).join('\n');
}

export function formatGate(g: GateState | null): string {
  if (!g) return 'No gate is open.';
  const lines = [`gate ${g.status} (${g.mode}, reason ${g.reason})`];
  if (g.reportPath) lines.push(`report: ${g.reportPath}`);
  for (const c of g.comments) lines.push(`  ${c.by}: ${c.text}`);
  return lines.join('\n');
}

export function formatIntake(courseId: string, r: IntakeReport): string {
  return [
    `${courseId}: imported as ${r.acceptedStage} (${r.mode}; inferred ${r.inferred.stage ?? 'unknown'}, ${r.inferred.confidence} confidence)`,
    ...r.warnings.map((w) => `  ! ${w}`),
    r.nextLegalTargets.length ? `Next legal targets: ${r.nextLegalTargets.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const formatJson = (v: unknown): string => JSON.stringify(v, null, 2);
