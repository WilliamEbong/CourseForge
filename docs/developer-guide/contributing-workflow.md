# Contributing workflow

## Setup

```sh
./setup.sh          # or .\setup.ps1; installs, builds and runs the smoke fixture
npm run doctor
```

A development checkout can run the CLI from sources: `node bin/courseforge.mjs` uses `tsx` when `dist/` is
missing. After changing `src/`, run `npm run build` (or `courseforge doctor --repair`) before using the compiled
CLI.

## Checks

| Command | When |
|---|---|
| `npm run typecheck` | Every change |
| `npm run lint` | Every change (Biome; `npm run format` to fix formatting) |
| `npm test` | Every change: unit + integration, offline, fake harness |
| `npm run test:e2e` | Changes to the renderer, components, runtime, graphics or QA |
| `npx tsx scripts/gen-schemas.ts --check` | After touching `src/core/schemas/`; regenerate with `npm run gen:schemas` |
| `npx tsx scripts/gen-demo-fixtures.ts --check` | After touching agent-facing schemas or stage handlers; regenerate without `--check` |
| `npm run test:acceptance` | Before a release: prints the A–L requirement matrix |
| `npm run ci` | typecheck + lint + test + e2e in one go |

CI runs the same commands ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). Do not run e2e while
another browser-heavy process (another e2e run, a live course run) is active on a low-memory machine.

## Acceptance tags

Tests that cover a requirement from the acceptance specification carry its ID in the test title, for example
`it('@C6 retry limit stops after 3 cycles', …)`. `scripts/acceptance.mjs` runs Vitest and Playwright with JSON
reporters, collects `@A1`…`@L7` tags and reports covered/passed/failed/missing per ID; it exits non-zero if a
tagged test fails or an ID has no test (`--allow-missing` to relax, `--no-e2e` to skip Playwright,
`--out <file>` to write the matrix). The mapping is in [testing.md](testing.md).

## Rules that reviews enforce

- Only `src/harness/**` may know about `claude` / `codex`; only `src/core/proc.ts` may spawn processes
  (`tests/unit/arch/boundary.test.ts`).
- Routing decisions live in `config/*.json` and `src/routing`; never let a prompt choose a tool.
- zod schemas in `src/core/schemas/` are the source of truth. Agent-facing schemas stay flat and strict (all
  properties required, optional values nullable, no `$ref`); `src/core/wire-schema.ts` converts and lints them.
- Prompt text lives in `prompts/` and `.claude/skills/`, not in TypeScript.
- Course files are written only through `src/core/fsx.ts` helpers and only under `courses/<id>/`.
- Tests are deterministic: inject clocks, seeds and runners; no network; no live agents unless
  `COURSEFORGE_LIVE=1`.
- No new runtime dependency without a licence check and a `THIRD-PARTY.md` entry
  ([dependency-policy.md](dependency-policy.md)).

## Parallel work

CourseForge was built by several agents working in one tree with **disjoint directory ownership**; the same
rules apply to human contributors working in parallel:

- Agree who owns which directories before starting; do not edit files outside your area.
- One owner (the coordinator) edits `package.json`, the lockfile, `tsconfig*.json`, `biome.json`, test runner
  configs and shared interface files (`src/core/*`, `src/harness/types.ts`, `src/pipeline/api.ts`).
- Integrate through the documented interfaces (`PipelineApi`, `AgentHarness`, zod schemas), not by reaching into
  another module's internals.
- Use separate git worktrees only when directories cannot be kept disjoint; each needs its own install.
- Never commit, stash or rewrite history on someone else's behalf.

## Commits and pull requests

Commit messages: `<type>: <description>` with types `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`,
`ci`. Pull requests use the template in `.github/pull_request_template.md`: summary, linked requirement IDs,
checks run, and any deviation from the architecture (which needs an [ADR](../adr/README.md)).
