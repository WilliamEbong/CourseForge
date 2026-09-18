# Adding a course component

Course UI components live in `components/course-ui/`. They are pure build-time functions that return HTML
strings, plus a small vanilla runtime that hydrates the rendered DOM. There is no framework runtime and no
shadow DOM, so the single-file output stays small and inspectable.

```text
components/course-ui/
├─ tokens/        families/*.json (DTCG tokens per visual family), compile.ts, contrast.ts
└─ src/
   ├─ contract.ts           CfComponent, esc(), md(), attrs(), blockAttrs(), ICONS, icon(), iconSprite()
   ├─ components/           shell.ts, screens.ts, question.ts, figure.ts
   ├─ runtime/              app.ts (router, window.__cf), question.ts, dialogs.ts, store.ts, grade.ts
   └─ styles/               base.css, components.css, utilities.css (cascade layers)
```

## Contract

```ts
interface CfComponent<P> { name: string; render(props: P): string }
```

Rules for `render`:

- Escape every text value with `esc()`; render learner prose with `md()` (Markdown-lite; raw HTML is always
  escaped). Never concatenate unescaped model text.
- Put `blockAttrs(block)` (or the relevant `data-cf-*` attributes) on the root so traceability, QA and the
  `ids-rendered` build check can find it. See the DOM contract in
  [course-runtime.md](../architecture/course-runtime.md#dom-contract).
- Use icons only from the closed `ICONS` list via `icon(name)`; the compiler inlines only referenced icons.
- Use design tokens (`var(--cf-…)`) and the existing layers; add CSS to `styles/components.css` inside
  `@layer cf.components`.
- Keep output deterministic: no random IDs, dates or environment-dependent values.

## Adding a screen component

1. Add the type to `COMPONENT_TYPES` in `src/core/enums.ts` (and run `npm run gen:schemas`).
2. Implement it in `components/course-ui/src/components/screens.ts` and register it in `SCREEN_COMPONENTS`
   (the `Record<ComponentType, …>` type makes a missing entry a compile error).
3. Map block kinds to it in `config/routing.json#components`; `validate-config` rejects unknown kinds or types.
4. If it needs behaviour, add a hydration hook in `components/course-ui/src/runtime/` keyed on a `data-cf-*`
   attribute. Behaviour must work with keyboard only, must not rely on dragging, and must announce changes
   through the shared `role="status"` announcer rather than making containers live regions.
5. If it is an interaction, add a pure grader to `runtime/grade.ts` and teach the QA contract runner
   (`src/qa/contract.ts`) how to answer it correctly and incorrectly from the model's key.

## Tests

- `tests/unit/renderer/components.test.ts`: rendered markup for representative props (escaping, attributes).
- `tests/unit/renderer/grade.test.ts`: grading tables for interactions.
- `tests/unit/renderer/tokens.test.ts`: token compilation and contrast.
- e2e (`npm run test:e2e`): the component inside a built course, including axe and keyboard traversal.

Storybook (`@storybook/html-vite`, `npm run storybook`) is declared as a development-only dependency; a story
matrix is planned but no `.storybook/` configuration is committed yet.
