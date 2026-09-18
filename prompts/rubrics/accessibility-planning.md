# Rubric: accessibility-planning

**Stage:** STORYBOARD. **Lens:** will every learner, including keyboard, screen-reader, low-vision, colour-blind, cognitively fatigued and mobile users, be able to learn and respond with this content as specified?

## Read

1. `storyboard/storyboard.json`: block `accessibility` notes, interactions, `visuals` (textEquivalent, content), bodies with lists or tables.
2. The accessibility-review skill for WCAG 2.2 AA expectations.

## Checks

- [ ] **Text equivalents that teach.** Each visual's `short` names what the figure shows; `long` conveys the full meaning, including relationships and order, so a learner who never sees the figure learns the same thing. Not a description of shapes and colours, not a drawing instruction.
- [ ] **Essential content in the body.** Anything essential exists in learner-facing text, not only in a visual, an `accessibility` note or a reveal.
- [ ] **Interaction operability.** Matching, categorisation and sequencing are specified as keyboard-operable (select-based or move-up/move-down controls), never drag-only. Reveal interactions have a real button, not hover.
- [ ] **No colour-only or position-only meaning.** Correct and incorrect states, categories in visuals, and emphasis are conveyed with text or icons as well.
- [ ] **No timed or motion-dependent tasks.** Nothing requires reacting within a time limit; animation is not needed for understanding.
- [ ] **Readable structure.** Long bodies use headings, lists and short paragraphs; tables have clear headers; link text makes sense out of context.
- [ ] **Language.** Acronyms expanded on first use; plain language; instructions do not rely on sensory characteristics ("click the green box on the right").
- [ ] **Feedback perceivability.** Feedback text is specified so it can be announced without the whole screen being re-read.
- [ ] **Mobile.** Wide tables, matrices and long option lists have a narrow-screen strategy in `treatment` or `accessibility`.

## Severity calibration

- `critical`: an interaction specified as drag-only or hover-only; essential content only inside an image; a graded item a keyboard or screen-reader user cannot complete.
- `major`: a text equivalent that does not convey the figure's meaning; colour-only states; missing narrow-screen strategy for a wide matrix.
- `minor`: link text like "here"; an unexpanded acronym.
- `style`: wording of notes.

## Not your job

Rendering and contrast (checked in build and QA). Validators already check that text equivalents are present, are not authoring instructions, and that no interaction is drag-only by schema.

## Categories

`accessibility`
