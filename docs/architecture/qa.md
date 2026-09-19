# QA and release gate

COURSE_QA combines deterministic browser QA with an AI review panel; RELEASE is a pure function over their
reports. Everything runs in one Playwright Chromium instance with at most two pages in flight.

## Two QA engines

| | Contract runner (`src/qa/contract.ts`) | Crawler (`src/qa/crawler.ts`) |
|---|---|---|
| Used for | Courses built by CourseForge (`id="cf-data"` present) | Arbitrary imported HTML |
| Knows | The course model, answer keys, `window.__cf`, `data-cf-*` DOM | Nothing; discovers controls by role and accessible name |
| Traversal | Every screen via real controls, `__cf.go` for speed | Linear "next" walk, then menu links, then dialog openers; states deduplicated by hash of `location.hash` + visible main text + control names; bounded (200 states, depth 40, time budget) |
| Interactions | For each item: correct path from the answer key and a mutated incorrect path; scoring all-correct / all-wrong / mixed | Reachability only, never answer correctness |
| Also checks | Navigation and menu, glossary, references and citations dialogs, progress persistence and reset, offline (non-`file:`/`data:` requests aborted and counted), console and page errors, overflow and horizontal scroll, broken images/SVG, keyboard-only traversal with visible focus, missing block IDs | Console errors, broken media, overflow, focus visibility, axe |

**Tracked builds** ([ADR 0013](../adr/0013-optional-tracking.md)). `runQa({ tracking })` passes the course's
tracking origins to the browser session as `stubOrigins`. Requests to those origins are answered locally with
`{"ok":true}` and recorded in `session.tracked`, never sent. Every other request is still blocked and counted as
offline failures. The contract runner then completes the course as a learner would, presses
**Record my result** and requires exactly one POST that validates as a `TrackingEvent`. For `lms`, it opens a
second page with a fake SCORM 1.2 `API` injected before load, and requires `LMSInitialize`, the expected
`lesson_status`, `score.raw` of 100 and `LMSCommit`.

Both run axe-core (`@axe-core/playwright`, tags wcag2a/wcag2aa/wcag21aa) per sampled screen and capture
screenshots, with `reducedMotion: 'reduce'`.

## Profiles

Selected with `COURSEFORGE_QA_PROFILE` (`smoke`, `dev` default, `release`):

| Profile | Contract runner | Crawler |
|---|---|---|
| `smoke` | 1440 px all screens; axe on 3 representative screens; 2 screenshots | 30 s budget; axe 3, shots 2 |
| `dev` | 1440 px all screens, axe + screenshots on representative screens; 390 px on up to 8 representative screens | 3 min; plus a 390 px replay |
| `release` | 1440 px all screens with axe and screenshots on all; 768 px representative; 390 px all screens, axe on representative | 10 min; plus 768 and 390 px replays |

Representative screens = the first screen of each module, of each component type and of each interaction mode.

## Outputs

`review/functional-tests.json`, `review/accessibility-review.json`, `review/screenshots/` +
`manifest.json`. The first QA run of a course is saved as `review/qa-baseline.json`; later runs (after a repair or
a rebuild of an imported course) produce `review/regression-report.json` and `.md` comparing failures, axe
violations and interaction pass rate before and after.

## From reports to findings

`qaIssues` (`src/qa/issues.ts`) turns failures into findings with source `qa` (`QA-C<cycle>-V<seq>`): functional
failures per screen, interactions that do not behave per their answer key, console errors, and axe violations
(serious/critical mapped to critical). Together with the 10-reviewer panel (which sees the model, reports and
screenshots) they go through the normal adjudication and repair loop
([review-and-repair.md](review-and-repair.md)). Repairs target the canonical storyboard and the course is rebuilt;
imported HTML without a reconstructable model is repaired `html-direct`. An imported course with a reconstructed
storyboard in `improve` mode is rebuilt through CourseForge components after the first review, then fully
re-reviewed.

## Release gate (`src/release/gate.ts`)

`releaseGate(input) → {decision: 'pass' | 'block', reasons[]}`. Pure and monotonic: more findings or failures can
only add reasons. Reason codes, in order:

| Code | Blocks when |
|---|---|
| `OPEN_BLOCKING_FINDING` | Any finding at a release-blocking severity (`blocker`, `critical`) is `open`, `accepted` or `deferred` |
| `AXE_BLOCKING_VIOLATION` | An axe violation with impact `serious` or `critical` on any screen/viewport |
| `FUNCTIONAL_FAILURE` | Functional QA did not pass, or its report is missing |
| `MISSING_ARTIFACT` | A required artifact, the accessibility report or the build report is missing |
| `CITATION_INTEGRITY` | Dangling citations or unresolved inline citations |
| `LOCK_CONFLICT` | Unresolved lock conflicts |
| `CYCLES_EXHAUSTED` | Repair cycles were exhausted with blocking findings unresolved |
| `ORIGINAL_MODIFIED` | An imported original's hash changed since ingest |
| `BUILD_CHECK_FAILED` | Any build check failed (single file, IDs, runtime deps, size, text equivalents, drag-only) |
| `HUMAN_APPROVAL_REQUIRED` | The release gate is human/hybrid and not yet approved |

Severities and axe impacts come from `config/review-policy.json`. A blocked release exits 4 and writes
`release/release-decision.json`.

## Release outputs (`src/release/reports.ts`)

`release/course.html`, `release/qa-report.md` (QA summary, open findings, axe totals, screenshots),
`release/source-report.md` (sources, citation usage, currentness and licence caveats),
`release/release-manifest.json` (file hash and size, backend and tool versions, trace coverage, gate reasons,
risk overrides) and `release/licenses/lucide-ISC.txt`.

## Tests

`tests/integration/qa/contract.test.ts`, `tests/integration/qa/detectors.test.ts`, `tests/e2e/existing/crawl.spec.ts`,
`tests/unit/release/gate.test.ts`, `tests/unit/release/reports.test.ts` (groups G, I, J, K).
