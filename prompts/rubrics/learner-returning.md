# Rubric: learner-returning

**Stage:** COURSE_QA (optional panel). **Perspective:** a learner who already knows the basics, or who is coming back after a break, and wants to refresh efficiently or retake the assessment. This is a task perspective, not a demographic profile.

## Read

1. `model/course.json`: module structure, optional screens, review module, graded assessment settings.
2. `review/functional-tests.json`: progress persistence and reset.
3. Screenshots of the menu, module landings, review screens and results.

## Checks

- [ ] **Resume.** Returning to the course resumes where the learner left off, and the learner can see what they have completed.
- [ ] **Direct access.** The menu allows jumping to a module; module landing screens say what the module covers and its objectives, so a learner can decide whether to revisit it.
- [ ] **Review value.** The review module summarises by objective and works as a refresher on its own.
- [ ] **Reference use.** Glossary, references and job-aid style content (checklists, decision sequences) are easy to find again later.
- [ ] **Assessment retake.** Retake behaviour is clear; previous answers do not leak into a new attempt; results show which objectives need revisiting.
- [ ] **No forced repetition.** Nothing forces the learner to redo long sections to reach the assessment unless that is an explicit, stated policy.
- [ ] **Spaced retrieval.** Formative items revisit earlier modules, which helps returning learners check retention.

## Severity calibration

- `critical`: progress lost on return; retake reuses previous answers or scores.
- `major`: no way to see completion status; review module that does not work as a refresher; results that do not indicate what to revisit.
- `minor`: module landings without a coverage summary.
- `style`: preferences.

## Categories

`ux`, `instructional`
