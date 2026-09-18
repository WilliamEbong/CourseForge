---
name: assessment-design
description: Writing valid formative and graded items for every CourseForge interaction mode (item-writing rules, distractor design, teaching feedback, Bloom alignment, answer keys). Used by CourseForge STORYBOARD authoring.
disable-model-invocation: true
---

# Assessment design

## Principles

- **Validity first.** An item measures its objective at the objective's level. If a learner could answer by recognising a phrase from the text, the item measures reading, not the objective.
- **One defensible answer.** For single choice, experts must agree on the key using the cited evidence. For other modes, every pairing, category or position is unambiguous.
- **Taught before tested.** Every item draws only on content taught earlier in the course.
- **Feedback teaches.** Feedback is the last and most memorable teaching moment. Explain why, cite evidence, address the specific error.

## Stems

- Pose a complete question or task; a learner covering the options should be able to form an answer.
- Put shared words in the stem, not repeated in every option.
- Positive wording by default. If a negative is essential ("Which is NOT…"), capitalise it and never combine with negative options.
- No trick wording, trivia, or reliance on exact phrasing from the course.
- For graded items: standalone, randomisable, no references to other items or to "the scenario above" unless the scenario is in the stem.
- Scenario stems carry the facts needed; nothing depends on assumptions outside the course.

## Distractors

- Draw them from real misconceptions identified in the design and the domain: confusing hazard with risk, treating guidance as law, relying on the last line of defence, confusing correction with corrective action.
- Make them parallel to the key in length, grammar, specificity and tone. The longest, most qualified option should not reliably be correct.
- No "all of the above", "none of the above", joke options, or options that overlap so two are simultaneously right.
- Three to four options for single choice; four to six for multiple response.
- Every distractor gets option feedback naming its specific error ("This treats the safety data sheet as a task risk assessment; the SDS describes the product, not your task").

## Modes and keys

| Mode | Use for | Keys |
|---|---|---|
| `single` | best answer, scenario decisions, interpretation | exactly one correct key |
| `multiple` | identifying all relevant factors, criteria or duties | all correct keys; at least two correct and at least one incorrect; stem says select all that apply |
| `matching` | term to definition, party to duty, control to example | every option key mapped to one target key |
| `categorization` | sorting examples into types or levels | every item mapped to one category; each category used |
| `sequencing` | processes where order genuinely matters | all option keys in correct order |
| `reveal` | reflection and self-explanation, formative only | no keys; model answer in rationale |

Matching, categorisation and sequencing must be completable with keyboard controls (select menus, move-up/move-down buttons); the storyboard never specifies drag as the only mechanic.

## Levels and item types

- Remember/understand: identification and explanation items with realistic examples, not definitions copied from the text.
- Apply: scenarios where learners choose an action using a principle.
- Analyse: categorisation, interpretation of a label, report or data extract, distinguishing similar cases.
- Evaluate: choose the best-supported option among plausible ones and recognise the reason.

## Feedback

- `feedbackCorrect`: confirm and extend ("Yes. The hazard stayed the same; the task changed exposure and consequence, so the risk changed.").
- `feedbackIncorrect`: redirect to the principle without giving away the key when retry is allowed; for graded review, explain.
- `optionFeedback`: one short explanation per incorrect option.
- `rationale`: the reasoning behind the key, anchored in the cited evidence.
- Tone: respectful and specific; never "Wrong!" or "Great job!" alone.

## Formative vs graded

- Formative items rehearse with rich feedback and may be easier, but they reach toward the objective's level.
- Graded items are new items (never copied from formative), at least two per objective, spanning foundational, applied and integrative difficulty, weighted toward applied for workplace objectives.
- A passing score is a design suggestion; nothing implies certification.

## Self-check per item

Does it map to the right objective and level? Is the key correct per the cited claims, and is it the only defensible key? Are distractors plausible and parallel? Does every option have feedback? Is it taught earlier? Can it be answered by keyboard and screen reader?
