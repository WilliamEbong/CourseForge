# Rubric: factual-currentness

**Stage:** COURSE_QA. **Lens:** is what the finished course tells learners true, supported and current today?

## Read

1. `model/course.json`: screens (`body`, interaction `rationale` and feedback, `claimIds`, `citations`), visuals, glossary, references. Screen IDs equal storyboard block IDs; use them as locations. Prefer the model over the built HTML; use Grep on `build/index.html` only to confirm a specific string rendered.
2. `research/claims.jsonl` and `research/sources.jsonl` for each cited claim and source.
3. Web tools: re-check the currentness of every legal instrument, standard edition, guidance version and statistic the course teaches as a headline, and any source whose `currentnessNotes` flagged pending change.

## Checks

- [ ] **Claim fidelity in the final text.** Screen text states what its claims state, with modality, scope, jurisdiction and numbers intact, after editing and repairs.
- [ ] **Uncited substantive facts.** Facts introduced during storyboard, editorial or repair that have no claim behind them.
- [ ] **Currentness.** Cited legislation is the current consolidation; standards and guidance are current editions; statistics are the latest release or labelled with their year. Report what changed since the dossier was researched, with URL and date.
- [ ] **Law vs guidance.** No guidance or voluntary standard taught as law; no legal duty softened.
- [ ] **Reference records.** Reference titles, issuers, versions and URLs are accurate; URLs point to the document named (open a sample).
- [ ] **Assessment keys against evidence.** Graded answers remain correct given current sources.
- [ ] **Glossary definitions.** Formal definitions match their sources.
- [ ] **Dates in text.** Phrases like "currently", "new", "recent", "as of" are still true.

## Severity calibration

- `blocker`: fabricated fact or reference discovered in the course.
- `critical`: a legal requirement, safety statement or graded answer that is wrong or no longer current; guidance taught as law.
- `major`: an uncited substantive fact; an outdated statistic or edition presented as current; a dropped qualification.
- `minor`: a reference record with incomplete metadata; a date phrase that should be anchored.
- `style`: citation formatting.

## Not your job

Coverage gaps (gap-analysis), teaching quality, UI. Code checks citation resolution and dangling references.

## Categories

`accuracy`, `currentness`
