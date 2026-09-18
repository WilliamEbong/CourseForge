# Contributing to CourseForge

Thanks for your interest. CourseForge is a small, opinionated codebase; the notes below keep it that way.

## Getting started

```sh
git clone <repo-url> CourseForge && cd CourseForge
./setup.sh            # Windows: .\setup.ps1
npm test
```

Read [docs/architecture/overview.md](docs/architecture/overview.md) first, then the page for the area you are
changing. [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) summarise the rules for AI coding agents; they apply to
humans too.

## Before opening a pull request

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e                              # if you touched renderer, components, runtime, graphics or QA
npx tsx scripts/gen-schemas.ts --check        # if you touched src/core/schemas
npx tsx scripts/gen-demo-fixtures.ts --check  # if you touched agent-facing schemas or stage handlers
```

- Keep changes focused; one concern per pull request.
- Add or update tests. If a test covers an acceptance requirement, put its ID in the title (`@E3 …`).
- Update the docs that describe the behaviour you changed. A deviation from the architecture needs an
  [ADR](docs/adr/README.md).
- Commit messages: `<type>: <description>` (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`).

## Architecture rules

- Only `src/harness/` knows about specific agent CLIs; only `src/core/proc.ts` spawns processes.
- Routing lives in `config/*.json` and `src/routing`; prompts never choose tools.
- zod schemas in `src/core/schemas/` are the source of truth; regenerate `schemas/` after changes.
- Prompt text lives in `prompts/` and `.claude/skills/`, not in TypeScript.
- Tests are offline and deterministic; live agent tests run only with `COURSEFORGE_LIVE=1`.

Details: [docs/developer-guide/contributing-workflow.md](docs/developer-guide/contributing-workflow.md).

## Dependencies

New dependencies need a reason, a licence check and a row in [THIRD-PARTY.md](THIRD-PARTY.md); see the
[dependency policy](docs/developer-guide/dependency-policy.md).

## Security

Do not report vulnerabilities in public issues; see [SECURITY.md](SECURITY.md). Never commit credentials,
tokens, personal paths or real learner data, including in fixtures.

## Licence

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
