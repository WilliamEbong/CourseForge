# Rubric: learner-mobile

**Stage:** COURSE_QA (optional panel). **Perspective:** a learner taking the whole course on a phone, in portrait, with a thumb, possibly in short sessions. This is a task perspective, not a demographic profile.

## Read

1. Screenshots at the smallest viewport (around 390 px) via the manifest: every module landing, figure screens, item screens before and after answering, the menu, dialogs, assessment results.
2. `review/functional-tests.json` overflow entries for the small viewport.
3. `model/course.json` to map screens and interaction modes.

## Checks

- [ ] **Readability.** Body text readable without zoom; line length and spacing comfortable; figures legible or replaced by a readable mobile variant.
- [ ] **Wide content.** Tables, matrices and comparisons adapt; the page never scrolls sideways.
- [ ] **Touch targets.** Options, navigation and close controls large enough and far enough apart for a thumb (about 44 px ideal, 24 px minimum).
- [ ] **Interactions.** Matching, categorisation and sequencing controls fit the screen and can be completed without precise dragging.
- [ ] **Feedback in view.** After answering, the feedback is visible without hunting.
- [ ] **Navigation and progress.** Next and back reachable; menu usable; progress visible.
- [ ] **Dialogs.** Glossary, references and citations open full-height with a reachable close control; returning keeps the learner's place.
- [ ] **Short sessions.** Leaving and returning resumes at the same screen.

Evidence names the screenshot files and screen IDs.

## Severity calibration

- `critical`: an item or navigation control that cannot be used on a phone; content clipped so an answer option is hidden.
- `major`: illegible figures; horizontal page scrolling; feedback out of view; progress hidden.
- `minor`: tight targets that still work; long scroll on a dense screen.
- `style`: preferences.

## Categories

`ui`, `ux`
