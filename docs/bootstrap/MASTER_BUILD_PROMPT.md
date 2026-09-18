# MASTER BUILD PROMPT — COURSEFORGE

You are building **CourseForge** in this repository.

CourseForge is intended to become a polished public portfolio project and a genuinely usable local software system, not a prompt demo. Your job is to read the complete bootstrap package in this repository, inspect the current environment, plan carefully, and then implement and validate the working system to the highest practical standard.

The repository currently contains specifications, templates, and a real end-to-end example course lineage. Treat these as authoritative product requirements unless implementation reality requires a documented adjustment. The example outputs are a **quality floor, not the target**. CourseForge should ultimately create outputs that are substantially more professional, consistent, visually sophisticated, accessible, testable, and maintainable than the included example HTML.

---

## MODE-AWARE INSTRUCTIONS

### If you are currently in Plan Mode

Do **not** start implementation.

Your task in Plan Mode is to perform a deep implementation analysis and produce an executable plan. Use parallel subagents for independent investigation. Inspect the local machine/repository before planning around assumptions.

At minimum delegate these planning workstreams in parallel where your harness supports it:

1. **Architecture/state/router analyst** — core interfaces, state machine, schemas, deterministic routing, provenance, course folder model.
2. **Environment/bootstrap analyst** — current machine/environment, cross-platform setup, `doctor`, dependency installation/repair, fresh-clone UX.
3. **Claude/Codex compatibility analyst** — current official native project instructions, non-interactive execution, structured outputs, subagent/parallel capabilities, adapter boundaries.
4. **Dependency/license analyst** — verify the current selected repositories/packages, maintenance, licenses, Node compatibility, exact local installation approach, and redistribution implications.
5. **Course-pipeline/artifact analyst** — inspect the chemical-risk example lineage and map it into stage contracts, data models, traceability, review gates, and import/continuation flows.
6. **UI/graphics analyst** — reusable course component architecture, Storybook, Mermaid/SVG.js/Vega-Lite/D3/Lucide routing, single-file HTML compilation, visual quality system.
7. **QA/test analyst** — unit/integration/browser/accessibility/fixture/CI strategy, release gates, regression testing, existing HTML review/improvement.

Wait for all required planning subagents. Reconcile conflicts rather than simply concatenating their notes.

Before finishing Plan Mode, create or update an implementation plan in the repository under an appropriate path such as:

`docs/exec-plans/active/courseforge-v1.md`

The plan must include:

- current environment findings;
- assumptions and unresolved risks;
- exact target repository structure;
- dependency choices and license notes;
- shared-core interfaces;
- Claude adapter design;
- Codex adapter design;
- stage/state data model;
- tool/skill/reviewer registries;
- deterministic routing/fallback model;
- course artifact manifests and course folder structure;
- ingestion strategy;
- reviewer/adjudicator/repair loop;
- human-gate behavior;
- visual/component/graphics system;
- HTML compiler architecture;
- browser/accessibility QA;
- setup/doctor/repair UX;
- CLI surface;
- test architecture;
- CI/release/public documentation;
- implementation phases and integration checkpoints;
- which workstreams can be safely parallelized;
- requirement-to-test mapping covering `specs/10_ACCEPTANCE_TESTS_AND_DEFINITION_OF_DONE.md`;
- explicit list of anything in these specs that you propose to alter, defer, or implement differently, with rationale.

Do not reduce scope just to make the plan shorter. If a requirement is large, phase it while preserving the target architecture.

When the plan is complete, stop planning and wait for execution permission/model switch. Do not ask questions whose answers already exist in this repository.

### If you are no longer in Plan Mode / execution is permitted

Execute the approved plan autonomously. Re-read the active plan and relevant specifications first. Use parallel subagents/worktrees for independent implementation work, integrate continuously, run tests at checkpoints, fix failures, and continue until the definition of done is met or you hit a genuine external blocker such as authentication/OS permission that cannot be resolved programmatically.

