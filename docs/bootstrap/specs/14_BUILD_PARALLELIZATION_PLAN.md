# 14 — Build Parallelization Plan

This specification is for the agent that will build CourseForge itself.

## Planning pass

In Plan Mode, use parallel subagents to inspect independent aspects before producing the implementation plan. Suggested planning roles:

1. **architecture/state/router analyst** — derive core interfaces, state machine, schemas, CLI boundaries;
2. **environment/bootstrap analyst** — inspect current machine and design cross-platform setup/doctor;
3. **Claude/Codex compatibility analyst** — verify native project instructions, non-interactive invocation, structured outputs, subagent capabilities;
4. **dependency/license analyst** — verify current selected repos/packages, licenses, Node compatibility, local install commands;
5. **course pipeline/artifact analyst** — map examples/specs into stage contracts and traceability;
6. **UI/graphics analyst** — design component/graphics architecture and compile-to-single-HTML strategy;
7. **QA/test analyst** — design unit/integration/e2e/fixture/CI strategy.

Wait for all planning reviewers, reconcile conflicts, and write one executable plan with requirement-to-test mapping.

## Implementation pass

After plan approval and execution permission, use parallel agents only with clear ownership.

Suggested workstreams:

### A — Core/state/schemas
Owns:
- core types;
- config schemas;
- state machine;
- artifact registry;
- execution-plan data model.

### B — Environment/bootstrap/CLI
Owns:
- setup scripts;
- doctor;
- dependency verification;
- CLI command shell;
- environment manifest.

### C — Harness adapters
Owns:
- Claude adapter;
- Codex adapter;
- process/structured-output handling;
- adapter fixture tests.

### D — Pipeline/reviews/ingestion
Owns:
- stage contracts;
- ingestion/normalization;
- reviewer orchestration;
- adjudicator/repair plan mechanics;
- human-gate state.

### E — Renderer/components/graphics
Owns:
- course model;
- component library;
- graphics routing/rendering;
- single-file HTML compiler;
- Storybook development surface.

### F — QA/browser/accessibility
Owns:
- Playwright harness;
- axe integration;
- screenshot/viewport tests;
- interaction/scoring tests;
- existing-HTML review primitives.

### G — Documentation/public-repo quality
Owns:
- public README;
- user/developer docs;
- examples/fixtures;
- license/attribution records;
- GitHub Actions.

## Conflict avoidance

Use worktrees or disjoint directories for agents making code changes in parallel. The coordinator owns integration and final cross-cutting fixes. Do not assign multiple subagents to freely edit `package.json`, root config, or the same core interfaces concurrently.

## Integration checkpoints

Recommended checkpoints:

1. schemas/state/router compiling;
2. setup/doctor ready;
3. harness adapters fixture-tested;
4. stage engine + review loop fixture-tested;
5. course model/renderer works;
6. browser/axe QA works;
7. chemical-risk example intake/improvement test works;
8. clean fresh-clone smoke test;
9. docs/CI/release readiness.

At every checkpoint run typecheck/lint/tests rather than postponing integration until the end.

