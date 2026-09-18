# Selected External Projects for CourseForge v1

These are the selected mature projects/capabilities discussed during CourseForge design. The build agent must verify current status, Node compatibility, licensing, and package names before pinning versions.

## Agent architecture / project-local skills

- Anthropic Skills: https://github.com/anthropics/skills
- Anthropic Knowledge Work Plugins: https://github.com/anthropics/knowledge-work-plugins
- Claude Code repository / official frontend-design plugin: https://github.com/anthropics/claude-code

Use selectively. Do not expose the whole ecosystem to every agent context.

## Browser QA / accessibility

- Microsoft Playwright: https://github.com/microsoft/playwright
- Deque axe-core: https://github.com/dequelabs/axe-core

## Component/UI development

- Storybook: https://github.com/storybookjs/storybook
- Lucide: https://github.com/lucide-icons/lucide

## Structured instructional graphics

- Mermaid: https://github.com/mermaid-js/mermaid
- Mermaid CLI: https://github.com/mermaid-js/mermaid-cli
- SVG.js: https://github.com/svgdotjs/svg.js
- D3: https://github.com/d3/d3
- Vega-Lite: https://github.com/vega/vega-lite
- Vega: https://github.com/vega/vega

## Reference/inspiration, not required core dependencies

- shadcn/ui: https://github.com/shadcn-ui/ui
- Radix Primitives: https://github.com/radix-ui/primitives
- Excalidraw: https://github.com/excalidraw/excalidraw

The intended v1 approach is to build CourseForge-owned educational skills/reviewers/components on top of mature infrastructure rather than depend on many small third-party Claude skill repos.
