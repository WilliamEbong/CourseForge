# Setup wizard and optional completion/score tracking — Implementation Plan

Deviations from the v1 plan are recorded in [ADR 0013](../../adr/0013-optional-tracking.md).

## Context

Organisations that deploy a CourseForge course want to see which staff completed it, their score and the
date. Today a course is one offline HTML file: no learner identity, no network (`connect-src 'none'` CSP,
enforced by `checkSingleFile`, QA and the release gate), score computed only in the browser
(`summarize()` in `components/course-ui/src/runtime/grade.ts`). CourseForge also has no guided setup: every
option is a CLI flag or a hand-edited `course.yaml`, which does not suit non-technical users who do not know
e-learning jargon.

Outcome: (1) a plain-language terminal wizard that runs first whenever a course enters CourseForge at any
stage, re-runnable via `configure` / `reconfigure`; (2) optional tracking with three destinations chosen in
the wizard; (3) where the system cannot act for the user (Google account, LMS upload, hosting) it generates
click-by-click instruction files. Tracking off = byte-for-byte today's behaviour.

## Decisions (locked with the user)

- Terminal wizard (`node:readline/promises`), no new dependencies. ≤ 1 minute, every question has an
  Enter-to-accept default. Runs only when interactive (stdin + stdout TTY, no `--json`, no `--defaults`);
  otherwise defaults apply silently.
- Destinations, jargon-free labels: *Don't track* · *My organisation already has a training system* (SCORM
  1.2) · *Send results to a Google Sheet* (Apps Script web app) · *Run our own results dashboard*
  (self-hosted tracker).
- Learner identity is asked **at the end**, inline beside a "Record my result" button — not in a start
  dialog. Not asked for the LMS destination (the LMS knows the learner).
- Identity fields are **chosen by the author in the wizard**: name / name + staff ID / name + email.
- All four phases are in scope; each phase ships independently with all checks green.
- Every attempt is recorded as its own row; consumers (sheet summary tab, dashboard) derive latest/best.
- Scores are client-side and forgeable (answer keys are in the HTML). Acceptable for compliance tracking;
  say so in the docs and in the wizard blurb.

## Autonomy rules for the build session

The build runs unattended. Make judgement calls and keep going; record each non-obvious call as one line
under "Judgement calls" in `docs/exec-plans/active/tracking-and-setup-wizard.md`. Prefer the simpler,
reversible option. Return to the user **only** if: a non-negotiable in `CLAUDE.md` would have to be broken;
a destructive or outward-facing action is needed (push, publish, deleting course data, real Google/LMS
accounts); or all checks cannot be made green after root-cause debugging. Live verification against a real
Google Sheet / LMS is *not* a blocker — ship the offline-tested code and list the manual live checks in the
execution record. Do not commit unless asked (repo rule); leave the tree ready to commit per phase. Do not
run `npm install`. Never run e2e/browser tests concurrently with other browser work (limited RAM). Use
context7 to confirm current Apps Script web-app POST/redirect/CORS behaviour and SCORM 1.2 data-model names
before coding them.

## Design

**Config, not content.** New `course.yaml` blocks in `CourseManifestSchema` (`src/core/schemas/course.ts`):

```yaml
tracking: { destination: none|lms|sheet|tracker, endpoint: <url|null>,
            identity: name|name_and_id|name_and_email, id_label: <string|null> }
setup:    { configured_at: <iso|null> }
```

All defaulted (destination `none`). Export a pure `effectiveTracking(manifest)` → `null` when destination is
`none`, or when `sheet`/`tracker` has no endpoint yet ("unfinished": build behaves as untracked, `status`
and build output show a nudge). Tracking is threaded through **`RenderOptions.tracking`**
(`src/renderer/compile.ts`) → `courseData(model, tracking)` (`components/course-ui/src/components/shell.ts`)
→ `CfData.tracking` (`runtime/types.ts`). It is **not** added to `CourseModel`, so reconfiguring invalidates
COURSE_BUILD and downstream only.

**Offline invariant (ADR 0013).** For `sheet`/`tracker`, `contentSecurityPolicy()` emits `connect-src` with
exactly the declared origin(s) (Apps Script: `https://script.google.com` plus its redirect host
`https://script.googleusercontent.com` — confirm via docs). `checkSingleFile(html, { allowedConnect })`
accepts `'none'` or exactly that list; everything else in the check is unchanged. QA
(`src/qa/browser.ts`) gets `stubOrigins`: requests to those origins are fulfilled `204` and recorded in
`session.tracked`; all other requests are still aborted and remain a critical finding. `lms` needs no CSP
change.

