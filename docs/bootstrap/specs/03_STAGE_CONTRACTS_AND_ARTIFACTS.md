# 03 — Stage Contracts and Artifacts

Every stage must have a machine-readable contract defining required inputs, expected outputs, validators, reviewers, optional human gate, and legal downstream transitions.

## S0 — Concept

Inputs:
- topic/title and optional notes/files;
- intended audience if supplied;
- target duration if supplied;
- jurisdiction/industry constraints if supplied.

Outputs:
- `input/concept.md`;
- initial `course.yaml`/course manifest;
- assumptions/gaps list.

Do not invent critical audience/jurisdiction constraints silently. The autonomous default may make reasonable non-high-stakes assumptions and record them.

## S1 — Research Brief

Outputs should define:
- purpose/audience;
- scope and exclusions;
- research questions;
- source-quality hierarchy;
- legal/regulatory jurisdiction where relevant;
- safety boundaries;
- planned dossier structure;
- evidence requirements;
- currentness/version requirements.

Reviewers: scope/completeness, evidence strategy, safety.

## S2 — Research Dossier

Human-readable output plus structured evidence data.

Minimum artifacts:

```text
research/research_dossier.md
research/sources.jsonl
research/claims.jsonl
research/review/
```

Source records should support IDs, title, author/organization, type, URL/DOI, date/version, access date, authority/jurisdiction, freshness/currentness notes, and licensing/quotation notes where relevant.

Claim records should support stable claim IDs, claim text or normalized proposition, claim category, supporting source IDs, relevant source location, jurisdiction, uncertainty/confidence, and downstream references.

## S3 — Instructional Design

Outputs:

```text
design/instructional_design.md
design/instructional_design.json
design/review/
```

Must include:
- content disposition (core/enrichment/reference/excluded);
- learning objectives;
- audience/prerequisite assumptions;
- scope/qualification boundaries;
- sequence/course map;
- module plans;
- practice/assessment strategy;
- objective-content-practice-assessment alignment;
- case/scenario strategy;
- duration estimate;
- glossary plan;
- evidence gaps;
- citation/source fidelity.

## S4 — Storyboard

Outputs:

```text
storyboard/storyboard.md
storyboard/storyboard.json
storyboard/review/
```

The storyboard must contain stable block IDs and complete learner-facing content, not placeholders. It must encode interaction behavior, correct answers, distractors, feedback/rationales, objective mapping, citation/source mapping, accessibility alternatives, visual specifications, glossary/reference elements, and assessment coverage.

## S5 — Editorial

Editorial changes may improve grammar, readability, flow, tone, repetition, and AI-like templating. Editorial work must not silently alter facts, citations, learning objectives, answer keys, qualification boundaries, or stable IDs.

Required structural diff before acceptance.

## S6 — Visual Direction

Outputs:

```text
visual/design-brief.md
visual/design-tokens.json
visual/component-plan.json
visual/visual-specs.json
```

Defines topic-appropriate visual direction, information-density rules, typography, spacing, color tokens, diagram style, motion rules, icon policy, responsive behavior, component selections, and each storyboard visual's semantic purpose.

## S7 — Course Model

Canonical structured representation consumed by the renderer.

```text
model/course.json
model/build-manifest.json
```

Must encode modules/screens/blocks/interactions/scoring/citations/glossary/references/visuals/progress/completion/accessibility metadata and traceability IDs.

## S8 — Course Build

Outputs:

```text
build/index.html
build/assets/            # only if development build needs assets
build/build-report.json
```

Primary release target is a self-contained single-file HTML bundle with embedded CSS, JS, SVG/icon assets, and course data. External source/reference URLs are allowed; runtime JS/CSS dependencies should not be required by the released course.

## S9 — Course QA

Outputs include:

```text
review/factual-review.json
review/gap-analysis.json
review/content-integrity.json
review/instructional-review.json
review/assessment-review.json
review/accessibility-review.json
review/ui-review.json
review/ux-review.json
review/functional-tests.json
review/screenshots/
review/consolidated-review.md
review/repair-plan.json
review/regression-report.json
```

QA must produce controlled repairs and rerun affected tests.

## S10 — Release

Outputs:

```text
release/course.html
release/qa-report.md
release/release-manifest.json
release/source-report.md
```

Release is blocked by configured blocker/critical findings, failed deterministic tests, missing required artifacts, or unresolved source/citation integrity failures.

## Artifact manifest

Every canonical artifact should have a sidecar manifest or registry entry containing at least:

- artifact ID;
- stage;
- filename/path;
- version;
- producer (human/Claude/Codex/imported);
- source/parent artifacts;
- schema version;
- hash;
- created/modified timestamps;
- human-modified flag;
- approval/lock status;
- review status;
- superseded-by relationship;
- notes/conflicts.

## Human artifacts

Imported human work is never overwritten in place. Preserve original bytes in `input/originals/` or an immutable version snapshot. A human-approved downstream artifact may become canonical while retaining its provenance.

## Entry at any stage

When a user supplies an artifact and declares its stage:

1. preserve original;
2. parse/normalize;
3. validate against stage contract;
4. generate an intake/gap report;
5. obey requested mode: `preserve`, `review-only`, `improve`, or `rebuild`;
6. continue only from the canonical artifact created/approved through this process.

