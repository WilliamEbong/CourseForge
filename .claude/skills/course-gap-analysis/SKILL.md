---
name: course-gap-analysis
description: Two-direction gap analysis of course storyboards and built or imported courses against their evidence, design and objectives (orphan and unassessed objectives, untaught assessment content, evidence gaps, transfer, glossary and reference gaps). Use when reviewing coverage of a CourseForge course.
---

# Course gap analysis

Gap analysis runs in two directions, and both matter.

## Direction 1: evidence gap (course → evidence)

Start from what learners read. For each substantive statement:

- Is there a claim behind it (block `claimIds`, citations)?
- Does the claim support it fully, including scope, modality, numbers and jurisdiction?
- Did a qualification get lost between claim and course text?

Typical findings: an uncited requirement; "must" backed by guidance; a statistic without year; a general statement where the claim is jurisdiction-specific.

## Direction 2: instructional gap (evidence and design → course)

Start from what was approved upstream. For each core claim, design content point, planned misconception, example and scenario:

- Does it appear as actual teaching in the storyboard or course, in the module the design assigned?
- Is it taught before it is practised and assessed?

Typical findings: a design content point never written; a planned misconception never addressed; a core duty from the dossier missing; a scenario from the design dropped.

## Coverage checks across the course

- **Orphan objective:** no screen teaches it.
- **Unassessed objective:** fewer than two graded items, or items below its level.
- **Untaught assessment content:** an item needs knowledge no earlier screen provides.
- **Weak transfer:** decision or escalation objectives assessed only by recall; no scenario application.
- **Unnecessary duplication:** the same teaching repeated without a spaced-review purpose.
- **Glossary gaps:** terms or acronyms used before definition, or never defined.
- **Reference gaps:** cited sources missing from the reference library; references never cited anywhere.
- **Boundary gaps:** no statement of what the course does not qualify learners to do; missing escalation at decision points.
- **Dispositions honoured:** excluded content not present; enrichment marked optional and not needed for graded items.

## Imported courses without upstream artifacts

Judge against the course's own stated objectives, scope and references. Record where the reconstruction is lossy (for example screens whose text could not be extracted) and do not blame the content for extraction limits. Recommend research where claims have no evidence rather than inventing citations.

## Method

1. List the objectives, and for each the teaching screens, formative items and graded items (the trace graph in `model/trace.json` helps when present).
2. Walk the design or dossier core points and mark each as taught, partly taught or missing.
3. Walk the course's substantive statements and mark each as supported, weakly supported or unsupported.
4. Report gaps with IDs on both sides: the upstream element and the course location where it should be.

## Severity guide

- Critical: an objective untaught or unassessed; graded content untaught; a core safety or legal point missing.
- Major: substantive statements without adequate support; missing planned misconceptions or scenarios; weak transfer on a decision objective.
- Minor: glossary and reference gaps; duplication.

## What code already checks

Validators flag objectives with no teaching block or fewer than two graded items, dangling and unused references, and claims or sources that do not resolve. The analyst judges whether coverage is genuine and whether support is adequate.
