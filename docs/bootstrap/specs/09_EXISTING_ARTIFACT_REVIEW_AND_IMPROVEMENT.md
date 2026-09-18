# 09 — Existing Artifact Review and Improvement

## Purpose

CourseForge is not only a greenfield generator. It must accept existing work, understand its current stage, preserve originals, review it, improve it, and continue to a requested downstream stage.

## Core input types

v1 must robustly support at least:

- `.md` / Markdown;
- `.txt`;
- `.html` / `.htm`;
- `.json`.

The implementation should also provide practical adapters for `.docx` and `.pdf` if current mature local parsing libraries can be integrated reliably. PPTX support is desirable but should not compromise v1 quality. Unsupported binary types must fail clearly rather than producing lossy silent conversions.

## Declared vs inferred stage

If the user declares `--stage storyboard`, treat that as intent but still validate content against the stage contract.

If stage is not declared, run a classifier returning a controlled enum and confidence/evidence. Low confidence should request confirmation or use a conservative intake mode.

## Intake modes

Every imported artifact supports:

- `preserve` — validate and use it without rewriting unless technically impossible;
- `review-only` — generate reviews/findings but do not modify;
- `improve` — controlled repairs after review/adjudication;
- `rebuild` — use artifact as source material and regenerate that stage according to current CourseForge standards.

## Imported HTML course workflow

For HTML, perform:

```text
preserve original
→ parse DOM/source
→ reconstruct normalized course model where possible
→ identify modules/screens/interactions/assessments/citations/navigation/progress
→ browser-run the actual course
→ content extraction
→ fact-check/gap analysis
→ instructional review
→ assessment review
→ accessibility review
→ UI review
→ UX review
→ functional testing
→ adjudication
→ repair
→ regression test
→ release
```

## HTML reverse engineering

Extract or infer:

- title/metadata;
- section/module structure;
- screens/blocks;
- learner-facing copy;
- links/citations/references;
- interaction types and states;
- answer keys if encoded;
- feedback/rationales;
- scoring/completion logic;
- navigation/progress behavior;
- visual/SVG/media assets;
- accessibility attributes;
- responsive styling;
- JavaScript event logic where feasible.

Do not treat successful parsing as equivalent to functional correctness; run the page in a real browser.

## Fact checking

Classify substantive statements where feasible:

- law/regulation;
- scientific/technical fact;
- statistic;
- version/date/current-status claim;
- guidance/recommendation;
- scenario/synthesis.

If an existing source ID is present, verify that the source supports the claim and remains current where currentness matters. If no source exists, research according to project evidence policy before inserting a new citation.

## Gap analysis

Run both directions:

1. **Evidence gap** — learner-facing claim lacks adequate support or qualification.
2. **Instructional gap** — important approved research/design content never appears in the storyboard/course.

Also detect unnecessary duplication, orphan objectives, unassessed objectives, untaught assessment content, weak transfer/application, and glossary/reference gaps.

## UI/UX improvement

UI reviewer: visual hierarchy, layout, typography, spacing, density, controls, responsive behavior, consistency, clipping/overflow.

UX reviewer: navigation clarity, orientation, progress clarity, click burden, feedback placement, recovery from mistakes, mobile usability, cognitive load, unnecessary interaction, monotonous flow, task friction.

## Learner-perspective review

Optional specialist reviewers may simulate functional perspectives such as:

- educated non-specialist;
- somewhat experienced practitioner;
- keyboard-only user;
- mobile user;
- returning learner already familiar with basics.

These are task-perspective reviews, not demographic profiling.

## Controlled repair

Repairs derive from an adjudicated repair plan. Preserve original input and snapshot pre-repair build. Re-run affected tests and produce a before/after release report.

