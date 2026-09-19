# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Setup questions (course language, audience, review level, result tracking) asked when `new`, `ingest` or
  `make` creates a course in an interactive terminal; `configure` and `reconfigure` ask them again for a course
  at any stage. The wording lives in `config/guidance.json`.
- Optional learner result tracking per course: a SCORM 1.2 package for a training system (LMS) via
  `package --scorm`, a Google Sheet, or the self-hosted, password-protected `tracker` dashboard. Tracked builds
  allow only the destination's origins in the Content-Security-Policy. See
  [ADR 0013](docs/adr/0013-optional-tracking.md) and [tracking](docs/user-guide/tracking.md).
- Review levels (`one-shot`, `recommended`, `every-step`, `strict`). `one-shot` runs every stage unattended and
  pauses once, before release, for sign-off. `courseforge make` turns a description, documents, a half-finished
  course or an existing course into a finished one. See
  [ADR 0014](docs/adr/0014-review-levels-and-one-shot.md) and [human review](docs/user-guide/human-review.md).

### Fixed

- Tracking endpoint validation rejects addresses that contain credentials and accepts addresses without a path.
- Password attempts on the `tracker` dashboard are rate limited.
- The dashboard pass rate is calculated over people with a graded result.
- `configure` no longer resets a course's review level when custom per-stage settings exist.
- `make` shows the correct course ID in setup messages and rejects `--review` together with `--course`.
- `tracker` reports an invalid `--port` or `--host` as a usage or environment error.
- An Apps Script lock timeout returns a normal error response.

## [0.1.0] - 2026-09-18

Initial release.

### Added

- Eleven-stage pipeline from concept to released single-file HTML course, with a table-driven state machine,
  resumable runs, crash recovery, downstream invalidation and a per-course run lock.
- Deterministic router over JSON registries (`config/`): saved execution plans and a routing-decision log for
  every stage, backend, gate, reviewer, skill, tool and visual choice.
- Provider-neutral agent harness with Claude Code and Codex CLI adapters (flag-based isolation from user-global
  configuration, flag probing, failure classification, retries), a fixture-driven fake harness and a scrubbing
  recorder.
- Reviewer panels per stage (41 reviewers registered; 36 active, 5 learner-perspective reviewers disabled by default),
  deterministic pre-adjudication, optional AI adjudication, byte-stable repair plans, ID-scoped repair with lock
  protection, write audit with rollback, and capped repair cycles.
- Human gates (`auto`, `hybrid`, `human`) per stage, course and run, with risk-tier floors and recorded overrides;
  `gate` and `findings` commands.
- Any-stage ingestion of Markdown, text, HTML, JSON, DOCX and PDF with deterministic stage inference, four intake
  modes, preserved originals and an intake report; reconstruction of existing HTML courses.
- Traceability graph from sources to rendered elements, `trace` queries and impact analysis, trace validators.
- Structured graphics: 22 visual archetypes routed to Mermaid (in Playwright Chromium), native SVG builders,
  SVG.js, Vega-Lite and D3, with bounded repair and fallback to text equivalents; shared SVG post-processing.
- Single-file course compiler with design tokens for six visual families, component library, learner runtime
  (`window.__cf`), hashed Content-Security-Policy and build checks.
- Browser QA: contract runner for CourseForge builds and a heuristic crawler for imported HTML, axe-core,
  screenshots at three viewports, regression reports; pure release gate and release reports.
- Setup scripts for Windows PowerShell and POSIX shells, idempotent bootstrap, `doctor` with repair, smoke fixture.
- Documentation, ADRs, CI workflows, licence records.
