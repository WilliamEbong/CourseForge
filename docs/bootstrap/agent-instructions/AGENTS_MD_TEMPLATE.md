# CourseForge — Agent Instructions

This repository builds CourseForge, a deterministic artifact-driven e-learning production system. Detailed requirements live under `docs/` or `specs/`; treat this file as a table of contents and project-wide working agreement.

## Non-negotiables

- Shared pipeline/core must be agent-provider neutral.
- Codex-specific invocation belongs only in the Codex harness adapter.
- Deterministic code selects stages, tools, skills, reviewers, fallbacks, and validators wherever possible.
- Preserve human/imported originals and locked canonical artifacts.
- All course-specific files live in one `courses/<course-id>/` folder.
- Repo-local dependencies/configuration must be sufficient; do not depend on user-global agent instructions/plugins.
- Use parallel subagents for independent work, with disjoint ownership/worktrees for concurrent edits.
- Validate structured output and run tests required by the touched area.
- Never commit credentials or machine-specific secrets.

## Source of truth

Read the product/architecture/stage/routing/QA specifications before implementing cross-cutting behavior. If docs and code disagree, surface the conflict and update both intentionally.

## Build/test commands

Replace this section with the actual commands once implemented and keep it current.

