# ADR 0011: Storybook is a development-only tool

## Context

A component workbench helps build and review course UI components, but Storybook is large and must not sit on
the setup or smoke critical path of a low-memory machine.

## Decision

Keep Storybook (`storybook`, `@storybook/html-vite`, `@storybook/addon-a11y`) as devDependencies with
`npm run storybook` and `npm run build-storybook`. Stories import the same pure `render()` functions the compiler
uses. The Storybook build runs only in the nightly workflow, as a non-required job.

## Consequences

- Setup, `doctor` and the smoke fixture never start Storybook.
- As of 0.1.0 no `.storybook/` configuration or stories are committed; the nightly job skips the build until
  they exist. Component quality is covered by unit render tests and browser QA meanwhile.
