# Adding a visual archetype

Archetypes are a closed vocabulary: agents may only choose values from `VISUAL_ARCHETYPES`, and every archetype
must have a route. Adding one touches the enum, routing, at least one renderer, and tests.

## 1. Extend the enum

Add the name to `VISUAL_ARCHETYPES` in `src/core/enums.ts`. Then regenerate the committed JSON Schemas and the
demo fixtures' drift check:

```sh
npm run gen:schemas
npx tsx scripts/gen-demo-fixtures.ts --check
```

## 2. Route it

Add a rule to `config/routing.json#visualRoutes`, before any catch-all rule:

```json
{
  "rule": "VIS-SWIMLANE-001",
  "when": { "archetype": "SWIMLANE", "interaction": null },
  "primary": "cf_svg",
  "fallbacks": ["mermaid"]
}
```

`text_equivalent` is appended automatically as the terminal fallback. `validate-config` fails if an archetype
has no route or a route names an unregistered renderer.

## 3. Render it

Pick the cheapest renderer that can draw it well:

- **Native builder (`cf_svg`)**: add a pure function `(spec, ctx) => string` in `src/graphics/native/`
  (`flow.ts`, `grid.ts` or `tree.ts`, using the helpers in `kit.ts` for text wrapping, cards, arrows and
  badges) and register it in `NATIVE_BUILDERS` (`src/graphics/native/index.ts`). No browser, fully deterministic.
- **Mermaid**: extend `mermaidSource` in `src/graphics/mermaid.ts` to generate the diagram from
  `VisualSpec.content`; labels must go through `mermaidLabel`.
- **SVG.js / D3**: add a layout to the in-page script in `src/graphics/svgjs.ts` or `src/graphics/d3.ts`.

Whatever the renderer, output goes through `postprocessSvg` and the quality checks, so do not add titles,
ID prefixes or colours by hand: use palette slots (`ctx` colours) and let post-processing map them to
`var(--cf-viz-N)`.

## 4. Teach the agents

Describe when to use the archetype, and what `content` fields it reads, in
`.claude/skills/instructional-graphics/SKILL.md` and, if needed, `prompts/templates/visual-direction.md`.

## 5. Test

- `tests/unit/routing/visual-router.test.ts`: the new route and its fallback chain.
- `tests/unit/graphics/native.test.ts` (native builder): renders, passes `checkSvgStatic`, deterministic output.
- `tests/integration/graphics/renderers.test.ts`: renders in the browser without quality issues.
- `tests/integration/graphics/fallback.test.ts` already proves a failing primary falls back to text.
