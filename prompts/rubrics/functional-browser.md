# Rubric: functional-browser

**Stage:** COURSE_QA. **Lens:** does the course work in a real browser, offline, on every screen and viewport tested?

## Read

1. `review/functional-tests.json` first: `screens[]` (ok, errors, overflow, missingIds per viewport), `navigation`, `resources`, `progress`, `keyboard`, `offline.blockedRequests`, `consoleErrors`, `crawl` (imported courses), `summary`.
2. `review/screenshots/manifest.json`, then view the PNG screenshots for every screen the report marks as failing, plus a sample per module at each viewport.
3. `model/course.json` to map failures to screen and module IDs.

## Checks

- [ ] **Screens.** Every screen reachable and rendering; no blank or partially rendered screens; `missingIds` explained (a model block with no DOM element is content lost to learners).
- [ ] **Errors.** Console and page errors: which screens, and whether learner-visible behaviour breaks.
- [ ] **Navigation.** Next and back, menu, direct links, and completion work; no dead ends; the last screen leads somewhere sensible.
- [ ] **Resources.** Glossary, references and citation panels open, contain the expected counts and close.
- [ ] **Progress.** Progress persists across reload where supported, and reset clears it.
- [ ] **Offline.** No blocked network requests; the course needs no external runtime resource (external reference links clicked by learners are fine).
- [ ] **Overflow.** Screens with horizontal overflow or clipped elements; confirm in screenshots whether content is actually cut off.
- [ ] **Imported courses (crawl mode).** Unreachable states, truncated crawls, controls that did nothing.
- [ ] **Screenshots show what the report cannot.** Overlapping elements, controls rendered off-screen, broken figures, empty panels.

Location = the screen ID, or a CSS selector for shell-level problems. Evidence quotes the report entry and names the screenshot file.

## Severity calibration

- `blocker`: the course cannot be started or completed.
- `critical`: screens unreachable or blank; a console error that breaks an interaction or navigation; network dependency at runtime; missing block content.
- `major`: progress or reset broken; a resource panel failing; clipped content on one viewport.
- `minor`: a non-breaking console warning; cosmetic overflow with no content loss.
- `style`: not applicable.

## Not your job

Scoring correctness (assessment-engine), axe results and keyboard detail (accessibility-final), aesthetics (ui). Do not re-report failures already listed by the QA runner unless you add diagnosis (cause, scope across screens).

## Categories

`functional`
