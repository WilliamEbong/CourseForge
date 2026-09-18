# ADR 0007: Harness interface reduced to `probe` + `run`

## Context

The specification sketched a richer adapter interface (`runTask`, `runStructured`, capability flags for
subagents and parallel work). Both CLIs are driven headlessly with a prompt on stdin and a structured result.

## Decision

`AgentHarness = { name, probe(), run(request) }` (`src/harness/types.ts`). Every task is structured: the request
carries the output schema, write mode (`findings-only`, `structured`, `artifact-write`), tools, paths and limits.
Parallelism is owned by CourseForge (process pools capped at 3), not by native subagents. Adapters take an
injectable runner so recorded output replaces the CLI in tests. `.claude/agents/` still provides subagents for
interactive use.

## Consequences

- Adding a backend means one adapter: argv construction, output parsing and failure classification.
- Behaviour is identical across backends; a backend without subagents loses nothing.
