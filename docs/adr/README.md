# Architecture decision records

Short records of decisions that deviate from, or refine, the original specification. Each has context, the
decision, and its consequences. Status of all records below: **accepted** (2026-09-18).

| ADR | Decision |
|---|---|
| [0001](0001-typescript-node-core.md) | TypeScript on Node for the whole harness |
| [0002](0002-zod-single-source-of-truth.md) | zod schemas generate types and committed JSON Schemas |
| [0003](0003-mermaid-in-playwright-not-mermaid-cli.md) | Render Mermaid in the shared Playwright page, not with mermaid-cli |
| [0004](0004-deterministic-build-stages.md) | COURSE_MODEL, COURSE_BUILD and RELEASE are deterministic-only |
| [0005](0005-json-canonical-markdown-rendered.md) | JSON is canonical; Markdown twins are rendered from it |
| [0006](0006-single-artifact-registry-and-copy-snapshots.md) | One `artifacts.json` registry and plain-copy snapshots |
| [0007](0007-harness-interface-probe-run.md) | Harness interface reduced to `probe` + `run` |
| [0008](0008-no-pixel-baselines-v1.md) | No pixel-baseline visual regression in v1 |
| [0009](0009-typescript-6-pin.md) | Pin TypeScript 6.x |
| [0010](0010-cli-isolation-flags-not-config-dirs.md) | Isolate agent CLIs with flags, not config-directory redirection |
| [0011](0011-storybook-dev-only.md) | Storybook is a development-only tool |
| [0012](0012-phased-scope.md) | Phased scope: PPTX, AI imagery, SCORM/xAPI, remaining native archetypes |

New ADRs: copy the structure of an existing one, number sequentially, and link it here.
