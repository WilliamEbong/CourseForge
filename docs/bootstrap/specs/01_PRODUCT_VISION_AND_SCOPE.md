# 01 — Product Vision and Scope

## Product definition

CourseForge is a local, agent-assisted course engineering system that can originate, ingest, validate, research, design, author, edit, implement, fact-check, test, improve, and release complete e-learning courses.

It is intended to support two equally important workflows:

1. **Greenfield generation** — a user supplies a concept/topic and CourseForge autonomously develops it through research, instructional design, storyboard, visual design, implementation, QA, and release.
2. **Artifact continuation/improvement** — a user supplies an existing artifact (for example a research dossier, instructional-design document, storyboard, or HTML course), declares or allows detection of its stage, and CourseForge validates it and continues or improves it to a requested downstream stage.

The product is not a single prompt and is not tied to one model vendor. Claude Code and Codex are first-class supported execution harnesses.

## Primary user experience

The target experience after GitHub clone is:

```text
clone repository
→ run setup
→ authenticate supported agent harness if needed
→ courseforge doctor passes
→ use CourseForge
```

A user should not need to understand the individual installations or invocation details of Mermaid, Playwright, axe-core, SVG.js, Vega-Lite, D3, Storybook, Lucide, or the local skills/reviewers.

## Primary commands

The final CLI naming may be refined, but v1 must support the semantics below:

```text
courseforge setup
courseforge doctor
courseforge new <topic/title>
courseforge ingest <file> --stage <stage> --course <id>
courseforge run --course <id> --from <stage> --to <stage>
courseforge continue --course <id>
courseforge review --course <id> [--stage <stage>]
courseforge improve --course <id> [--input <file>]
courseforge status --course <id>
courseforge release --course <id>
courseforge package --course <id>
```

The implementation may expose them initially through `npm run ...` while retaining a clean CLI abstraction.

## Production stages

Canonical stages:

```text
S0  CONCEPT
S1  RESEARCH_BRIEF
S2  RESEARCH_DOSSIER
S3  INSTRUCTIONAL_DESIGN
S4  STORYBOARD
S5  EDITORIAL
S6  VISUAL_DIRECTION
S7  COURSE_MODEL
S8  COURSE_BUILD
S9  COURSE_QA
S10 RELEASE
```

Review is not one terminal stage. Every major stage has its own reviewer ensemble and optional human gate.

## Core principles

### Artifact-driven
Each stage consumes explicit artifacts and emits explicit artifacts. The system never relies on chat history as the sole source of project truth.

### Human-compatible
A human may enter, edit, replace, approve, lock, or reject an artifact at any stage. Human-approved artifacts are first-class and must not be silently overwritten.

### Evidence-preserving
Research sources, claims, qualifications, dates, jurisdictions, uncertainty, and citation relationships must propagate downstream.

### Deterministic where possible
AI performs semantic judgment. Code performs repeatable selection, routing, validation, state transitions, dependency checks, and execution.

### Review-driven
Generators do not self-certify. Independent reviewers create structured findings, an adjudicator consolidates them, a repair agent applies controlled changes, and validators retest.

### Portable
All reusable tooling lives in the CourseForge repository. All course-specific material lives inside one self-contained course folder.

### Local-first
The repository must run locally. Core course generation and testing must not require cloud infrastructure beyond the selected agent backend and web access needed for research.

### Provider-neutral architecture
Claude Code and Codex use the same pipeline/state/tool-routing core. Harness-specific adapters translate standardized CourseForge tasks into the native mechanisms of each provider.

## Scope of v1

v1 must include:

- environment inspection/bootstrap/repair;
- repository-local dependency management;
- Claude Code and Codex adapters;
- canonical schemas and state machine;
- course folder creation and artifact registry;
- entry at any major production stage;
- target-stage execution;
- multiple reviewers per stage;
- optional human gates;
- research/source/claim tracking structure;
- instructional-design and storyboard workflows;
- editorial/humanization workflow;
- visual-direction stage;
- structured diagram/chart routing;
- reusable HTML course component system;
- single-file HTML compilation;
- Playwright browser QA;
- axe-core automated accessibility QA;
- responsive screenshot review inputs;
- existing HTML reverse-engineering and improvement;
- fact-check/gap-analysis workflow;
- release manifest and QA report;
- logging/provenance;
- automated tests and smoke fixture;
- documentation suitable for a public portfolio repository.

## Explicit non-goals for v1

Do not block v1 on:

- SCORM/xAPI packaging (design extension points, implement later);
- cloud-hosted orchestration;
- multi-user accounts;
- database servers;
- a heavy desktop GUI;
- Figma integration;
- proprietary authoring software;
- mandatory AI image generation;
- automatic professional/legal/medical authorization;
- replacing SME/human review for high-stakes content.

## Quality target

The example chemical-risk course is evidence that the pipeline can produce complete artifacts, but CourseForge should surpass it by providing:

- stronger visual systems;
- component consistency;
- better diagrams;
- deeper automated QA;
- better traceability;
- reviewer ensembles;
- deterministic routing;
- environment reproducibility;
- more professional responsive UI;
- easier maintainability and iteration.

