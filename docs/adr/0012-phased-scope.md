# ADR 0012: Phased scope with the architecture intact

## Context

The specification lists capabilities that are either not feasible to do well in v1 or not needed to prove the
architecture. Dropping them silently would hide gaps; building them badly would lower quality.

## Decision

Ship v1 with the extension points in place and these items deferred:

| Item | v1 state |
|---|---|
| PPTX ingestion | Rejected with a clear message (no mature pure-JS reader); DOCX and PDF are supported |
| AI-generated imagery | Not included; figures come from structured renderers and icons. An image provider could be added as a routed renderer |
| SCORM / xAPI packaging | Not included (a specification non-goal); the output is a standalone HTML file |
| Native archetype builders | 14 of 22 archetypes have native builders; the others route to Mermaid, SVG.js, Vega-Lite or D3 through fixed routes |
| Learner-perspective reviewers | Registered in `reviewers.json` but disabled by default |
| AI classifiers (import stage, visual archetype, claim category, risk tier) | Schemas and prompt templates exist; ingestion uses the deterministic scorer and stops on low confidence |
| Pixel baselines | See [ADR 0008](0008-no-pixel-baselines-v1.md) |

## Consequences

- Each deferral is listed in the README limitations and can be added without changing the pipeline's shape.
