# Course runtime

A released course is one HTML file (`release/course.html`, identical to `build/index.html` at release) that
works from `file://`, on an intranet, or on any static host, with no network access.

## Build pipeline (`src/renderer/compile.ts`)

`model/course.json` (zod-validated `CourseModel`) → design tokens compiled to CSS custom properties
(`components/course-ui/tokens/`) → visuals routed and rendered to inline SVG ([graphics.md](graphics.md)) →
screens rendered by the pure component functions in `components/course-ui/src/components/` → runtime bundled with
esbuild → CSS minified → everything inlined. Course data is embedded in a `<script type="application/json">`
block with `</script` escaped. Output is deterministic (sorted keys, seeded IDs, no timestamps in the body), so a
rebuild of the same model is byte-identical. `build/build-report.json` records input hashes, direction values,
per-visual renderer/fallback/repairs/bytes, contrast results, coverage counts, size breakdown and the output
hash.

Build checks (`src/renderer/checks.ts`, run as COURSE_BUILD validators and again by the release gate):

| Check | Rule |
|---|---|
| `single-file` | No external scripts, stylesheets, images, frames or CSS `url()`s; `http(s)` only in `<a href>` |
| `ids-rendered` | Every block ID in the model is present in the DOM |
| `no-runtime-deps` | No Mermaid, Vega, D3 or SVG.js runtime in the page |
| `size-budget` | Total file ≤ 1.5 MB |
| `text-equivalents` | Every figure has a non-empty, non-instructional text equivalent |
| `no-drag-only` | No interaction that can only be completed by dragging |

## Security and offline behaviour

A `Content-Security-Policy` meta tag is computed at build time from the exact inline blocks: hashes for every
`<style>` element and style attribute and for the runtime script, `connect-src 'none'`. The runtime never
fetches, never injects authored HTML (it hydrates pre-rendered DOM), and source links are ordinary learner-
initiated `<a>` elements. QA verifies that no request leaves `file:`/`data:`.

**Tracked courses** ([ADR 0013](../adr/0013-optional-tracking.md)). When `course.yaml` sets `tracking` to a Google
Sheet or a results dashboard (and gives its address), `connect-src` lists exactly that destination's origins
(`trackingOrigins()` in `src/core/schemas/course.ts`, shared by the renderer, `checkSingleFile` and QA). The only
request the course can make is one POST, sent when the learner presses **Record my result**. `lms` changes
nothing in the CSP: it talks to the LMS's SCORM 1.2 `API` object in a parent frame, without making requests.

## DOM contract

Rendered markup carries `data-cf-*` attributes so QA, traceability and tests can address it without CSS
selectors. The shared `blockAttrs()` helper (`components/course-ui/src/contract.ts`) writes the traceability set:

| Attribute | On | Value |
|---|---|---|
| `data-cf-screen` | Each screen section | Screen ID |
| `data-cf-block` | Block root | Block ID (`M2-B03`) |
| `data-cf-kind` | Block root | Block kind (`concept`, `formative`, …) |
| `data-cf-module` | Block root | Module ID |
| `data-cf-lo` | Block root | Space-separated objective IDs |
| `data-cf-claim` | Block root | Space-separated claim IDs |
| `data-cf-source` | Block root, citation links | Source IDs |
| `data-cf-visual` | Figure | Visual ID (with `data-cf-archetype`, `data-cf-renderer`, `data-cf-fallback`) |
| `data-cf-item`, `data-cf-mode`, `data-cf-graded` | Question | Item ID, interaction mode, graded flag |
| `data-cf-option`, `data-cf-submit`, `data-cf-feedback`, `data-cf-retry` | Question controls | |
| `data-cf-nav`, `data-cf-progress`, `data-cf-results`, `data-cf-announcer` | Shell | Navigation, progress, results, status announcer |

## `window.__cf`

The runtime exposes a small, versioned API used by QA and e2e tests (`CfApi` in
`components/course-ui/src/runtime/app.ts`):

```ts
interface CfApi {
  version: 1;
  courseId: string;
  screenCount(): number;
  screenIds(): string[];
  current(): { index: number; id: string };
  go(target: number | string): boolean;
  next(): boolean;
  prev(): boolean;
  getState(): { index; visited; answers; graded; progressPercent };
  reset(): void;
  resetAssessment(): void;
}
```

## Learner runtime

- Hash router `#/s/<screenId>` (works on `file://`), back/forward history, pager and module navigation drawer.
- Progress and answers persisted to `localStorage` keyed by course and schema version, wrapped in try/catch with
  an in-memory fallback; a version mismatch discards stale state. Reset for the whole course or the assessment
  only, with an in-page confirm dialog (no `window.confirm`).
- Interactions: single choice, multiple response, matching, categorisation, sequencing (keyboard-operable move
  buttons; dragging is never required), reveal. Grading is a pure `grade()` per item type
  (`components/course-ui/src/runtime/grade.ts`), shared with QA.
- Native `<dialog>` for glossary, references, citations and the mobile navigation; focus is returned to the
  opener on close.
- Result tracking (`runtime/track.ts`, tracked builds only; `cf-data` then carries `tracking`). The course is
  complete when every graded question is answered, or, if there are none, when every required screen has been
  visited. On the record screen (the results screen, or else the last screen), a pre-rendered panel
  (`[data-cf-record]`, shell component `RecordPanel`) asks for the identity fields the author chose and posts
  one `TrackingEvent` (`src/core/schemas/tracking.ts`) with `fetch(..., { mode: 'no-cors' })` as `text/plain`, a
  simple request that needs no CORS preflight. A failed send is kept in `localStorage` and retried when the
  course is next opened. Once a result is recorded, the panel shows that and does not send again until the
  learner resets or retakes. For `lms`, the runtime finds `API` through `window.parent`/`opener`, sets
  `cmi.core.lesson_status` (`incomplete` → `passed`/`failed`, or `completed` when ungraded) and
  `cmi.core.score.raw/min/max`, commits, and calls `LMSFinish` on `pagehide`. No API means a status message
  instead of an error.

## Accessibility architecture

- Focus moves to the screen heading on navigation; one persistent `role="status"` announcer reports changes
  (the screen container is not a live region).
- Visible focus styles on every control; keyboard shortcuts are ignored while typing in form controls.
- Light, dark and system themes via `prefers-color-scheme` and `data-cf-theme`; token colours are
  contrast-checked for both themes at VISUAL_DIRECTION.
- Motion only under `prefers-reduced-motion: no-preference`; a print stylesheet linearises screens.
- Every figure is `role="img"` with title, description and a linked long text equivalent.
- CSS is organised in cascade layers `cf.tokens, cf.base, cf.components, cf.utilities`.

These properties are verified by QA (axe per screen, keyboard traversal, focus visibility) but automated checks
are not a formal conformance audit.

## Tests

`tests/unit/renderer/*` (grading, tokens), `tests/integration/render/`, `tests/integration/qa/contract.test.ts`
and the e2e suite.
