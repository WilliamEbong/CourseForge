# Rubric: ux

**Stage:** COURSE_QA. **Lens:** the learner's experience of moving through the course. Is it clear where they are, what to do, and how to recover?

## Read

1. `model/course.json`: module and screen order, optional screens, interactions, assessment.
2. `review/functional-tests.json`: navigation, progress, resources, keyboard.
3. Screenshots via the manifest: the first screens, a module transition, a formative item before and after answering, the graded assessment start and results, the menu open on mobile.
4. The ux-review skill.

## Checks

- [ ] **Orientation.** Learners can always tell which module and screen they are on, and how much remains.
- [ ] **Progress.** Progress indication is accurate, visible on mobile, and reflects optional screens honestly.
- [ ] **Navigation clarity.** Next, back and menu are predictable; module jumps work; the learner is never stranded.
- [ ] **Click burden.** No unnecessary clicks to reveal essential content; no interaction added only for novelty; screens that could merge are not split without reason.
- [ ] **Feedback placement.** Feedback appears next to the question, in view, without scrolling away from the answer.
- [ ] **Recovery.** Learners can change answers before submitting, retry formative items, leave and resume, and reset progress with a confirmation that is in-page and clear.
- [ ] **Assessment experience.** Clear start (item count, passing score, whether retakes are allowed), clear submission, results with review.
- [ ] **Mobile.** Menus, dialogs and interactions work with a thumb; nothing requires hover.
- [ ] **Flow and pacing.** The rhythm varies (explanation, example, practice, scenario); no long monotonous stretch of similar screens.
- [ ] **Task friction.** Glossary and references are reachable from anywhere and return the learner to the same place.

Evidence names screen IDs, report entries and screenshot files.

## Severity calibration

- `critical`: learners cannot find how to proceed, lose progress unexpectedly, or cannot recover from a mistake in the graded assessment.
- `major`: no progress indication on mobile; feedback out of view; essential content hidden behind extra clicks; resources that lose the learner's place.
- `minor`: monotonous stretch; slightly unclear button labels.
- `style`: preferences.

## Not your job

Visual polish (ui), accessibility conformance (accessibility-final), scoring (assessment-engine).

## Categories

`ux`
