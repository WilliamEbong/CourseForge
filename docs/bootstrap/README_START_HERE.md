# CourseForge Bootstrap Kit

This package is the specification and reference bundle for building **CourseForge**: a local, autonomous, review-driven e-learning production system that can take a concept or an artifact from any stage of course production and carry it to any later stage, including a finished, tested, portable interactive HTML course.

## What to do with this package

1. Place the **contents of this zip** into the root of your empty `CourseForge` folder.
2. Open that folder in Claude Code.
3. Use **Plan Mode** first with your preferred planning model (the intended workflow is Fable for planning).
4. Paste the complete contents of `MASTER_BUILD_PROMPT.md`.
5. Let the planning pass inspect the files, inspect your machine/environment, and produce a concrete implementation plan. Do not ask it to code while you are still in Plan Mode.
6. Switch to **Opus** for implementation, leave Plan Mode, and tell it to execute the approved plan autonomously. `OPUS_EXECUTION_HANDOFF.md` contains a concise handoff prompt if needed.

The same repository must also work with **Codex**. CourseForge's architecture therefore uses a shared deterministic core and thin harness adapters rather than depending on Claude-only behavior.

## Important: the included course is an example, not the target quality

`examples/chemical-risk/` contains the real artifacts produced during the design of one portfolio course:

- research brief;
- first research pass;
- expanded research dossier;
- instructional-design blueprint;
- original storyboard;
- humanized storyboard;
- final single-file HTML course;
- HTML QA report;
- the instructional-design/storyboard prompts used in that workflow.

These examples exist to show the **artifact lineage, level of completeness, evidence/citation preservation, and stage relationships** that CourseForge must support.

They are a **quality floor and regression fixture, not a visual or engineering target**. CourseForge should produce outputs that are more professional, more consistent, more traceable, more visually sophisticated, more accessible, more deeply tested, and easier to maintain than the examples.

## Core product requirements

CourseForge must:

- operate locally as a repository-contained system;
- be straightforward to install after cloning from GitHub;
- inspect and validate the user's environment before doing work;
- install or repair its own repo-local dependencies during setup;
- avoid relying on globally installed skills/plugins/configuration for correct operation;
- support Claude Code and Codex as agent backends;
- use programmatic stage/tool/skill/reviewer routing wherever possible;
- use AI for semantic reasoning, not for decisions that deterministic code can make;
- support parallel subagents for independent work and reviewer panels;
- allow optional human review at every major stage;
- accept human/AI artifacts at any stage and continue to a requested downstream stage;
- preserve originals and human-approved artifacts;
- review and improve existing research, design docs, storyboards, and HTML courses;
- fact-check, perform gap analysis, run instructional review, assess accessibility, test UI/UX, run real browser tests, and apply controlled repairs;
- keep all course-specific files, evidence, state, reviews, screenshots, versions, and releases inside that course's folder;
- create portable single-file HTML courses as a primary output;
- produce deterministic structured graphics where possible rather than relying on decorative AI imagery;
- maintain source/claim/objective/storyboard/assessment/implementation traceability;
- log environment, routing, review, repair, and release decisions;
- include strong automated tests and a sample smoke-course fixture.

## Read these specifications in order

1. `specs/01_PRODUCT_VISION_AND_SCOPE.md`
2. `specs/02_ARCHITECTURE_AND_PIPELINE.md`
3. `specs/03_STAGE_CONTRACTS_AND_ARTIFACTS.md`
4. `specs/04_REVIEWERS_HUMAN_GATES_AND_ADJUDICATION.md`
5. `specs/05_DETERMINISTIC_ROUTING_AND_TOOL_POLICY.md`
6. `specs/06_ENVIRONMENT_BOOTSTRAP_AND_PORTABILITY.md`
7. `specs/07_CLAUDE_CODE_AND_CODEX_COMPATIBILITY.md`
8. `specs/08_VISUAL_GRAPHICS_AND_UI_SYSTEM.md`
9. `specs/09_EXISTING_ARTIFACT_REVIEW_AND_IMPROVEMENT.md`
10. `specs/10_ACCEPTANCE_TESTS_AND_DEFINITION_OF_DONE.md`
11. `specs/11_REPOSITORY_AND_COURSE_FOLDER_LAYOUT.md`
12. `specs/12_DEPENDENCIES_AND_EXTERNAL_REPOS.md`
13. `specs/13_SECURITY_PRIVACY_AND_LICENSE_POLICY.md`
14. `specs/14_BUILD_PARALLELIZATION_PLAN.md`
15. `specs/15_QUALITY_BAR_AND_EXAMPLE_USAGE.md`

## Design principle

CourseForge should not be a collection of giant prompts. It should be an **artifact-driven software system** with:

- explicit stage contracts;
- schemas;
- a state machine;
- a capability registry;
- deterministic routing;
- isolated specialist agents;
- reviewer ensembles;
- adjudication;
- automated validation;
- optional human gates;
- browser-based QA;
- provenance and traceability.

The intended relationship is:

```text
AI: semantic reasoning, research, synthesis, instructional judgment, critique, repair reasoning
Code: environment checks, dependency management, stage progression, routing, schemas, validation,
      artifact tracking, browser execution, scoring verification, logging, packaging
```

