# CourseForge — Claude Code Project Instructions

CourseForge is an artifact-driven course engineering system. The detailed specifications live under `docs/` or `specs/`; this file is only the map and non-negotiable project rules.

## Always

- Run `npm run doctor` or the implemented equivalent before substantial pipeline work.
- Treat deterministic code/config as authoritative for stage/tool/skill/reviewer routing.
- Keep course-specific artifacts inside `courses/<course-id>/`.
- Preserve imported originals and human-approved/locked artifacts.
- Do not rely on global Claude skills/plugins/MCP configuration for correct operation.
- Use project-scoped skills/agents/rules.
- Use subagents for independent, context-heavy work and reviewer panels.
- Give parallel editors disjoint file ownership or isolated worktrees.
- Validate structured outputs against schemas.
- Run relevant tests after changes; do not declare completion with known failing tests.
- Never store secrets in the repository or logs.

## Architecture

Read the architecture/product docs before making cross-cutting changes. Core state/routing/artifacts must be provider-neutral. Claude-specific invocation belongs only in the Claude harness adapter.

## Build/test commands

Replace this section with the actual commands once implemented and keep it current.