Do not repeatedly ask for confirmation during normal implementation. Preserve a clear written record of any unavoidable deviations from the approved plan.

---

# 1. READ THE BOOTSTRAP MATERIAL FIRST

Before editing code, read:

- `README_START_HERE.md`
- every file under `specs/`
- representative files under `templates/`
- `agent-instructions/`
- `tooling-sources/`
- `examples/chemical-risk/README.md`
- the chemical-risk artifact lineage enough to understand the actual workflow, including the final HTML and QA report.

Do not assume the example's implementation architecture is desirable. It is evidence of required functionality and artifact lineage.

---

# 2. INSPECT THE EXISTING ENVIRONMENT BEFORE INSTALLING ANYTHING

This is mandatory.

Inspect at least:

- operating system / architecture;
- Git and version;
- Node and npm and versions;
- Claude Code availability/version;
- Codex availability/version;
- current repository/Git state;
- existing local package files/dependencies;
- existing project-local `.claude`/`AGENTS.md`/agent configuration if present;
- any relevant globally installed tools only to understand the environment, not to create a hidden dependency;
- browser/runtime prerequisites needed by Playwright;
- whether this folder already contains user work that must be preserved.

Do not modify or remove unrelated user-global tools/configuration.

CourseForge must ultimately be self-contained at the repository level. A global skill/plugin may exist, but correct operation cannot depend on it.

If the current machine lacks a prerequisite such as a sufficiently recent Node version, plan and implement a safe detection/error/installation path. Do not silently make system-wide changes without the normal OS permission flow.

---

# 3. TECHNICAL DIRECTION

Unless current compatibility research reveals a compelling reason otherwise, implement the core in **TypeScript on Node.js** with strict typing and a committed npm lockfile.

Keep the runtime/developer dependency set disciplined. Favor mature maintained libraries over custom reimplementation where appropriate, but keep CourseForge's orchestration/state/routing logic owned by CourseForge.

Core development capabilities include:

- Playwright;
- axe-core;
- Storybook for the internal component workshop;
- Lucide/static SVG icons;
- Mermaid + Mermaid CLI;
- SVG.js;
- Vega/Vega-Lite;
- D3 only for advanced cases.

Re-check current package names/versions/Node requirements/licenses before installing them. Do not blindly copy versions from this prompt.

Do not make React, Python, Docker, a database server, Figma, Excalidraw, or proprietary authoring tools mandatory for v1 unless you can demonstrate a strong need and document the tradeoff. Released courses should remain portable single-file HTML where practical.

---

# 4. CLAUDE CODE AND CODEX MUST BOTH BE FIRST-CLASS

Implement one provider-neutral core plus thin agent-harness adapters.

The shared pipeline must never directly depend on Claude- or Codex-specific CLI behavior outside adapter modules.

## Claude Code

Use project-scoped capabilities (`CLAUDE.md`, `.claude/...`) and create the real CourseForge project skills/subagents/rules needed by the system. Keep always-loaded instructions concise. Use subagents for context isolation and parallel specialist work.

## Codex

Create a concise root `AGENTS.md` and any directory-scoped instructions needed. Use the current Codex CLI's supported non-interactive/structured mechanisms in the adapter. Verify the current official CLI rather than relying on assumptions.

## Agent backend behavior

Support at least:

`auto | claude | codex`

Record selected backend and version in each execution plan/provenance record. Fallback must be explicit and logged.

Where native subagents are unavailable in a specific invocation mode, CourseForge may coordinate separate concurrent harness processes with strict file ownership/concurrency control.

---

# 5. PROGRAMMATIC ROUTING IS A NON-NEGOTIABLE FEATURE

Do not build a system where the model sees every skill/tool and improvises.

Create validated registries for:

- stages;
- tools;
- skills;
- reviewers;
- routes;
- fallbacks;
- human-gate/review policy.

