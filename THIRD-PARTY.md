# Third-party software

CourseForge is MIT-licensed ([LICENSE](LICENSE)). It uses the npm packages below as ordinary dependencies,
installed from `package-lock.json`; nothing is vendored into this repository. Licences were read from each
installed package's `package.json` (`license` field) for the pinned version. Transitive dependencies carry their
own licences in `node_modules/`.

**What reaches a released course:** only CourseForge's own CSS and JavaScript, SVG *output* produced by the
renderers (not their code), and the path data of the Lucide icons the course uses. The Lucide ISC notice is
embedded as an HTML comment in every built course and copied to `release/licenses/lucide-ISC.txt`; the licence
text is also kept in [vendor/LICENSES/lucide-ISC.txt](vendor/LICENSES/lucide-ISC.txt). No other third-party code
or asset is embedded.

## Runtime dependencies (`dependencies`)

| Package | Version | Licence | Role | In released course? |
|---|---|---|---|---|
| `@axe-core/playwright` | 4.13.0 | MPL-2.0 | Runs axe in Playwright pages during QA | No (executed only) |
| `@svgdotjs/svg.js` | 3.2.8 | MIT | In-page SVG drawing at build time | No (output SVG only) |
| `axe-core` | 4.13.0 | MPL-2.0 | Accessibility rules engine injected into the QA browser | No (executed only; unmodified, so MPL file-level obligations do not arise) |
| `cheerio` | 1.2.0 | MIT | HTML parsing (ingestion, post-processing, checks) | No |
| `cross-spawn` | 7.0.6 | MIT | Cross-platform subprocess spawning (`src/core/proc.ts`) | No |
| `d3` | 7.9.0 | ISC | In-page chart and network rendering at build time | No (output SVG only) |
| `esbuild` | 0.28.2 | MIT | Bundles and minifies the course runtime and CSS | No (bundles CourseForge's own code) |
| `mammoth` | 1.12.3 | BSD-2-Clause | DOCX → HTML for ingestion | No |
| `marked` | 18.0.13 | MIT | Markdown lexing for ingestion | No |
| `mermaid` | 12.0.0 | MIT | Diagram rendering inside Playwright Chromium at build time | No (output SVG only) |
| `playwright` | 1.63.0 | Apache-2.0 | Chromium automation for rendering, QA and the smoke fixture | No |
| `unpdf` | 1.8.1 | MIT | PDF text extraction for ingestion | No |
| `vega` | 6.4.0 | BSD-3-Clause | Headless chart rendering to SVG | No (output SVG only) |
| `vega-lite` | 6.4.3 | BSD-3-Clause | Chart grammar compiled to Vega | No |
| `yaml` | 2.9.1 | ISC | `course.yaml` parsing and writing | No |
| `zod` | 4.6.5 | MIT | Schemas and validation | No |

## Development dependencies (`devDependencies`)

| Package | Version | Licence | Role | In released course? |
|---|---|---|---|---|
| `@biomejs/biome` | 2.5.14 | MIT OR Apache-2.0 | Lint and format | No |
| `@playwright/test` | 1.63.0 | Apache-2.0 | End-to-end test runner | No |
| `@storybook/addon-a11y` | 10.6.0 | MIT | Storybook accessibility panel | No |
| `@storybook/html-vite` | 10.6.0 | MIT | Storybook framework for HTML-string components | No |
| `@types/cross-spawn` | 6.0.6 | MIT | Type definitions | No |
| `@types/d3` | 7.4.3 | MIT | Type definitions | No |
| `@types/node` | 24.13.5 | MIT | Type definitions | No |
| `@vitest/coverage-v8` | 5.0.1 | MIT | Coverage | No |
| `lucide-static` | 1.47.0 | ISC | Icon SVGs read at build time | **Yes: path data of referenced icons** |
| `storybook` | 10.6.0 | MIT | Component workbench (development only) | No |
| `tsx` | 4.23.13 | MIT | Run TypeScript scripts in development | No |
| `typescript` | 6.0.3 | Apache-2.0 | Compiler | No |
| `vitest` | 5.0.1 | MIT | Unit and integration test runner | No |

Note: `lucide-static` is a devDependency but is read at build time by the renderer and checked by `doctor`
(`deps.packages`), so installs must include dev dependencies (the default for `npm ci`).

## External tools (not distributed)

| Tool | Licence / terms | Use |
|---|---|---|
| Playwright Chromium build | Chromium licences (BSD-style and others), downloaded by Playwright into the user's browser cache | Rendering and QA |
| Claude Code CLI | Anthropic terms | Optional agent backend, installed and signed in by the user |
| Codex CLI | Apache-2.0 (OpenAI) plus service terms | Optional agent backend, installed and signed in by the user |

## Reference material studied, not copied

Project skills, prompts and rubrics in this repository were written for CourseForge. Public repositories that
were studied for patterns (for example `anthropics/skills`, `anthropics/knowledge-work-plugins`) are not
vendored; parts of them are source-available or all-rights-reserved and must not be copied.

## Example content

`examples/chemical-risk/` is the author's own work, included as a regression fixture. See
[examples/chemical-risk/NOTICE.md](examples/chemical-risk/NOTICE.md).
