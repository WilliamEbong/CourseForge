# CourseForge: instructions for Claude Code

CourseForge is a TypeScript/Node course-engineering harness: a deterministic 11-stage pipeline (concept →
research → design → storyboard → editorial → visual direction → model → build → QA → release) that uses Claude
Code or Codex for semantic work and code for routing, validation, rendering, QA and release decisions.
Keep this file consistent with `AGENTS.md`.

## Sources of truth

- `docs/exec-plans/active/courseforge-v1.md`: the approved plan (architecture, decisions, test mapping)
- `docs/architecture/`: how the system works as built; `docs/adr/`: recorded deviations
- `docs/bootstrap/`: original requirements of record (read-only; do not treat as runtime code)
- `config/*.json`: registries (stages, reviewers, skills, tools, routing, fallbacks, review policy)
- `src/core/schemas/`: zod schemas for every artifact and agent output
- `.claude/rules/`: path-scoped rules (`architecture.md` for `src/`, `courses.md` for `courses/`, `testing.md`)

## Map

| Path | Contents |
|---|---|
| `src/cli`, `src/environment` | CLI (`help.ts` lists commands and exit codes), doctor/setup |
| `src/pipeline` | State machine, stage loop (`run-stage.ts`), stage handlers, write audit, public API (`api.ts`) |
| `src/routing` | Pure router: execution plans, backend selection, gates, visual routes |
| `src/harness` | Claude/Codex/fake adapters, prompt assembly, recording (only place that knows the CLIs) |
| `src/review`, `src/release` | Findings, adjudication, repair plans, scoped repair; release gate and reports |
| `src/ingestion`, `src/artifacts` | Any-stage import; artifact registry, versions, locks, trace graph |
| `src/graphics`, `src/renderer`, `components/course-ui` | Renderers, single-file HTML compiler, UI components and runtime |
| `src/qa` | Playwright contract runner, crawler, axe, regression |
| `prompts/templates`, `prompts/rubrics`, `.claude/skills` | Prompt data (never embed prompt prose in TypeScript) |
| `courses/<id>/` | One self-contained course project each |

## Commands

```sh
npm run build          # tsc → dist/
npm run typecheck
npm run lint           # Biome; npm run format to fix
npm test               # unit + integration (offline, fake harness)
npm run test:e2e       # Playwright
npm run test:acceptance
npm run gen:schemas    # after changing src/core/schemas
node bin/courseforge.mjs <command>    # or ./courseforge, .\courseforge
```

## Non-negotiables

1. Provider-neutral core: only `src/harness/**` names the `claude`/`codex` CLIs, flags or output formats.
2. Only `src/core/proc.ts` imports `child_process` (cross-spawn, `shell: false`, prompts on stdin).
3. Deterministic routing: stages, reviewers, skills, tools, renderers and fallbacks come from `config/` via
   `src/routing`. Agents return closed enums; code maps them to tools. Plans are saved before agent work.
4. zod schemas are the source of truth. After changing one, run `npm run gen:schemas` and commit `schemas/`.
   Agent-facing schemas stay flat and strict (all required, optional = nullable, no `$ref`).
5. Course isolation: course reads/writes stay under `courses/<id>/`, through `src/core/fsx.ts` helpers.
6. Preserve human work: never edit `input/originals/`, `versions/`, locked artifacts or locked IDs; agent steps
   run inside the write audit, which must not be bypassed.
7. No global dependencies: never read or modify `~/.claude`, `~/.codex` or global npm config; no global installs.
8. No secrets, tokens, personal paths or emails in code, fixtures, logs or docs.

## Parallel work

- Work only in the directories you were assigned; do not edit other streams' files.
- The coordinator alone edits `package.json`, the lockfile, `tsconfig*.json`, `biome.json`, test runner configs
  and shared interfaces (`src/core/*`, `src/harness/types.ts`, `src/pipeline/api.ts`).
- Do not run `npm install`, commit, stash or check out unless asked. Do not run e2e while other browser or
  agent-pool work is running (limited RAM).

## Before you say you are done

- `npm run typecheck`, `npm run lint`, `npm test` pass.
- `npm run test:e2e` passes if you touched the renderer, components, runtime, graphics or QA.
- Schema changes: `npx tsx scripts/gen-schemas.ts --check` passes.
- New or changed tests covering a requirement carry its acceptance tag (`@C6 …`).
- Docs in `docs/` still describe the code; UI changes were checked in a real browser.
