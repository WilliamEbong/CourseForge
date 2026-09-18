# Rubric: editorial-integrity

**Stage:** EDITORIAL. **Lens:** did the editorial pass change any meaning? Compare every edited field against its original.

## Read

1. `storyboard/editorial-diff.json`: every changed field with before and after text.
2. `storyboard/storyboard.json` (original) and `storyboard/storyboard-edited.json` (edited) for context around each change.

Work through the diff field by field. Read the before and after sentences side by side, and ask: would a learner come away believing something different?

## Checks

- [ ] **Polarity and contrast.** Negations and contrast markers survive in meaning: not, never, no, unless, except, only, not only… but also, rather than, instead of, without, cannot, alone. Example of the defect: "risk depends on the task, not only the product classification" became "risk depends on the product classification alone". Code flags removed markers; you judge rewrites that keep the words but reverse the logic, and removals that were legitimate.
- [ ] **Modality.** "Must", "shall", "is required" vs "should", "is recommended" vs "may" are unchanged in force.
- [ ] **Scope and qualifiers.** "Some", "most", "in Alberta", "where reasonably practicable", "for listed substances", "at the time of writing" are not dropped or broadened.
- [ ] **Assessment meaning.** Stems still ask the same question; each option means the same thing; the keyed option is still the only correct one; distractors are still wrong for the same reasons; feedback still matches the key.
- [ ] **Safety and escalation.** Escalation instructions, "do not attempt" statements and professional boundaries keep their strength.
- [ ] **Causality and sequence.** "Because", "before", "after", "therefore" relationships are unchanged; list order that encodes sequence is unchanged.
- [ ] **Terminology.** A defined term was not replaced by a near-synonym that changes the concept (hazard/risk, correction/corrective action).
- [ ] **Worth the change.** Flag edits that made text worse (less clear, more generic, longer without benefit) as minor.

Evidence: block ID, field, the before text and the after text, quoted.

## Severity calibration

- `critical`: a reversed or materially changed meaning in content, a stem, an option or feedback; a changed correct answer in substance; a weakened safety or legal statement.
- `major`: a dropped qualifier or narrowed/broadened scope; a modality shift on a non-safety point; a term swap that confuses two concepts.
- `minor`: an edit that reduced clarity without changing meaning.
- `style`: preferences between two acceptable wordings.

## Not your job

Readability of text the editor did not touch (editorial-readability). Structural identity (IDs, keys, citations, numbers, objective maps) is verified by code; report only if you see something the diff shows code could not catch.

## Categories

`editorial`, `accuracy`, `consistency`
