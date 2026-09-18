# CourseForge: instructions for coding agents (Codex and others)

CourseForge is a TypeScript/Node course-engineering harness: a deterministic 11-stage pipeline (concept →
research → design → storyboard → editorial → visual direction → model → build → QA → release) that uses Claude
Code or Codex for semantic work and code for routing, validation, rendering, QA and release decisions.
Keep this file consistent with `CLAUDE.md`.

## Sources of truth

- `docs/exec-plans/active/courseforge-v1.md`: the approved plan
- `docs/architecture/`: the system as built; `docs/adr/`: recorded deviations
- `docs/bootstrap/`: original requirements of record (read-only)
- `config/*.json`: registries; `src/core/schemas/`: zod schemas for every artifact and agent output
- `.claude/rules/architecture.md`, `courses.md`, `testing.md`: rules that apply to you too

## Map

`src/cli` + `src/environment` (CLI, doctor) · `src/pipeline` (state machine, stage loop, write audit, API) ·
`src/routing` (pure router) · `src/harness` (only place that knows the CLIs) · `src/review` + `src/release` ·
`src/ingestion` + `src/artifacts` · `src/graphics` + `src/renderer` + `components/course-ui` · `src/qa` ·
`courses/<id>/` (one self-contained course each).

## Commands

```sh
npm run build | npm run typecheck | npm run lint | npm test | npm run test:e2e | npm run test:acceptance
npm run gen:schemas                      # after changing src/core/schemas
node bin/courseforge.mjs <command>       # CLI; see src/cli/help.ts
```

## Non-negotiables

1. Provider-neutral core: only `src/harness/**` names the `claude`/`codex` CLIs, flags or output formats.
2. Only `src/core/proc.ts` imports `child_process` (cross-spawn, `shell: false`, prompts on stdin).
3. Deterministic routing from `config/` via `src/routing`; agents return closed enums; plans saved first.
4. zod schemas are the source of truth; run `npm run gen:schemas` and commit `schemas/` after changes.
5. Course isolation under `courses/<id>/` using `src/core/fsx.ts` helpers.
6. Never edit `input/originals/`, `versions/`, locked artifacts or locked IDs; never bypass the write audit.
7. Never read or modify `~/.claude`, `~/.codex` or global npm config; no global installs.
8. No secrets, tokens, personal paths or emails anywhere in the repository.

## Parallel work

Stay inside your assigned directories. Only the coordinator edits `package.json`, the lockfile, `tsconfig*.json`,
`biome.json`, runner configs and shared interfaces (`src/core/*`, `src/harness/types.ts`,
`src/pipeline/api.ts`). Do not install, commit, stash or check out unless asked; do not run e2e alongside other
browser or agent work.

## Skills (index)

Codex has no native project-skills path. These files are the single source used by CourseForge's prompt
assembly and by Claude Code; read the relevant one when doing that kind of work:

| Skill | File |
|---|---|
| research-planning | `.claude/skills/research-planning/SKILL.md` |
| research-authoring | `.claude/skills/research-authoring/SKILL.md` |
| research-review | `.claude/skills/research-review/SKILL.md` |
| fact-check | `.claude/skills/fact-check/SKILL.md` |
| instructional-design | `.claude/skills/instructional-design/SKILL.md` |
| alignment-review | `.claude/skills/alignment-review/SKILL.md` |
| storyboard-authoring | `.claude/skills/storyboard-authoring/SKILL.md` |
| scenario-design | `.claude/skills/scenario-design/SKILL.md` |
| assessment-design / assessment-review | `.claude/skills/assessment-design/SKILL.md`, `.claude/skills/assessment-review/SKILL.md` |
| editorial-humanization | `.claude/skills/editorial-humanization/SKILL.md` |
| course-gap-analysis | `.claude/skills/course-gap-analysis/SKILL.md` |
| visual-direction / instructional-graphics | `.claude/skills/visual-direction/SKILL.md`, `.claude/skills/instructional-graphics/SKILL.md` |
| html-intake-review | `.claude/skills/html-intake-review/SKILL.md` |
| accessibility-review / ui-review / ux-review | `.claude/skills/accessibility-review/SKILL.md`, `.claude/skills/ui-review/SKILL.md`, `.claude/skills/ux-review/SKILL.md` |

Prompt templates: `prompts/templates/*.md` (`{{variable}}` substitution only). Reviewer rubrics:
`prompts/rubrics/<reviewer-id>.md`. Reviewer and skill routing: `config/reviewers.json`, `config/skills.json`.

## Before you say you are done

`npm run typecheck`, `npm run lint` and `npm test` pass; `npm run test:e2e` too if you touched the renderer,
components, runtime, graphics or QA; `npx tsx scripts/gen-schemas.ts --check` after schema changes; tests that
cover a requirement carry its acceptance tag (`@C6 …`); `docs/` still matches the code.