**Runtime** (`components/course-ui/src/runtime/track.ts`, new, wired from `app.ts`). Completion =
`summary.percent !== null` when graded items exist, else `progressPercent() === 100`. A pre-rendered,
initially `hidden` record panel (shell/screens component, rendered only when tracking is on; labelled
inputs per `identity`, a button, an `aria-live` status line; **no `<form>` submit** because of
`form-action 'none'`) is shown when complete and the current screen is the results screen
(`<module>-RESULTS`, exists only when there are graded items — `src/pipeline/compile/model.ts:66-90`) or,
for ungraded courses, the last screen. Event:
`{v:1, courseId, courseVersion, learner:{name,id?,email?}, percent|null, passed|null, correct, total, completedAt, attempt}`.
Senders: `sheet`/`tracker` → `fetch(endpoint, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body})`;
failures keep the event in `store.prefs` (`cf:track:pending`) and retry on next load + a Retry button.
`lms` → SCORM 1.2 adapter: find `API` by walking `window.parent`/`opener` in try/catch; `LMSInitialize`;
set `cmi.core.lesson_status` (`incomplete` on first load; `passed`/`failed`, or `completed` when ungraded),
`cmi.core.score.raw/min/max`; `LMSCommit`; `LMSFinish` on `pagehide`. No API found → status line says the
result could not be reported; the course still works.

**Wizard.** `src/cli/wizard.ts`: pure `runWizard({ guidance, current, ask, write }) → SetupAnswers`, driven
entirely by `config/guidance.json` (no prose in TypeScript). Questions: course language · who it is for ·
how much human checking (*Recommended* → leave `human_review` empty so `src/routing/gates.ts` policy
applies; *I'll check every step* → `human` for all stages; *As little as possible* → `auto`, risk floors
still apply) · track results? / where → (if sheet/tracker) identity fields → (sheet) paste URL now or Enter
to finish later. `CliIo` (`src/cli/main.ts`) gains optional `stdin`; tests pass a scripted `ask`.

**Guided setup files** written to `courses/<id>/tracking/` by `configure`, from data templates in
`config/guidance/` (`google-sheet-setup.md`, `google-apps-script.gs.txt`, `lms-upload.md`,
`own-dashboard.md`, `imsmanifest.xml.tmpl`), with simple `{{var}}` substitution. Instructions are
click-by-click, no jargon, and honest (own dashboard: internet use needs HTTPS and an IT person; pages
served over https cannot post to an http tracker). The Apps Script appends a row per event and creates a
"Summary" tab (completions, pass rate, average score) — that is the Sheet option's dashboard. When a Sheet
URL is pasted, validate `^https://script\.google\.com/macros/s/[\w-]+/exec$` and send a test row via an
injected `fetch`.

## Phases

**P0 — records.** Copy this plan to `docs/exec-plans/active/tracking-and-setup-wizard.md` (add a
"Judgement calls" section). Add `docs/adr/0013-optional-tracking-relaxes-offline-invariant.md`
(Context/Decision/Consequences; also supersedes the SCORM deferral in ADR 0012) and index it in
`docs/adr/README.md`. No new acceptance IDs (`docs/bootstrap/` is read-only and `scripts/acceptance.mjs`
hard-codes A–L); existing tags stay on tests that already carry them.

**P1 — guidance registry, schema, wizard, configure.**
- `src/core/schemas/course.ts`: `tracking`, `setup`, `effectiveTracking`. `npm run gen:schemas`.
- `config/guidance.json` + `GuidanceConfigSchema` in `src/core/schemas/registry.ts` (strict object,
  `version: 1`; `stages` keyed by all 11 stages → `{name, blurb, next}`; `questions` → `{prompt, help,
  options[{value,label,blurb}]}`; `messages`). Register in `SCHEMAS` (`src/core/schemas/index.ts`), `FILES`
  / `Registries` / `crossCheck` in `src/routing/registries.ts` (every stage present; option values match
  the closed enums). Update filename list in `tests/unit/config/config.test.ts`.
- `src/pipeline/api.ts` + `impl.ts`: `newCourse`/`ingest` accept `setup?: SetupAnswers` applied inside
  `createCourse` (impl.ts:112-136); `ingestTarget({file, courseId}) → {id, isNew}` (extract the existing
  id/isNew logic, impl.ts:202-215); `configure({courseId, answers})` → save manifest, write guided files,
  and if `effectiveTracking` changed invalidate COURSE_BUILD/COURSE_QA/RELEASE. Export and reuse
  `invalidateDownstream` semantics from `src/pipeline/run-stage.ts:222-247` (handles human-approved stages)
  rather than copying the simpler loop at impl.ts:290-296; take the course lock via `acquireLock`.
