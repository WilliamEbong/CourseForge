# ADR 0008: No pixel-baseline visual regression in v1

## Context

Pixel baselines differ between Windows development machines and Linux CI (fonts, anti-aliasing), producing
noise that trains people to ignore failures.

## Decision

v1 has no golden-image comparisons. Visual quality is checked structurally (SVG quality checks, overflow and
clipping detectors, token contrast matrices, axe), and screenshots are captured at 1440/768/390 px as evidence
for the AI UI/UX reviewers and for humans. Regression between runs compares functional and accessibility
results, not pixels.

## Consequences

- Subtle visual regressions may pass automated checks; the QA reviewer panel and human gates are the backstop.
- If added later, baselines should be component-level and generated only on `ubuntu-latest`.
