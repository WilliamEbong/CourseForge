---
name: html-intake-review
description: Reviewing imported or built single-file HTML courses for functional behaviour using CourseForge QA reports, screenshots and targeted source inspection (navigation, interactions, grading logic, progress, offline, known defect patterns). Used by the functional-browser reviewer and HTML repairs.
disable-model-invocation: true
---

# HTML intake and functional review

## Evidence first, source second

CourseForge has already run the course in a real browser. Start from its reports, not from the 300 KB HTML:

1. `review/functional-tests.json`: per-screen rendering, overflow and missing IDs; interaction correct and incorrect paths; scoring; navigation; resources; progress; keyboard; offline; console errors; crawl results for imported courses.
2. `review/accessibility-review.json`: axe violations by screen.
3. `review/screenshots/manifest.json`: screenshot paths by screen and viewport. Screenshots are PNG files; view them with the Read tool.
4. `model/course.json` or the intake report: the reconstructed structure.
5. Only then Grep the HTML for the specific element, handler or data structure behind a failure.

Parsing a course is not proof that it works. Rendering is not proof that it teaches. Use the reports to see behaviour and the screenshots to see what learners see.

## What to establish for an imported course

- Structure: modules, screens, and whether every screen is reachable.
- Content source: embedded data (a `const COURSE = …` object or a JSON script) versus content hard-coded in markup; data-driven courses are far easier to repair safely.
- Interactions: types present, how answers are keyed, where feedback appears.
- Scoring: how the graded result is computed, and whether it matches the keys.
- Navigation and progress: next and back, menu, completion, local storage, reset.
- Resources: glossary, references, citation panels.
- Runtime dependencies: any external script, font, stylesheet or request.

## Known defect patterns in hand-built courses

- Figures that are not graphics: CSS boxes produced by a hard-coded switch statement, with no real SVG and no text equivalent.
- Alt text or captions containing authoring instructions ("Create an original diagram showing…").
- `aria-live` on the whole screen container, so every navigation re-reads the entire screen.
- Missing or removed focus styles; focus not moved to new screen content.
- Drawers and menus without focus management; `window.confirm` for reset.
- Grading with fuzzy text normalisation that accepts wrong answers, or item IDs special-cased in code.
- Answer keys stored separately from the item data so they drift.
- Meaning corruption carried in from editing (negations dropped).
- Horizontal overflow on small screens from fixed-width tables or figures.

## Diagnosing a failure

- Group failures by root cause: one faulty component usually fails on many screens.
- For each root cause, identify the smallest element or code region responsible (selector, function name, data key) and the screens affected.
- Distinguish content defects (fix in the model or text) from tooling defects (the QA runner or reconstruction could not handle something) and say which.

## Repairing HTML directly

Only when no model can be reconstructed. Make minimal find/replace edits with unique anchors, prefer native semantics, never add network dependencies, and keep every other behaviour working. The original file is never modified; edits apply to a copy and the whole QA suite reruns.
