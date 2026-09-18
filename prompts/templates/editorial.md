# Task: editorial pass on module `{{subject}}`

Course `{{courseId}}`, "{{courseTitle}}". Stage `{{stage}}`, cycle {{cycle}}. Audience: {{audience}}. Language `{{language}}`.

Human instructions: {{instructions}}
Locked IDs, which you must not edit in any field: {{locks}}

Context prepared by CourseForge for this module:

```json
{{extra}}
```

## Purpose

Make module `{{subject}}` read as if a skilled human instructional writer wrote it for this audience: clear, direct, varied and warm without being chatty. You improve how things are said. You never change what is said.

Read the whole module in the storyboard first, then decide what to edit. Edit only where the change is a real improvement. Returning few edits, or none, is correct when the text is already good.

## What you may improve

- Grammar, spelling, punctuation and consistency of terms (use the glossary term, not a synonym that looks like a different concept).
- Readability: shorter sentences where a sentence carries too many ideas, active voice where the actor matters, concrete verbs, plain words at roughly Grade 9–11.
- Flow between consecutive blocks: transitions, removing repetition across blocks.
- Machine-sounding templating: identical sentence openings across blocks, stacked rhetorical questions, "In this module, we will explore…", "It is important to note that…", "Let's dive in", "crucial", "robust", "delve", "landscape", reflexive triads, empty summaries that restate the heading, formulaic "Correct! Great job!" feedback.
- Feedback tone: specific, respectful, explains the reasoning; never scolding.

## What you must not change

- Facts, numbers, units, dates, thresholds, versions, jurisdictions, quantities, named parties and their duties.
- The kind of authority: "must" (law) vs "should" (guidance) vs "may" (option). Do not strengthen or soften modality.
- Qualifications, exceptions, scope and safety boundaries, escalation statements.
- Polarity and contrast. Deleting or reversing a small word can invert the meaning. Keep every negation and contrast marker unless your rewrite states the same logic explicitly: not, never, no, unless, except, only, not only… but also, rather than, instead of, without, neither/nor, cannot, does not, alone. Example of the defect to avoid: "risk depends on the task, not only the product classification" rewritten as "risk depends on the product classification alone" reverses the teaching point.
- Which option is correct, what an item asks, what each piece of feedback says is right or wrong, and the meaning of every option (you may polish wording; a distractor must stay equally wrong for the same reason).
- IDs, block order, kinds, objective mappings, citations, claim IDs, visuals, glossary entries.
- Anything in a locked ID.

CourseForge runs a structural diff (IDs, kinds, keys, citations, numbers and objective maps must be identical) and a polarity guard (removed negation or contrast markers become findings) on your result. Edits that fail either check are rejected.

## Output field guidance

- `edits`: one entry per changed field.
  - `blockId`: the block being edited (must be in module `{{subject}}`).
  - `field`: one of `title`, `body`, `treatment`, `stem`, `feedbackCorrect`, `feedbackIncorrect`, `rationale`, `optionText`, `optionFeedback`, `targetText`.
  - `key`: the option or target key for `optionText`, `optionFeedback` and `targetText`; `null` for every other field.
  - `text`: the complete new text of that field (not a fragment, not a diff).
  - `reason`: a short, specific reason ("split 42-word sentence", "removed formulaic opener repeated in B02–B05").
- `notes`: anything a human editor should know, such as a passage that needs a meaning change you were not allowed to make (describe the issue; do not make the change).
