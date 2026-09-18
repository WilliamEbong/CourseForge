# Dependency policy

## Principles

- Prefer the platform: Node built-ins (`node:util` `parseArgs`, `node:crypto`, `node:fs`) before packages.
- One tool per job: Biome for lint and format, Vitest for unit/integration, Playwright for browsers and e2e,
  zod for every schema.
- No global installs and no reliance on globally installed tools other than Node, npm and (optionally) the agent
  CLIs. Everything else comes from the lockfile.
- No vendored code. Upstream code, skills, prompts or icons are used as npm packages or written from scratch.
  Anything embedded in a released course must have a notice in the course and in `vendor/LICENSES/`.

## Pinning

- `package.json` pins exact versions; `package-lock.json` is committed and installed with `npm ci`.
- `engines.node` is `>=22.12.0` (Mermaid 12 requires it); `.nvmrc` / `.node-version` select 24; `.npmrc` sets
  `engine-strict`.
- TypeScript is pinned to the 6.x line ([ADR 0009](../adr/0009-typescript-6-pin.md)).
- Playwright's browser build follows the `playwright` package version; `@playwright/test` must be the same
  version.

## Upgrading

1. Check the changelog and licence of the new version (`npm view <pkg>@<version> license`).
2. Update the exact version in `package.json`, run `npm install`, commit `package.json` and the lockfile together.
3. For `playwright` / `@playwright/test`: bump both, run `npx playwright install chromium`, run e2e.
4. For `mermaid`, `vega`, `vega-lite`, `d3`, `@svgdotjs/svg.js`, `lucide-static`: run the graphics integration
   tests and look at the rendered gallery; output SVG must stay deterministic.
5. For the agent CLIs (not npm dependencies): re-record `tests/fixtures/harness-raw/` help text and outputs,
   run the harness unit tests, and check that the isolation flags still exist (adapters only pass flags found
   in `--help`).
6. Run the full check list (`npm run ci`, `npm run test:acceptance`).
7. Update `THIRD-PARTY.md` (version and licence). The licence test fails if a dependency is missing there.

Dependabot opens grouped weekly PRs (`.github/dependabot.yml`); treat them with the same steps.

## Doctor checks tied to dependencies

| Check | What it verifies |
|---|---|
| `deps.lock` | `node_modules` matches `package-lock.json` (fingerprint written by setup) |
| `deps.packages` | Required runtime packages are installed, including `lucide-static` (read at build time) |
| `pw.chromium` | The Chromium build for the installed Playwright version is present |
| `build.dist` | `dist/` is newer than the sources |
| `schemas.drift` | Every schema in `SCHEMAS` has a generated file in `schemas/` |

## Licences

`THIRD-PARTY.md` lists every direct dependency with version, licence and whether anything reaches a released
course. Today only Lucide icon SVG paths are embedded (ISC; notice in the HTML and `release/licenses/`).
axe-core (MPL-2.0) is executed during QA but never embedded. Adding a dependency whose code or assets would be
embedded in a course requires a licence review and a copy of its licence under `vendor/LICENSES/`.