- `src/cli/main.ts`: `configure`, `reconfigure` (alias), `--defaults` on `new`/`ingest`; wizard hook before
  `newCourse`/`ingest`; after `ingest` print the landing stage's `blurb` + `next`. `status` shows an
  "unconfigured" / "tracking setup unfinished" nudge. `src/cli/help.ts` + `docs/user-guide/cli.md`
  (enforced by `tests/unit/docs/readme.test.ts`), `docs/user-guide/configuration.md`,
  `docs/user-guide/quick-start.md`.
- Tests: `tests/unit/cli/wizard.test.ts` (scripted answers → answers object; Enter = defaults; invalid
  input re-asks; reconfigure preselects current), `tests/integration/cli/cli.test.ts` (non-TTY never
  prompts; `--json` never prompts; `configure` maps to api), `tests/integration/pipeline/configure.test.ts`
  (manifest written; LOCKED build → invalidated only when tracking changed; guided files written under the
  course dir), config test for guidance cross-checks.

**P2 — tracking core + Google Sheet.** `RenderOptions.tracking`, CSP, `checkSingleFile` option,
`delivery.ts` call sites (`buildCourseFiles` line ~198, `buildChecks`, release gate line ~375) pass
`effectiveTracking(ctx.manifest)`; record panel component + CSS; `runtime/track.ts`; QA `stubOrigins`,
`session.tracked`, and a contract check "completion sends exactly one well-formed event" when tracking is
on (`src/qa/contract.ts`, `run.ts`, `issues.ts`); Sheet templates + URL validation + test row. Check that
`checkKeyboard`/axe still pass with the panel present (labels, tab order after the nav controls). Tests:
unit for CSP/`checkSingleFile` both modes and event building; extend
`tests/integration/render/browser.test.ts` with a tracked render of the smoke fixture (route-fulfil the
endpoint, assert one POST body, retry after a forced failure, nothing else leaves the page; untracked render
still has `connect-src 'none'` and zero requests). Update `docs/architecture/course-runtime.md`, `qa.md`.

**P3 — LMS (SCORM 1.2).** SCORM adapter in `track.ts`; `zipEntries(entries: {name, data, mtime}[])` in
`src/pipeline/zip.ts` with `zipDirectory` refactored onto it; `packageScorm(ctx|courseId)` builds
`imsmanifest.xml` (from template; `adlcp:masteryscore` = passing percent) + `index.html` at zip root;
`package --course <id> --scorm [--out]`; RELEASE handler (`delivery.ts:394+`) writes
`release/<id>-scorm.zip` when destination is `lms` and the decision is `pass`. QA: `addInitScript` fake
`window.API`, assert call sequence/values. Tests: zip round-trip (central directory names), manifest XML
well-formed with expected identifiers, browser test with fake API. `lms-upload.md` instructions.

**P4 — own dashboard.** `src/tracker/` (`server.ts`, `store.ts`, `dashboard.html` as data) on `node:http`;
`courseforge tracker [--port 8787] [--data <dir>]` (default `localStateDir()/tracker`). `POST /api/events`
(zod-validated, 8 KB cap, in-memory per-IP rate limit, CORS for simple POST), JSONL append;
`GET /api/events`, `GET /api/events.csv`, `GET /` dashboard (table, course filter, completions, pass rate,
average, CSV export; escape all learner-supplied text) behind HTTP Basic with
`COURSEFORGE_TRACKER_PASSWORD` (refuse to start without it; constant-time compare). Tests start the server
on port 0 in-process: valid/invalid/oversize/rate-limited POST, auth required, CSV escaping (including
formula-injection prefixes `= + - @`), XSS-safe rendering. Check the dashboard in a real browser with the
playwright MCP. `own-dashboard.md` instructions; `docs/architecture/tracking.md`; wizard lists the option.

The wizard only offers destinations that exist: add each option to `config/guidance.json` in the phase
that implements it.

## Reuse

`readYaml`/`writeYaml`/`writeAtomic`/`acquireLock` (`src/core/fsx.ts`); `loadManifest`/`saveManifest`/
`loadState`/`saveState`/`transitionStage`/`logEvent`/`requireCourse` (`src/pipeline/store.ts`);
`print`/`required`/`optEnum` (`src/cli`); registry pattern of `config/fallbacks.json`; `store.prefs` KV
(`runtime/store.ts`); `context.route` + `addInitScript` patterns in `src/qa/browser.ts` and
`tests/integration/render/browser.test.ts`; `localStateDir()` (`src/core/paths.ts`).

## Risks and default calls

- Apps Script `no-cors` POST returns an opaque response: success is "request did not throw". The wizard's
  test row (sent from Node, where the response is readable) is the real confirmation. Redirect host must be
  in `connect-src`.
