# ADR 0014: Review levels, and a one-shot level that is asked only once

## Context

Authors want to give CourseForge whatever they have (a description, documents, a half-finished course) and come
back when the course is finished. v1 had no such setting. The storyboard gate defaults to `hybrid`, which always
pauses. Risk floors add pauses that `--gate auto` cannot remove. Findings that the repair loop cannot fix open a
human gate in the middle of the run. `course.yaml#human_review` can only make gates stricter. Other authors want
the opposite: to approve every step, or stricter handling for every course.

## Decision

- `course.yaml#pipeline.review_level` has four values, chosen with the setup questions:
  - `one_shot`: every stage runs with an `auto` gate, and RELEASE has a `human` gate. The stage defaults, the
    policy and the risk floors do not apply; the run pauses exactly once, before release, for every course
    including high-stakes ones. A stage whose findings survive the repair cycles, or that ends with blocking
    findings, is locked with those findings still open instead of pausing. The release gate then lists them, and
    blocks release while any is release-blocking. A `--gate` flag on a command still overrides for that run.
  - `recommended`: the v1 behaviour (stage defaults, policy, `human_review`, risk floors).
  - `every_step`: a `human` gate at every stage, so nothing is repaired without the author.
  - `strict`: every step, and the course is treated as `high_stakes` whatever its topic
    (`effectiveRiskTier()`), which applies the stricter research checks and floors.
- `courseforge make` takes a description, documents or folders, one HTML/JSON course file, or an existing course
  ID, and runs to release. Documents are converted to text in `input/source-material.md`, an optional input of
  CONCEPT, RESEARCH_BRIEF and RESEARCH_DOSSIER. Research uses them as `internal` sources: authoritative for the
  author's organisation, but not for law or science.

## Consequences

- One-shot never releases without a person: the final sign-off is a recorded human approval in the release
  manifest. That person is the only human check on high-stakes content in this mode, so the sign-off message
  points them at the course and the open findings.
- Findings carried by one-shot stay visible (`findings list`, release decision). Downstream stages may build on
  content that still has open findings; the release gate blocks release while any of them is critical.
- A stage failure (an agent error, a write violation, a lock conflict with content the author locked) still
  stops a one-shot run. `make` prints how to resume it.
- Source material is capped at 400,000 characters; longer material is cut, and the author is told.
