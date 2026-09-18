# Rubric: learner-keyboard

**Stage:** COURSE_QA (optional panel). **Perspective:** a learner who uses only a keyboard, possibly with a screen reader. This is a task perspective, not a demographic profile.

## Read

1. `review/functional-tests.json` `keyboard` results and `review/accessibility-review.json`.
2. Screenshots via the manifest of interaction screens, dialogs and the menu, looking for focus indicators.
3. `model/course.json` for the interaction modes used. Grep `build/index.html` for the markup of a specific control when diagnosing (tabindex, roles, key handlers).

## Walk through, as this learner

- [ ] Start the course and reach the first content screen without a mouse.
- [ ] Move between screens and modules; open and close the menu; know where focus lands after each screen change.
- [ ] Answer each interaction mode: single, multiple, matching, categorisation, sequencing, reveal. Can selections be made and changed, and is the result announced?
- [ ] Open the glossary, references and a citation; close them; confirm focus returns to where it was.
- [ ] Complete the graded assessment and read the results and review.
- [ ] Reset progress through the in-page confirmation.

## Checks

- [ ] Every step above is possible with Tab, Shift+Tab, Enter, Space, arrow keys and Escape as conventionally expected.
- [ ] Focus is always visible and never lost to the page body or hidden behind fixed elements.
- [ ] No keyboard traps; dialogs contain focus while open.
- [ ] Screen changes and feedback are announced once, without re-reading the whole screen.
- [ ] Sequencing and categorisation offer explicit keyboard controls (move up and down, choose category), not drag-only.

## Severity calibration

- `blocker`: the course cannot be completed by keyboard.
- `critical`: one interaction mode or dialog cannot be operated; focus trap; focus lost on screen change so the learner cannot find the new content.
- `major`: invisible focus on some controls; feedback not announced; illogical tab order.
- `minor`: extra tab stops; unconventional key bindings that still work.

## Categories

`accessibility`, `functional`
