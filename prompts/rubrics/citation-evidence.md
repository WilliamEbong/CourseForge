# Rubric: citation-evidence

**Stage:** STORYBOARD. **Lens:** does every factual statement a learner reads rest on the right claim and source, with its qualifications intact?

## Read

1. `storyboard/storyboard.json`: block bodies, interaction rationales and feedback, `claimIds`, `citations`, visual `sourceIds`, glossary `sourceIds`.
2. `research/claims.jsonl` and `research/sources.jsonl` for every cited ID.

## Checks

- [ ] **Uncited facts.** Substantive factual sentences (requirements, numbers, mechanisms, definitions) have supporting `claimIds` and `citations` on the same block. General connective prose does not need a citation; facts do.
- [ ] **Claim matches text.** The block's wording says what its claims say: same modality, same scope, same jurisdiction, same numbers.
- [ ] **Qualifications preserved.** Exceptions, thresholds, conditions and jurisdiction limits in the claim remain in the learner text.
- [ ] **Law vs guidance.** Guidance, standards and frameworks are not presented as legal requirements ("you must" for a "should" claim); legal duties are not softened into suggestions.
- [ ] **Assessment evidence.** Rationales and correct-answer feedback are supported by the item's citations.
- [ ] **Right source for the job.** Legal statements cite the legal instrument (or authoritative guidance about it), not a tertiary summary.
- [ ] **Locators.** Pinpoint locators are carried over where the claim has them.
- [ ] **Visual content.** Facts shown in visuals are supported by the visual's `sourceIds`.
- [ ] **Invented specifics.** No numbers, named incidents, organisations or quotations appear that are not in the claim ledger; hypothetical scenarios are clearly hypothetical.
- [ ] **Currentness flags.** Claims the dossier marked time-sensitive keep their date or version context in the text where it matters.

Evidence: block ID, the sentence, the claim ID and claim text it misrepresents or lacks.

## Severity calibration

- `critical`: learner text that contradicts its claim; guidance taught as law or law as optional; an invented fact or statistic.
- `major`: a substantive fact with no claim or citation; a dropped qualification; an assessment rationale unsupported by its citations.
- `minor`: missing locator; citation on an adjacent block instead of the one with the claim.
- `style`: citation ordering.

## Not your job

Whether the claims themselves are right (research stage), teaching quality, item construction. Validators already check that cited claim and source IDs resolve.

## Categories

`citation`, `evidence`, `accuracy`