Before any stage executes, deterministic code must produce a saved execution plan that resolves:

- backend;
- input artifacts;
- allowed stage transition;
- skills;
- tools/renderers;
- reviewers;
- validators;
- fallback behavior;
- human gate;
- writable/read-only paths;
- timeout/retry limits;
- expected outputs.

AI may perform semantic classification into a controlled enum when meaning must be interpreted. Code then maps that enum to the actual tool/skill.

Example: the model may classify a storyboard visual as `TIMELINE`; deterministic routing chooses Mermaid.

Unknown/invalid classifications fail schema validation instead of becoming arbitrary prose.

Every routing decision must be logged.

---

# 6. BUILD THE FULL STAGE PIPELINE

Canonical stages:

- CONCEPT
- RESEARCH_BRIEF
- RESEARCH_DOSSIER
- INSTRUCTIONAL_DESIGN
- STORYBOARD
- EDITORIAL
- VISUAL_DIRECTION
- COURSE_MODEL
- COURSE_BUILD
- COURSE_QA
- RELEASE

Implement a state machine and stage contracts.

The system must support:

- concept → release autonomous run;
- any start stage → any valid later target stage;
- stop at an intermediate target stage;
- resume/continue;
- imported artifacts;
- human review/approval/edit/replacement at each major stage;
- multiple versions/canonical artifact selection;
- bounded repair cycles;
- failed/waiting/superseded/locked states.

Do not rely on chat history as project state.

---

# 7. EVERY COURSE IS SELF-CONTAINED

All course-specific inputs, research, design, storyboard, visual specs, course model, builds, reviews, screenshots, logs, versions, and releases must sit under one `courses/<course-id>/` directory.

Reusable CourseForge source code/components/configuration remain outside course folders.

A course folder should be portable as an audit trail.

Imported original files are immutable/preserved.

---

# 8. ENTRY FROM ANY PRODUCTION STAGE

Build a real ingestion layer.

At minimum robustly support Markdown/text/HTML/JSON. Implement DOCX and PDF adapters if mature local parsing can be integrated reliably during v1; PPTX is desirable but secondary.

Support declared stage and stage inference.

Support import modes:

- preserve;
- review-only;
- improve;
- rebuild.

Validation must compare imported content against the declared/inferred stage contract and produce an intake/gap report.

Do not overwrite human files in place.

---

# 9. REVIEW ENSEMBLES, ADJUDICATION, AND CONTROLLED REPAIR

Each major stage has multiple reviewers. Use isolated parallel subagents for independent reviewers where practical.

Reviewers return schema-valid findings only; they do not all edit the artifact.

Implement finding severities:

- blocker;
- critical;
- major;
- minor;
- style.

A separate adjudication step:

- deduplicates;
- resolves conflicts;
- checks recommendations against upstream evidence and human locks;
- creates one repair plan.

A repair agent edits only according to the approved repair plan. Then validators and relevant reviewer/test subsets rerun.

Default automated repair-cycle cap: 3, configurable.

---

# 10. OPTIONAL HUMAN GATE AT EVERY MAJOR STAGE

Support at least:

- auto;
- human;
- hybrid.

Humans must be able to approve, reject, edit externally and re-ingest, replace, lock content, accept/reject findings, and request another review.

Human-approved/locked artifacts are authoritative downstream unless they conflict with a higher-order evidence rule; in that case surface a conflict rather than silently rewriting.

---

# 11. RESEARCH / EVIDENCE / TRACEABILITY

Implement structured source and claim stores alongside human-readable research.

Maintain stable IDs and lineage from source → claim → research → objective → storyboard block → assessment → course-model component → rendered HTML.

Traceability must be queryable in both directions and visible in release/QA metadata.

Do not fabricate citations or silently turn guidance/recommendations into legal/universal requirements.

High-stakes subjects must retain qualification/safety boundaries and stronger human-review defaults.

