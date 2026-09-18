# ADR 0003: Render Mermaid inside the shared Playwright page

## Context

The specification suggested `@mermaid-js/mermaid-cli`. It depends on Puppeteer, downloads a second Chromium
(about 180 MB), and starts a browser per invocation. The build machine had under 2 GB of free RAM, and Playwright
Chromium is already required for QA.

## Decision

Do not depend on mermaid-cli. Load the `mermaid` package into one persistent Playwright Chromium page
(`src/graphics/browser.ts`) and render there with `securityLevel: 'strict'`, `htmlLabels: false`,
`deterministicIds` and token-derived theme variables (`src/graphics/mermaid.ts`). The same page hosts SVG.js, D3
and text measurement.

## Consequences

- One browser download and one browser process per build; deterministic SVG IDs.
- A small amount of glue code instead of a CLI dependency; Mermaid upgrades are covered by the graphics
  integration tests.
- Mermaid output never contains `foreignObject` HTML labels, which keeps post-processing and accessibility simple.
