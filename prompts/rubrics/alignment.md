# Rubric: alignment

**Stage:** INSTRUCTIONAL_DESIGN. **Lens:** does every objective have honest, level-appropriate teaching, practice and assessment, and does nothing get assessed that is not taught?

## Read

1. `design/instructional-design.json`: objectives, modules (`loIds`, `contentSequence`, `formativePractice`), `alignment`, `assessmentStrategy`.
2. Claims cited by each objective.

## Checks

- [ ] **Objective quality.** Each objective is a single, observable performance at a stated level; the verb matches the `bloomLevel`; compound objectives ("identify and evaluate and document") are split or justified.
- [ ] **Evidence support.** Each objective's `claimIds` actually contain what a learner needs to meet it. An objective whose claims cover only half of it is partially unsupported.
- [ ] **Taught.** Each objective is taught by specific content points in the modules that list it, not just listed in `loIds`.
- [ ] **Practised.** Each objective has formative practice described in at least one module, at a level approaching the graded level.
- [ ] **Assessed at the right level.** The `gradedMethod` can measure the objective at its `cognitiveLevel`. Recall items for "evaluate" or "distinguish" objectives are misaligned.
- [ ] **No orphans.** No module content that serves no objective (unless dispositioned as enrichment); no formative practice that maps to nothing.
- [ ] **No untaught assessment.** Graded methods do not require knowledge that no module teaches.
- [ ] **Balance.** Graded weighting across objectives reflects their importance; no objective relies on a single item.
- [ ] **Consistency.** Objective IDs, module IDs and levels agree across `objectives`, `modules` and `alignment`.

Cite objective and module IDs in `evidence`, and quote the content point or method that shows the gap.

## Severity calibration

- `critical`: an objective with no supporting claims, no teaching, or no feasible assessment; assessment requiring untaught content.
- `major`: level mismatch between objective and graded method; practice that does not reach the objective's level; compound objectives that cannot be assessed cleanly.
- `minor`: uneven weighting; slightly imprecise verb.
- `style`: phrasing of objective statements.

## Not your job

Item mix and difficulty (assessment-strategy), sequence (learning-architecture). Validators check that every objective appears in a module and in the alignment table and that IDs resolve; judge whether the alignment is genuine.

## Categories

`alignment`, `assessment`
