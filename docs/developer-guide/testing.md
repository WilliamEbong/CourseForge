# Testing

## Layers

| Layer | Runner | Location | Notes |
|---|---|---|---|
| Unit | Vitest | `tests/unit/**` | Pure modules; injected runners, clocks and probes |
| Integration | Vitest | `tests/integration/**` | Real filesystem in temp dirs, fake harness, real Chromium where needed |
| End-to-end | Playwright Test | `tests/e2e/**` | Built courses and imported HTML in Chromium |
| Acceptance matrix | `scripts/acceptance.mjs` | all of the above | Collects `@<ID>` tags from test titles |

```sh
npm test                    # unit + integration
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:acceptance     # --allow-missing, --no-e2e, --out <file>
npm run coverage            # v8 coverage, global floor 70 % lines
```

Vitest runs in forks with at most 3 workers and sets `COURSEFORGE_TEST=1` (which disables retry backoff);
Playwright uses 2 workers. Both limits keep memory use modest.

## Conventions

- **Offline.** No test calls a live agent or the network. Use the fake harness and fixtures
  ([fixtures-and-fake-harness.md](fixtures-and-fake-harness.md)). Live tests run only with `COURSEFORGE_LIVE=1`.
- **Deterministic.** Inject time and randomness; compare byte-stable outputs (plans, repair plans, SVG, HTML).
- **Isolated.** Integration tests use `COURSEFORGE_COURSES_DIR` pointing at a temp directory; nothing is
  written to `courses/`.
- **Tagged.** A test that covers a requirement names it: `it('@E3 merges overlapping findings', …)`.

## Requirement-to-test mapping

Requirement IDs are the acceptance groups A–L (setup, harness, state machine, routing, review, course folder,
build, graphics, browser QA, accessibility, existing HTML, repository quality). The table reflects the tagged
tests present in the repository when this page was written; `npm run test:acceptance` is the live source.

