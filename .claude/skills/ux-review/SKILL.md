---
name: ux-review
description: Learner experience review of e-learning courses (orientation, progress, navigation, click burden, feedback placement, recovery, assessment flow, mobile use, pacing, task friction). Use when reviewing how a learner moves through a CourseForge course.
---

# UX review

## Walk the course as a learner

Take three paths through the model and screenshots: a first-time learner from the start to the results; a learner who leaves mid-module and returns; a learner on a phone who needs the glossary halfway through a scenario. Note every moment of doubt ("where am I?", "what now?", "did that work?", "how do I get back?").

## Criteria

**Orientation**
- The learner always knows the current module and screen, and how much remains.
- Module landings say what the module covers and why.

**Progress**
- Progress indication is visible at every width and accurate; optional screens are handled honestly (they do not block completion unless stated).
- Completion status is clear at the end.

**Navigation**
- Next, back and menu behave predictably; the menu shows completion state; jumping to a module works; there are no dead ends.
- Browser back and direct links behave sensibly (hash routing).

**Click burden**
- Essential content is not hidden behind reveals, tabs or accordions that add clicks without adding learning.
- Screens are not split so finely that learners click through fragments; interactions are not added for novelty.

**Feedback placement**
- Feedback appears next to the question, in view after submitting, without scrolling away from the answer; it states clearly whether the answer was right and why.

**Recovery**
- Answers can be changed before submission; formative items can be retried; progress survives leaving and returning; reset is confirmed in-page and clearly explains what will be cleared.
- Errors (for example an incomplete matching item) are explained next to the control.

**Assessment flow**
- The start screen states item count, passing score, retake policy and whether answers can be reviewed.
- Submission is explicit; results show the score, pass status and which items or objectives to revisit, without implying certification.

**Mobile**
- Everything is reachable with a thumb; nothing depends on hover; dialogs are full-height with a reachable close; feedback is visible after answering.

**Pacing and flow**
- Rhythm varies between explanation, example, figure, practice and scenario; no long monotonous runs of similar screens; the course does not front-load all theory before any practice.

**Task friction**
- Glossary, references and citations are reachable from anywhere and return the learner to the same place.

## Reporting

- Location: screen ID or `global` for course-wide flow issues.
- Evidence: screen IDs, report entries, screenshot files, and the learner path that exposed the issue.
- Severity: cannot proceed, loses progress unexpectedly, or cannot recover in the graded assessment → critical; missing progress on mobile, feedback out of view, lost place after using resources → major; monotony, unclear labels → minor.
