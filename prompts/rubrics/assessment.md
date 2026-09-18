# Rubric: assessment

**Stage:** STORYBOARD. **Lens:** are the formative and graded items valid, fair, correctly keyed in substance, and teaching through their feedback?

## Read

1. Every block with an `interaction` in `storyboard/storyboard.json` (formative `…-F…` and graded `GA-…`).
2. The teaching blocks the items draw on, and the claims cited by each item.
3. The design's alignment table for intended levels.

## Checks

- [ ] **Correct in substance.** The keyed answer is correct according to the cited claims, and no distractor is also defensibly correct. (Code checks key format; you check the key is right.)
- [ ] **Measures the objective.** Each item targets its mapped objective at the intended level. Recall items for decision objectives are misaligned.
- [ ] **Taught before tested.** Every item's content is taught in an earlier block. Name the teaching block, or report the gap.
- [ ] **Stem quality.** Complete, unambiguous question; no negatives unless essential (and then emphasised); no double negatives; no trick wording; standalone for graded items.
- [ ] **Distractors.** Plausible, based on real misconceptions, similar in length and grammar to the key; no "all of the above" or "none of the above"; no absurd options; the longest or most qualified option is not always correct.
- [ ] **Multiple response.** Correct set is defensible; not every option correct; stem says to select all that apply.
- [ ] **Matching, categorisation, sequencing.** Each pairing, category or order is unambiguous; categories are mutually exclusive; sequences reflect a real required order, not an arbitrary one.
- [ ] **Feedback teaches.** Correct and incorrect feedback explain why; each distractor's `optionFeedback` names its specific error; rationale cites the evidence.
- [ ] **Graded bank.** At least two items per objective; mix of difficulty; formative items not copied verbatim; items work in random order.
- [ ] **Scenario items.** Scenarios include the facts needed to answer; the answer does not hinge on information outside the scenario and course.
- [ ] **Accessibility of mechanics.** No item relies on drag, colour, hover or timing to answer.

Evidence quotes the stem, options and key with the claim or block that proves the problem.

## Severity calibration

- `critical`: a wrong key; two defensible answers; a graded item testing untaught content; feedback that teaches something false.
- `major`: implausible or giveaway distractors across an item; misaligned level; missing option feedback on graded items; ambiguous stem.
- `minor`: uneven option lengths; a stem that could be tighter.
- `style`: wording preferences.

## Not your job

Whether objectives were well chosen (design reviewers); prose tone (editorial-readability). Validators already check key consistency per mode, ID uniqueness and that every objective is assessed at least twice.

## Categories

`assessment`, `alignment`
