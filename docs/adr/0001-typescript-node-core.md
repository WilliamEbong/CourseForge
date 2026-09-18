# ADR 0001: TypeScript on Node for the whole harness

## Context

CourseForge orchestrates CLI agents, parses Markdown/HTML/DOCX/PDF, renders diagrams, compiles HTML and drives a
browser. The graphics stack (Mermaid, Vega-Lite, D3, SVG.js), Playwright and axe-core are JavaScript-native. The
bootstrap specification allowed another language for the core.

## Decision

One language and runtime: TypeScript on Node ≥ 22.12, compiled with `tsc` to `dist/` during setup and launched by
`bin/courseforge.mjs`. `tsx` is used only in development and scripts; there is no reliance on Node's native type
stripping. CLI parsing uses `node:util` `parseArgs`; lint and format use Biome.

## Consequences

- One toolchain, one lockfile, one install; renderers and QA run in-process without a second runtime.
- Setup must build `dist/` (doctor check `build.dist`); fresh clones need only Node.
- Types are shared end to end with the zod schemas ([ADR 0002](0002-zod-single-source-of-truth.md)).
