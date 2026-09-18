---
name: assessment-review
description: Reviewing assessment strategies, items and scoring for validity, fairness, correct keys, distractor quality and alignment. Used by CourseForge assessment reviewers at design, storyboard and QA stages.
disable-model-invocation: true
---

# Assessment review

## Review order

1. **Correctness.** Is the key right according to the cited evidence? Is any distractor also defensible? This matters more than anything else.
2. **Alignment.** Does the item measure its mapped objective at the intended level, and was the content taught earlier?
3. **Construction.** Stem clarity, distractor quality, feedback.
4. **Bank-level balance.** Coverage per objective, difficulty mix, redundancy, formative-graded overlap.
5. **Mechanics.** Accessible operation, scoring behaviour (at QA).

## Item defects to look for

- Wrong key; two defensible answers; a key that depends on a qualifier the stem omits.
- Stem ambiguity: undefined terms, missing scenario facts, "best" without criteria.
- Cueing: grammatical mismatch between stem and distractors; the longest or most hedged option is always right; repeated words from the stem only in the key; absolute words ("always", "never") only in distractors.
- Implausible distractors that no learner would choose, which turn the item into a two-option guess.
- "All of the above", "none of the above", "both A and C".
- Negative stems without emphasis; double negatives.
- Trivia: testing a number or name when the objective is a decision.
- Level mismatch: recall items for decision objectives.
- Untaught content: the item depends on a fact not in earlier screens.
- Formative items copied into the graded bank.
- Order dependence in graded items.
- Multiple response where every option is correct, or where the correct set is debatable.
- Sequencing where the order is conventional rather than required.
- Feedback that only says correct or incorrect; option feedback missing; rationale without citation; feedback contradicting the key.

## Scoring review (QA)

- Compare the QA runner's correct-path and incorrect-path results per item with the model's keys.
- Check expected and actual scores for all-correct, all-wrong and mixed runs, and the passing threshold.
- For imported courses, inspect grading code for fuzzy text matching, keys stored separately from the data, and special cases for particular item IDs.
- Partial credit must be deliberate and explained to learners.

## Severity guide

- Blocker: scoring broken so results are meaningless.
- Critical: wrong key; two defensible answers; graded item on untaught content; feedback teaching something false; an item that cannot be answered by keyboard.
- Major: level mismatch; weak distractors across an item; missing option feedback on graded items; fewer than two graded items for an objective.
- Minor: cueing that is subtle; uneven option length; feedback that could teach more.

## Evidence in findings

Quote the stem, the options and the key; cite the claim or teaching block that proves the problem; for untaught content, show that no earlier screen covers it (name the closest one). Recommend the smallest change: replace one distractor with a named misconception, retarget the stem, move the key.

## Strategy review (design stage)

Check item counts per objective, planned item types against levels, formative practice before graded assessment, the difficulty spread, the passing-score framing, and that no planned mechanic is inaccessible.