- SCORM API discovery fails in cross-origin frames → caught, reported in the status line.
- Toggling tracking changes QA output → `review/qa-baseline.json` comparison may read as regression; on
  invalidation caused by `configure`, reset the baseline (log the event).
- `course.yaml` endpoint is a write-only capability URL and is embedded in the HTML by design; document it,
  keep it out of logs and `--json` error output.
- Windows readline: use `terminal: false`-safe line input; no raw-mode arrow-key menus — numbered choices.
- Non-negotiables hold: provider-neutral core, `child_process` only in `proc.ts`, prompts/blurbs as data,
  course isolation (guided files under `courses/<id>/`), no secrets/emails in fixtures (use
  `learner@example.com`-free fixtures: names like "Test Learner", IDs like "S-001").

## Verification

Per phase: `npm run typecheck`, `npm run lint`, `npm test`, `npx tsx scripts/gen-schemas.ts --check`;
`npm run test:e2e` for P2–P4 (alone). End-to-end, offline with the fake harness: scripted-stdin
`new "Demo" --to release` with each destination → untracked build identical to before (CSP `'none'`);
sheet build posts once to the stubbed origin in QA and passes the release gate; `reconfigure` from sheet →
none marks build/QA/release stale and a re-run restores the offline build; `package --scorm` zip contains
`imsmanifest.xml` + `index.html`; `tracker` accepts the same event and shows it on the dashboard
(playwright MCP screenshot). Finish with `docs/exec-plans/completed/tracking-and-setup-wizard-execution-record.md`
listing results, judgement calls, and the manual live checks left for the user (real Google Sheet
deployment, one real LMS or SCORM Cloud upload, tracker behind HTTPS).

## Judgement calls

Decisions taken during the unattended build, one line each.

- Apps Script `TextOutput` responses redirect to `script.googleusercontent.com` (Apps Script Content service
  docs), so the Sheet destination allows both `https://script.google.com` and
  `https://script.googleusercontent.com` in `connect-src`.
- `course.yaml` gates can only make review stricter (strictest wins in `src/routing/gates.ts`), so the review
  question offers "only where it matters" (empty `human_review`) and "approve every step" (`human` everywhere);
  there is no "less review" option. Hand-edited mixed settings show as "keep my current custom settings".
- The wizard asks for the Sheet/dashboard address only after it has written nothing yet, so the common first-run
  answer is Enter ("finish later"); `configure` then writes the step-by-step files and the author pastes the
  address on a later `configure`. The connection test runs only when a new address is entered.
- Hand edits to `tracking` in `course.yaml` do not invalidate the build (only `configure` does); the docs say to
  rebuild with `--force`. Fingerprinting the manifest into the build was judged not worth the complexity.
- `invalidateDownstream` logic moved to `invalidateStages` in `src/pipeline/store.ts` so `configure` and the stage
  loop share one implementation (human-approved stages reopen for approval, others become SUPERSEDED).
- The QA baseline is not reset when tracking changes: the tracking contract check adds no failure keys when it
  passes, so the regression comparison is unaffected.
- `configure` without a terminal is a usage error (exit 2) rather than a silent no-op; `new`/`ingest` without a
  terminal use defaults and `status` shows a reminder.
- The record panel is one shell-level component placed after the screens and before the pager (not inside the
  results component): it serves graded and ungraded courses alike, stays hidden until the course is complete and
  the record screen is showing, and does not change the tab order QA's keyboard check walks on early screens.
- Web results are sent only when the learner presses the button, never automatically, so QA and learners who do
  not want to be recorded never trigger a request. Learner details are not remembered between sessions (shared
  computers); only an unsent result is kept for retry.
- `trackingOrigins()` for a Sheet uses the endpoint's own origin plus `script.googleusercontent.com`, so a
  hand-edited endpoint cannot silently be blocked by its own CSP.
- QA's tracking check is a failure string only (no new FunctionalReport field), keeping the report schema
  unchanged; a passing check adds nothing to the regression baseline.
- The untracked runtime bundle now contains the (inactive) tracking code, so an untracked build is not
  byte-identical to v1; its behaviour, data island and CSP are unchanged, which the tests assert.
- `package --scorm` refuses a course whose build was not made for an LMS (it would never report completion),
  and RELEASE writes `release/course-scorm.zip` automatically only for `lms`. The XSD files named in
  `xsi:schemaLocation` are not bundled; common LMSs and SCORM Cloud accept packages without them. This goes on the
  manual live-check list.
- `zipDirectory` now delegates to a new `zipEntries`; the byte layout is unchanged.
