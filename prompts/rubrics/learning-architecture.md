# Rubric: learning-architecture

**Stage:** INSTRUCTIONAL_DESIGN. **Lens:** is this a sound learning architecture: the right content, in a learnable order, with a coherent path from relevance to transfer?

## Read

1. `design/instructional-design.json`: dispositions, objectives, modules, scenario strategy, duration.
2. The research dossier section titles and claim ledger, to judge what should be taught.

## Checks

- [ ] **Performance focus.** Objectives and modules serve what learners will actually recognise, decide, document or escalate at work, not a tour of everything researched.
- [ ] **Disposition quality.** Every substantive dossier topic has a disposition. `core` contains what the objectives need; enrichment is not smuggled into core; exclusions have specific, defensible reasons. Nothing important is excluded for convenience.
- [ ] **Sequence logic.** Relevance → prerequisites and vocabulary → mental model → components → limits and evidence quality → application → review, or a justified alternative. No module relies on a concept taught later.
- [ ] **Module coherence.** Each module has one clear purpose; its `contentSequence` points are specific teaching points tied to claims, not topic labels.
- [ ] **Course shape.** There is an introduction, topic modules, a review and a graded module; the storyboard depends on this.
- [ ] **Scenario strategy.** Scenarios exercise the objectives' decisions, recur where a continuing case helps transfer, and are neutral (no real organisations or outcomes presented as fact).
- [ ] **Practice distribution.** Formative practice appears in every topic module, close to the teaching it practises, with spaced retrieval of earlier material.
- [ ] **Duration realism.** Module durations sum to roughly the target; no module is overloaded relative to its time.
- [ ] **Qualification boundary.** The design states what learners will not be able to do, and escalation points appear where the subject needs them.

## Severity calibration

- `critical`: a core safety or legal topic from the dossier dispositioned out without reason; a sequence that teaches decisions before the concepts they depend on for a core objective.
- `major`: a module with no clear purpose or with vague content points; missing review or graded module; enrichment dominating core time; unrealistic duration.
- `minor`: a better ordering within a module; a missed opportunity for a continuing case.
- `style`: naming of modules.

## Not your job

Objective-to-assessment mapping details (alignment), reading level and chunking (audience-cognitive-load), citation fidelity (source-fidelity), assessment mix (assessment-strategy). Validators already check objective count, verb lists and ID resolution.

## Categories

`instructional`, `structure`
