# Setup and learner result tracking

How the setup wizard, the tracking settings and the three result destinations fit together. The user-facing
description is in [Tracking learner results](../user-guide/tracking.md). The decision to relax the offline
invariant is recorded in [ADR 0013](../adr/0013-optional-tracking.md).

## Setup (`src/cli/wizard.ts`, `src/pipeline/setup.ts`)

- All wording (stage descriptions, questions, choices and messages) lives in `config/guidance.json`, validated by
  `GuidanceConfigSchema`. `crossCheck` requires every choice value to be a code that the program understands.
- `runWizard` is a pure function over an injected `ask`/`write`. The CLI supplies a `node:readline/promises`
  reader, and only when stdin and stdout are both terminals and neither `--json` nor `--defaults` is given.
  Tests pass scripted replies (`MainOverrides.ask`).
- The answers (`SetupAnswers`) map onto `course.yaml`: `course.language`, `course.audience`, `human_review`
  (empty = policy defaults, or `human` for every stage) and `tracking`. `setup.configured_at` records when
  they were given. `new`/`ingest` apply them inside `createCourse`. `configure` applies them to an existing
  course under the course lock.
- `writeGuides` copies the instruction templates for the chosen destination from `config/guidance/` into
  `courses/<id>/tracking/`, filling in `{{…}}` placeholders, and removes the ones left over from a previous
  choice.
- If `effectiveTracking()` changed, `configure` calls `invalidateStages` (shared with the stage loop) on
  COURSE_BUILD, COURSE_QA and RELEASE. Content stages are never touched, because tracking is not part of the
  course model.

## Build and QA

`effectiveTracking(manifest)` returns null for `none`, and for a web destination whose address is still
missing. `trackingOrigins()` turns the result into the CSP `connect-src` list. The renderer
(`RenderOptions.tracking`), `checkSingleFile` (via `buildChecks`) and QA (`runQa({ tracking })`) all use the same
function. The runtime side and the QA checks are described in [Course runtime](course-runtime.md) and
[QA](qa.md).

## Destinations

| `tracking.destination` | Runtime | Delivered by |
|---|---|---|
| `none` | Tracking code inactive; no `tracking` in `cf-data` | — |
| `lms` | SCORM 1.2 `API` in the LMS frame | `release/course-scorm.zip`, written by RELEASE (`src/pipeline/scorm.ts`), or `package --scorm` |
| `sheet` | One `no-cors` POST per result to the Apps Script web app | `config/guidance/google-apps-script.gs.txt`, which appends rows, keeps a Summary tab and neutralises formula-like text |
| `tracker` | One `no-cors` POST per result to `/api/events` | `courseforge tracker` (`src/tracker/`) |

## The results server (`src/tracker/`)

- `server.ts` runs a `node:http` server. `POST /api/events` needs no login. It accepts at most 8 KB, must
  validate as a `TrackingEvent`, and is limited to 60 per minute per client address; it sends
  `Access-Control-Allow-Origin: *` because courses may be opened from `file://`. `GET /`, `/api/events` and
  `/api/events.csv` need HTTP Basic auth with `COURSEFORGE_TRACKER_PASSWORD`. The password is compared as
  SHA-256 digests with `timingSafeEqual`, and the server refuses to start without one.
- `store.ts` appends one JSON line per result (`results.jsonl`, default `.courseforge/tracker/`). Reading skips
  damaged lines. Summaries count each person (name + staff number + email) once per course, using their best
  result, and ignore setup tests. CSV cells are always quoted, and a leading `= + - @` is prefixed with `'`.
- `dashboard.ts` renders the page on the server with no script. Every learner-typed value is escaped, and the
  page's CSP is `default-src 'none'` with a per-response style nonce.
- The server speaks plain HTTP only. Internet use needs an HTTPS reverse proxy, and courses refuse non-HTTPS
  addresses other than `localhost`.
