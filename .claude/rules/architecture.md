---
paths:
  - "src/**/*.ts"
---

# Architecture rules for `src/`

- **Provider-neutral core.** Pipeline, routing, review, artifacts, renderer, QA and release code never mention a specific agent CLI. Only `src/harness/**` knows about Claude Code or Codex (binaries, flags, output formats). Use the `AgentHarness` interface everywhere else.
- **One spawn point.** Only `src/core/proc.ts` may import `child_process` (via `cross-spawn`, `shell: false`, prompts on stdin). A boundary test fails the build otherwise.
- **Deterministic routing.** Which stage, skill, tool, reviewer, renderer or fallback runs is decided by `config/*.json` through `src/routing` (pure functions), recorded in the saved execution plan and `routing-decisions.jsonl` before any agent work. Agents only return closed-enum classifications; code maps enums to tools. Never let a prompt or agent choose a tool.
- **Schemas are the source of truth.** zod schemas in `src/core/schemas/` define every artifact and agent output. After changing one, run `npm run gen:schemas` and commit the regenerated `schemas/*.schema.json`; a drift test compares them. Agent-facing schemas stay flat and strict (all properties required, optional values nullable, no `$ref`).
- **Prompts are data.** Templates in `prompts/templates/` use only the documented `{{variables}}`; rubrics live in `prompts/rubrics/`; skills in `.claude/skills/`. Do not embed prompt prose in TypeScript.
- **Writes are guarded.** Agent steps run inside `guarded()`: snapshot, hash-walk, rollback on writes outside the plan's writable paths, then `verifyLocks`. Do not bypass it for convenience.
- **Course isolation.** All course reads and writes stay under `courses/<id>/`. Use the atomic-write helpers in `src/core/fsx.ts`.
- **No global dependencies.** Never read or modify `~/.claude`, `~/.codex` or global npm configuration; never assume globally installed tools.