---

# 12. INSTRUCTIONAL DESIGN / STORYBOARD CORE

Build CourseForge-native skills and schemas for:

- research planning;
- research/research review;
- instructional design;
- alignment review;
- storyboard authoring;
- scenario design;
- assessment design/review;
- editorial/humanization;
- course gap analysis.

Use the included chemical-risk prompts/artifacts as concrete evidence of required depth and completeness, but create a cleaner programmatic architecture than giant prompts.

Storyboard output must be both human-readable and machine-readable and contain stable IDs, complete content, interaction logic, citations, feedback, assessment metadata, accessibility alternatives, and visual specs.

---

# 13. VISUAL DIRECTION IS ITS OWN STAGE

Create a real visual design brief and token system before HTML implementation.

Build a reusable, high-quality course component library and develop/test it in Storybook. Do not recreate basic buttons/quiz layouts independently for every course.

Create a small set of professional course visual families and allow controlled topic-appropriate variation.

Use Lucide as a controlled icon vocabulary.

The final system should produce visibly more professional work than `examples/chemical-risk/06_interactive_course.html`.

---

# 14. INSTRUCTIONAL GRAPHICS

Implement structured visual specifications and deterministic renderer selection.

Default routing:

- flow/process/timeline/sequence/state → Mermaid;
- lifecycle/comparison/hierarchy/responsibility and other reusable conceptual patterns → CourseForge native SVG archetypes / SVG.js;
- standard quantitative chart → Vega-Lite;
- advanced/custom interactive data visualization → D3;
- icons → Lucide;
- illustrative AI imagery → optional provider adapter only, never core requirement.

Prefer compiling diagrams/charts into inline SVG for the single-file release.

Every instructional graphic requires a useful text equivalent and source/evidence mapping where appropriate.

---

# 15. COURSE MODEL AND HTML COMPILER

Do not compile a 20,000-word Markdown storyboard directly through ad-hoc template logic.

Build a canonical `course.json` (or equivalent strongly validated model) that the renderer consumes.

The renderer/component system must support:

- course/menu/progress shell;
- modules/screens/blocks;
- responsive content layouts;
- progressive disclosure;
- citations/source panels;
- glossary/acronyms;
- reference library;
- scenarios;
- single choice;
- multiple response;
- matching;
- categorization;
- sequencing with keyboard-operable alternatives;
- feedback/rationales;
- graded assessment;
- score/results/review;
- progress/reset/resume where browser storage allows;
- accessibility metadata;
- stable traceability `data-*` attributes.

Primary release artifact: a single self-contained HTML file with embedded CSS/JS/data/SVG/icons and no required framework/runtime/CDN for core use.

---

# 16. EXISTING HTML REVIEW AND IMPROVEMENT

The included example HTML must be usable as a test case.

CourseForge must be able to ingest an existing HTML course and:

- preserve the original;
- parse its DOM/source;
- reconstruct a normalized model to a useful degree;
- identify structure/interactions/assessment/scoring/citations/navigation/progress/accessibility;
- launch it in Chromium;
- run functional tests;
- run axe;
- capture responsive screenshots;
- perform fact/content/gap/instructional/assessment/UI/UX/accessibility review;
- adjudicate findings;
- produce controlled repairs;
- regression-test the improved version.

This capability is as important as greenfield course generation.

---

# 17. ENVIRONMENT SETUP / DOCTOR / SELF-REPAIR

Implement cross-platform first-run setup and ongoing environment verification.

Target user experience:

Windows:

```powershell
git clone <repo>
cd CourseForge
.\setup.ps1
```

macOS/Linux:

```bash
git clone <repo>
cd CourseForge
./setup.sh
```

Setup should:

- inspect prerequisites;
- install repo-local npm dependencies through lockfile;
- install Playwright Chromium if needed;
- validate CourseForge config/schemas/skills;
- run a smoke fixture;
- generate environment manifest;
- report any authentication/manual OS permission boundary clearly.

