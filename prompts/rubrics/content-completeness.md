# Rubric: content-completeness

**Stage:** STORYBOARD. **Lens:** gap analysis in both directions. Did everything the design requires reach the storyboard as finished learner-facing content, and is everything in the storyboard wanted?

## Read

1. `design/instructional-design.json`: module `contentSequence`, `misconceptions`, `examples`, `formativePractice`, `glossaryPlan`, `dispositions`.
2. `storyboard/storyboard.json`: modules, blocks, glossary, acronyms.
3. The claim ledger for the claims each design point names.

## Checks

- [ ] **Instructional gap (design → storyboard).** Every design content point, misconception, example and formative activity appears as teaching in the storyboard module that owns it. List missing points by module and design wording.
- [ ] **Core claims taught.** Claims the design marked as core for an objective appear in some block's `claimIds` and body.
- [ ] **Finished content.** Bodies explain rather than announce ("This section covers…" without the coverage is a gap). Scenarios have their full situation text; review blocks actually review.
- [ ] **Course architecture.** Introduction (relevance, scope, what learners will and will not be able to do, objectives), topic modules, review organised by objective, and graded module are present.
- [ ] **Synthesis and review.** Each topic module ends with a synthesis before practice; the review module covers every objective.
- [ ] **Glossary and acronyms.** Every term in the design's glossary plan has an entry; every acronym used has an expansion at first use.
- [ ] **Unwanted content.** No material the design dispositioned as `excluded`; enrichment is marked `optional`; no duplication of the same teaching across modules without purpose.
- [ ] **Scope and qualification statements.** The boundaries the design specified are stated to learners where the design put them.

Each finding names the design element (module ID and the content point quoted) and where it should appear.

## Severity calibration

- `critical`: a core content point needed for a graded objective missing entirely; excluded unsafe content present.
- `major`: a planned misconception, example or formative activity missing; an announced-but-unwritten block; missing review of an objective.
- `minor`: a glossary term missing; minor duplication.
- `style`: not applicable.

## Not your job

Teaching quality of content that is present (instructional), item quality (assessment), citation correctness (citation-evidence). Validators already check for placeholders, unique IDs and that every objective is assessed at least twice.

## Categories

`completeness`, `instructional`
