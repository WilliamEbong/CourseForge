# ADR 0004: COURSE_MODEL, COURSE_BUILD and RELEASE are deterministic-only

## Context

The specification attached AI reviewers to the build stage as well as a final-course panel. Reviewing the same
built course twice costs tokens and time, and agent calls during a build would make it non-reproducible.

## Decision

COURSE_MODEL, COURSE_BUILD and RELEASE run no reviewer agents. Their checks are deterministic validators (model
integrity, trace, single file, IDs rendered, no renderer runtimes, size budget, text equivalents, drag-only,
release gate, originals intact). The AI final-course panel (10 reviewers) runs once, at COURSE_QA, with browser
evidence. The only agent call reachable from COURSE_BUILD is one semantic repair of a visual spec after a
renderer failure.

## Consequences

- Builds are byte-reproducible for a given model; a rebuild after a repair is cheap.
- Build defects surface as validator findings with check IDs rather than reviewer prose.
