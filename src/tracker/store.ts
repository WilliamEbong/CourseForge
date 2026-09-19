/**
 * Results store for the self-hosted tracker: one JSON line per received result (append-only), plus the pure
 * summaries and CSV export the dashboard shows.
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, exists, readText } from '../core/fsx.js';
import { type TrackingEvent, TrackingEventSchema } from '../core/schemas/tracking.js';

export interface StoredResult extends TrackingEvent {
  receivedAt: string;
}

export function eventsFile(dataDir: string): string {
  return join(dataDir, 'results.jsonl');
}

export function appendResult(dataDir: string, event: TrackingEvent, receivedAt: string): void {
  ensureDir(dataDir);
  appendFileSync(eventsFile(dataDir), `${JSON.stringify({ ...event, receivedAt })}\n`, 'utf8');
}

/** Every stored result, oldest first. Damaged lines (e.g. a torn final write) are skipped. */
export function readResults(dataDir: string): StoredResult[] {
  const file = eventsFile(dataDir);
  if (!exists(file)) return [];
  const out: StoredResult[] = [];
  for (const line of readText(file).split('\n')) {
    if (!line.trim()) continue;
    try {
      const { receivedAt, ...event } = JSON.parse(line) as { receivedAt?: unknown };
      const ev = TrackingEventSchema.safeParse(event);
      if (ev.success && typeof receivedAt === 'string') out.push({ ...ev.data, receivedAt });
    } catch {
      /* skip */
    }
  }
  return out;
}

export interface CourseSummary {
  courseId: string;
  courseTitle: string;
  /** Distinct people (name + staff number + email) with at least one result. */
  people: number;
  /** People who passed at least once. */
  passed: number;
  /** Percentage of people with a graded result who passed; null when the course has no graded questions. */
  passRate: number | null;
  /** Average of each person's best score; null when the course has no graded questions. */
  averageBest: number | null;
  lastResult: string;
}

const personKey = (r: TrackingEvent) => [r.learner.name, r.learner.id ?? '', r.learner.email ?? ''].join('|').toLowerCase();

/** Per-course figures, counting each person once and using their best result. Setup tests are ignored. */
export function summarizeResults(results: readonly StoredResult[]): CourseSummary[] {
  const byCourse = new Map<string, StoredResult[]>();
  for (const r of results) if (!r.test) byCourse.set(r.courseId, [...(byCourse.get(r.courseId) ?? []), r]);
  return [...byCourse.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([courseId, rs]) => {
      const people = new Map<string, { passed: boolean; best: number | null }>();
      for (const r of rs) {
        const p = people.get(personKey(r)) ?? { passed: false, best: null };
        if (r.passed) p.passed = true;
        if (r.percent !== null && (p.best === null || r.percent > p.best)) p.best = r.percent;
        people.set(personKey(r), p);
      }
      const all = [...people.values()];
      const scored = all.filter((p) => p.best !== null);
      const passed = all.filter((p) => p.passed).length;
      return {
        courseId,
        courseTitle: rs.at(-1)!.courseTitle,
        people: all.length,
        passed,
        passRate: scored.length ? Math.round((100 * passed) / scored.length) : null,
        averageBest: scored.length ? Math.round(scored.reduce((n, p) => n + (p.best ?? 0), 0) / scored.length) : null,
        lastResult: rs
          .map((r) => r.receivedAt)
          .sort()
          .at(-1)!,
      };
    });
}

/** One CSV cell: quoted, and never interpreted as a spreadsheet formula when opened in Excel or Sheets. */
function cell(v: string | number | boolean | null): string {
  let s = v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const CSV_HEADERS = [
  'Received',
  'Finished at',
  'Course',
  'Course title',
  'Course version',
  'Name',
  'Staff number',
  'Email',
  'Score %',
  'Passed',
  'Correct answers',
  'Questions',
  'Attempt',
  'Setup test',
];

export function resultsCsv(results: readonly StoredResult[]): string {
  const rows = results.map((r) =>
    [
      r.receivedAt,
      r.completedAt,
      r.courseId,
      r.courseTitle,
      r.courseVersion,
      r.learner.name,
      r.learner.id,
      r.learner.email,
      r.percent,
      r.passed === null ? '' : r.passed ? 'Yes' : 'No',
      r.correct,
      r.total,
      r.attempt,
      r.test ? 'Yes' : '',
    ]
      .map(cell)
      .join(','),
  );
  return `${[CSV_HEADERS.map(cell).join(','), ...rows].join('\r\n')}\r\n`;
}
