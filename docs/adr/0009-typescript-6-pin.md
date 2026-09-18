# ADR 0009: Pin TypeScript 6.x

## Context

TypeScript 7.0 (the native compiler) was published on the day of planning. A brand-new major would put the build
of a fresh clone at risk of incompatibilities with tsx, Vitest, Biome and type packages.

## Decision

Pin `typescript` to 6.0.x exactly. Revisit when 7.x has several weeks of patch releases and the surrounding
tools declare support.

## Consequences

- Stable builds now; a deliberate upgrade later following the
  [dependency policy](../developer-guide/dependency-policy.md).