| ID | Requirement | Tests (under `tests/`) |
|---|---|---|
| A1 | setup detects prerequisites | `unit/env/checks.test.ts` |
| A2 | lockfile install | CI `npm ci` (`.github/workflows/ci.yml`); no tagged test |
| A3 | Chromium installed if missing | planned: `integration/env/browser-install` (not yet present) |
| A4 | config validates | `unit/config/config.test.ts` |
| A5 | no global plugin/skill needed | `unit/arch/boundary.test.ts` |
| A6 | doctor machine + human output | `unit/env/doctor.test.ts`, `integration/cli/doctor.test.ts` |
| A7 | smoke fixture executes | CI e2e job (`courseforge smoke`); no tagged test yet |
| B1 | availability/version | `unit/harness/detect.test.ts` |
| B2 | command construction | `unit/harness/command.test.ts` |
| B3 | structured-output parsing | `unit/harness/parse-claude.test.ts`, `unit/harness/parse-codex.test.ts` |
| B4 | provider selection configurable | `unit/routing/backend-gates.test.ts` |
| B5 | failures classified + logged | `unit/harness/errors.test.ts` |
| B6 | no provider calls outside adapters | `unit/arch/boundary.test.ts` |
| B7 | optional live tests | `unit/harness/live.test.ts` (`COURSEFORGE_LIVE=1`) |
| C1 | legal transitions | `unit/pipeline/pipeline-units.test.ts` |
| C2 | concept → stop at any stage | `integration/pipeline/pipeline.test.ts` |
| C3 | start from imported artifacts | `integration/ingest/preserve.test.ts` |
| C4 | `continue` resumes | `integration/pipeline/pipeline.test.ts` |
| C5 | locked canonical not silently replaced | `integration/pipeline/pipeline.test.ts`, `unit/review/apply.test.ts` |
| C6 | retry limits | `integration/pipeline/pipeline.test.ts` |
| C7 | human-gate state | `integration/pipeline/pipeline.test.ts`, `unit/routing/backend-gates.test.ts` |
| C8 | versions/superseded tracked | `unit/artifacts/registry.test.ts`, `unit/artifacts/locks.test.ts`, `integration/pipeline/pipeline.test.ts` |
| D1 | stage → skill/tool/reviewer map | `unit/routing/router.test.ts` |
| D2 | visual-type routing | `unit/routing/visual-router.test.ts` |
| D3 | deterministic logged fallbacks | `unit/routing/router.test.ts` |
| D4 | unknown enum/config fails safely | `unit/routing/router.test.ts` |
| D5 | plan saved before agent work | `integration/pipeline/pipeline.test.ts` |
| D6 | agent cannot expand tool bundle | `unit/routing/router.test.ts` |
| E1 | concurrent reviewers | `unit/review/pool.test.ts` |
| E2 | finding schema validation | `unit/review/findings.test.ts` |
| E3 | adjudicator dedupe/merge | `unit/review/adjudicator.test.ts` |
| E4 | repair plan schema-valid | `unit/review/repair-plan.test.ts` |
| E5 | repair leaves locked content | `unit/review/apply.test.ts`, `unit/artifacts/registry.test.ts`, `unit/pipeline/pipeline-units.test.ts`, `integration/pipeline/pipeline.test.ts` |
| E6 | post-repair validation reruns | `integration/pipeline/pipeline.test.ts` |
| F1 | course self-contained | `unit/artifacts/registry.test.ts`, `unit/artifacts/trace.test.ts`, `integration/pipeline/pipeline.test.ts` |
| F2 | originals preserved | `integration/ingest/preserve.test.ts`, `integration/improve/chemical-risk-improve.test.ts` |
| F3 | manifests, hashes, provenance | `unit/artifacts/registry.test.ts`, `unit/core/core.test.ts` |
| F4 | chemical-risk artifacts ingest | `integration/ingest/chemical-risk.test.ts`, `unit/ingestion/*.test.ts` |
| F5 | IDs/relationships persist | `unit/artifacts/trace.test.ts` |
| G1–G2 | build completes; single file | `integration/render/build.test.ts`, `unit/renderer/components.test.ts` |
| G3 | offline | `integration/render/browser.test.ts`, `integration/qa/contract.test.ts`, `e2e/existing/crawl.spec.ts` |
| G4 | expected block/item IDs | `integration/render/build.test.ts`, `unit/renderer/components.test.ts` |
| G5–G6 | interactions; scoring | `integration/qa/contract.test.ts`, `integration/render/browser.test.ts`, `unit/renderer/grade.test.ts` |
| G7–G8 | glossary/references; progress/reset | `integration/qa/contract.test.ts`, `integration/render/browser.test.ts` |
| G9 | no blocking console errors | `integration/qa/contract.test.ts`, `integration/render/browser.test.ts` |
| H1–H3 | Mermaid / native + SVG.js / Vega-Lite compile | `integration/graphics/renderers.test.ts`, `unit/graphics/mermaid-source.test.ts`, `unit/graphics/native.test.ts` |
| H4 | fallback routing | `integration/graphics/fallback.test.ts`, `unit/routing/visual-router.test.ts`, `integration/render/build.test.ts` |
| H5 | text equivalents | `integration/graphics/fallback.test.ts` |
| H6 | no Mermaid/Vega runtime in release | `integration/render/build.test.ts` |
| I1–I8 | browser QA capabilities | `integration/qa/contract.test.ts`, `integration/qa/detectors.test.ts`, `unit/qa/issues.test.ts`, `e2e/existing/crawl.spec.ts` |
| J1–J2 | axe runs; serious/critical block | `integration/qa/contract.test.ts`, `integration/render/browser.test.ts`, `unit/qa/issues.test.ts`, `unit/release/gate.test.ts` |
| J3–J4 | keyboard navigation; visible focus | `integration/qa/contract.test.ts`, `integration/qa/detectors.test.ts`, `integration/render/browser.test.ts` |
| J5 | drag-only prohibited | `unit/renderer/components.test.ts` |
| J6 | visuals have text equivalents | `integration/graphics/fallback.test.ts`, `unit/renderer/components.test.ts`, `unit/pipeline/pipeline-units.test.ts` |
| K1–K3 | ingest example HTML; browser-run; intake report | `integration/ingest/chemical-risk.test.ts`, `integration/improve/chemical-risk-improve.test.ts`, `e2e/existing/crawl.spec.ts` |
| K4–K5 | review findings; repair plan | `integration/improve/chemical-risk-improve.test.ts` |
| K6–K7 | improved copy; regression rerun | `integration/improve/chemical-risk-improve.test.ts`, `unit/qa/regression.test.ts` |
| L1–L2 | README sections; setup docs | `unit/docs/readme.test.ts` |
| L3 | licences/attributions | `unit/docs/licenses.test.ts` |
| L4 | no secrets / absolute paths | `unit/repo/hygiene.test.ts` |
| L5 | CI runs gates | `unit/repo/ci.test.ts` + `.github/workflows/ci.yml` |
| L6 | docs coherent | `unit/docs/links.test.ts` |
| L7 | sample fixture shows value | `unit/docs/readme.test.ts` (demo fixtures cover every agent stage) + the offline quick start |

## Coverage targets

Global floor 70 % lines (enforced in `vitest.config.ts`). Planned per-module targets: routing 90, pipeline and
review 85, artifacts and environment 80, harness 75, renderer and graphics 60, QA 50.