`courseforge doctor` should be idempotent and able to repair repo-local problems.

Do not globally install development packages merely for convenience.

---

# 18. TESTING AND RELEASE GATES

Implement the acceptance suite in `specs/10_ACCEPTANCE_TESTS_AND_DEFINITION_OF_DONE.md`.

At minimum use:

- type checking;
- lint/format checks if adopted;
- unit tests;
- integration tests;
- adapter fixture tests;
- stage/state/router tests;
- renderer/component tests;
- Playwright E2E tests;
- axe accessibility tests;
- screenshot/responsive checks;
- example/fixture ingestion tests;
- clean-install smoke test.

Do not declare the build complete because TypeScript compiles.

Course releases must be blocked by configured blocker/critical findings and deterministic test failures.

---

# 19. PARALLEL IMPLEMENTATION RULES

Use parallel subagents aggressively where it is safe, but coordinate writes.

Preferred implementation streams are documented in `specs/14_BUILD_PARALLELIZATION_PLAN.md`.

When multiple agents need to edit code, give them disjoint directory ownership or Git worktrees. The main coordinator integrates, resolves interface conflicts, and runs the cross-cutting test suite.

Do not let several agents concurrently rewrite package manifests or the same core interfaces.

At integration checkpoints, run tests and fix issues before launching the next major wave.

---

# 20. SECURITY / LICENSES / PORTFOLIO QUALITY

Perform a real license review before vendoring any upstream code/skills/prompts. Keep notices and attributions. Prefer normal package dependencies when appropriate.

Never commit credentials, auth tokens, local histories, secret environment values, or absolute machine paths.

Add CI suitable for a public GitHub repository.

Create high-quality public documentation with:

- what CourseForge does;
- screenshots/architecture diagrams where appropriate;
- installation;
- quick start;
- course lifecycle;
- arbitrary-stage ingestion;
- human review modes;
- Claude/Codex compatibility;
- deterministic routing explanation;
- graphics architecture;
- QA/review model;
- example workflow;
- troubleshooting;
- limitations;
- development/contribution notes.

The repository should clearly demonstrate engineering quality and thoughtful agent-system architecture to a portfolio reviewer.

---

# 21. DO NOT SIMPLY COPY THE BOOTSTRAP PACKAGE INTO THE FINISHED ARCHITECTURE

These specs describe requirements. Refactor them into a coherent final codebase/docs structure.

Create concise root `CLAUDE.md` and `AGENTS.md` files as maps to the repository, not huge always-loaded instruction dumps.

Move task-specific workflows into skills/rules/agents and programmatic configuration.

---

# 22. DEFINITION OF SUCCESS

The task is not complete until CourseForge is a working tested system, not just a scaffold.

At minimum, demonstrate:

1. `setup`/`doctor` works on the current machine and the design supports fresh clones.
2. The state/router/config/schemas are implemented and tested.
3. Claude and Codex adapters exist with fixture tests and optional live smoke behavior.
4. A course project can be created and moved between stages.
5. An artifact can be ingested at a declared intermediate stage.
6. Review panels/adjudication/repair mechanics work on fixtures.
7. Course model → single-file HTML build works.
8. Structured graphics compile.
9. Playwright/axe QA works.
10. The included chemical-risk HTML can be ingested and browser-reviewed.
11. Human gates and locked artifacts work.
12. Logs/provenance/execution plans are generated.
13. Public docs and CI are credible.
14. The automated acceptance suite passes, aside from explicitly documented tests that require unavailable live provider authentication.

If tests fail, diagnose and repair them. If you discover a better architecture that still satisfies the requirements, implement it and document the reasoning rather than mechanically following a weak detail.

Do not reduce the product to a scripted sequence of giant prompts.

Build CourseForge as an actual **course engineering harness**.

