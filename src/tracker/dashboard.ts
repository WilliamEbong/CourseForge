/**
 * The results dashboard: one server-rendered page, no JavaScript. Every learner-supplied value is escaped; the
 * page's CSP allows only its own inline style (by nonce).
 */
import { esc } from '../../components/course-ui/src/contract.js';
import type { CourseSummary, StoredResult } from './store.js';

const when = (iso: string) => iso.replace('T', ' ').replace(/:\d\d(\.\d+)?Z$/, ' UTC');
const pct = (n: number | null) => (n === null ? '–' : `${n}%`);

const STYLE = `
:root { color-scheme: light dark; --fg: #1d2330; --muted: #5b6475; --bg: #f6f7f9; --card: #fff; --line: #d9dde4; --accent: #2457c5; --ok: #1a7f45; --bad: #b3261e; }
@media (prefers-color-scheme: dark) { :root { --fg: #e8eaef; --muted: #a3abba; --bg: #14171d; --card: #1c2028; --line: #313744; --accent: #8fb0ff; --ok: #6fd39a; --bad: #ff9a90; } }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); }
main { max-width: 72rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
h2 { font-size: 1.15rem; margin: 2rem 0 .75rem; }
p { margin: 0 0 .75rem; }
.muted { color: var(--muted); }
nav { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
nav a { padding: .35rem .8rem; border: 1px solid var(--line); border-radius: 999px; color: var(--fg); text-decoration: none; background: var(--card); }
nav a[aria-current="page"] { border-color: var(--accent); color: var(--accent); font-weight: 600; }
a { color: var(--accent); }
a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: .75rem; padding: 1rem 1.1rem; }
.card h3 { margin: 0 0 .75rem; font-size: 1rem; }
.card dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .25rem 1rem; margin: 0; }
.card dt { color: var(--muted); }
.card dd { margin: 0; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
.table-wrap { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: .75rem; }
table { border-collapse: collapse; width: 100%; font-size: .95rem; }
caption { text-align: left; padding: .75rem 1rem; color: var(--muted); }
th, td { padding: .55rem 1rem; border-top: 1px solid var(--line); text-align: left; white-space: nowrap; }
th { font-weight: 600; background: color-mix(in srgb, var(--line) 35%, transparent); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.yes { color: var(--ok); font-weight: 600; }
.no { color: var(--bad); font-weight: 600; }
.tag { font-size: .8rem; color: var(--muted); }
`;

export function dashboardHtml(o: {
  results: readonly StoredResult[];
  summaries: readonly CourseSummary[];
  course: string | null;
  nonce: string;
}): string {
  const shown = [...o.results].filter((r) => !o.course || r.courseId === o.course).reverse();
  const courses = o.summaries;
  const link = (id: string | null, label: string) =>
    `<a href="/${id ? `?course=${encodeURIComponent(id)}` : ''}"${id === o.course ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  const cards = courses
    .filter((c) => !o.course || c.courseId === o.course)
    .map(
      (c, i) => `<section class="card" aria-labelledby="course-${i}"><h3 id="course-${i}">${esc(c.courseTitle || c.courseId)}</h3><dl>
<dt>People who finished</dt><dd>${c.people}</dd>
<dt>People who passed</dt><dd>${c.passRate === null ? '–' : c.passed}</dd>
<dt>Pass rate</dt><dd>${pct(c.passRate)}</dd>
<dt>Average best score</dt><dd>${pct(c.averageBest)}</dd>
<dt>Latest result</dt><dd>${esc(when(c.lastResult))}</dd>
</dl></section>`,
    )
    .join('\n');
  const rows = shown
    .map(
      (r) =>
        `<tr><td>${esc(when(r.completedAt))}</td><td>${esc(r.learner.name)}${r.test ? ' <span class="tag">(setup test)</span>' : ''}</td><td>${esc(r.learner.id ?? '')}</td><td>${esc(r.learner.email ?? '')}</td><td>${esc(r.courseTitle || r.courseId)}</td><td class="num">${pct(r.percent)}</td><td>${
          r.passed === null ? '–' : r.passed ? '<span class="yes">Yes</span>' : '<span class="no">No</span>'
        }</td><td class="num">${r.attempt}</td></tr>`,
    )
    .join('\n');
  const csv = `/api/events.csv${o.course ? `?course=${encodeURIComponent(o.course)}` : ''}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Course results</title>
<style nonce="${o.nonce}">${STYLE}</style>
</head>
<body>
<main>
<h1>Course results</h1>
<p class="muted">Each row is one finished course. People are counted once per course, using their best result.</p>
${courses.length ? `<nav aria-label="Choose a course">${link(null, 'All courses')}${courses.map((c) => link(c.courseId, c.courseTitle || c.courseId)).join('')}</nav>` : ''}
${
  courses.length
    ? `<h2>Summary</h2><div class="cards">${cards}</div>`
    : '<p>No results yet. They appear here as soon as someone finishes a course and presses <strong>Record my result</strong>.</p>'
}
<h2>All results</h2>
<p><a href="${csv}" download>Download these results as a spreadsheet (CSV)</a></p>
<div class="table-wrap"><table>
<caption>${shown.length} result${shown.length === 1 ? '' : 's'}, newest first</caption>
<thead><tr><th scope="col">Finished</th><th scope="col">Name</th><th scope="col">Staff number</th><th scope="col">Email</th><th scope="col">Course</th><th scope="col">Score</th><th scope="col">Passed</th><th scope="col">Attempt</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>
</main>
</body>
</html>
`;
}
