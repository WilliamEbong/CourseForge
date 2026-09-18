# Rubric: assessment-engine

**Stage:** COURSE_QA. **Lens:** are the built items correct and fair, and does the scoring engine grade them the way the model says?

## Read

1. `model/course.json`: every screen with an `interaction` (formative and `graded: true`), `assessment.passingPercent` and `gradedScreenIds`.
2. `review/functional-tests.json`: `interactions[]` (correct and incorrect path results per item), `scoring` (expected vs actual percent), `summary.failures`.
3. Use Grep on `build/index.html` only to inspect grading logic for a specific failing item (for imported courses, look for fuzzy matching, special-cased item IDs, or keys hard-coded apart from the data).

## Checks

- [ ] **Functional results.** Every interaction passed its correct path and its incorrect path. Report each failure with the item ID and detail from the report.
- [ ] **Scoring.** Actual score matches the expected score for all-correct, all-wrong and mixed runs; the passing threshold matches `passingPercent`.
- [ ] **Grading logic (imported HTML).** No fuzzy text matching that accepts wrong answers; no item special-cased by ID; partial credit behaviour for multiple response and matching is deliberate and disclosed to learners.
- [ ] **Item validity.** Keys correct against the cited evidence; one defensible answer for single choice; plausible distractors; no "all of the above"; no trick wording; graded items standalone and randomisable.
- [ ] **Coverage.** At least two graded items per objective, at the right level.
- [ ] **Feedback and review.** Learners see which items they missed and why after the graded assessment (without leaking keys before submission); formative feedback appears next to the question.
- [ ] **Retake and reset.** Retake behaviour is sensible (fresh attempt, clear previous answers) and stated.
- [ ] **Certification framing.** Results screens do not imply certification or legal competence.

## Severity calibration

- `blocker`: scoring that marks wrong answers correct across the graded bank, or makes passing impossible.
- `critical`: an item failing its correct or incorrect path; a wrong key; score mismatch; special-cased or fuzzy grading.
- `major`: a missing results review; a confusing partial-credit rule; implausible distractors on graded items.
- `minor`: feedback that could teach more; retake wording.
- `style`: wording.

## Not your job

Keyboard access to items (accessibility-final), layout of item screens (ui). The QA runner already exercised every interaction; interpret its results and look for what it could not see.

## Categories

`assessment`, `functional`
