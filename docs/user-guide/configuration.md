# Configuration

Two levels: `course.yaml` per course, and the registries in `config/` for the whole repository.

## course.yaml

Created by `new` or `ingest`; validated by `CourseManifestSchema` (`src/core/schemas/course.ts`).

```yaml
course:
  id: safe-ladder-use                 # kebab-case, 2–63 chars
  title: Safe Ladder Use
  language: en
  target_duration_minutes: 30
  audience: warehouse staff
  jurisdiction: Ontario, Canada
  risk_tier: standard                 # standard | elevated | high_stakes
  risk_override: null                 # "acknowledged" allows gates below the risk floor (recorded)
pipeline:
  start_stage: CONCEPT
  target_stage: RELEASE
  agent_backend: auto                 # auto | claude | codex
  backend_fallback: false             # allow switching backend when the chosen one is unavailable
  max_repair_cycles: null             # 0–10; null = config/review-policy.json
  visual_family: null                 # preferred family for VISUAL_DIRECTION (see below)
  review_level: recommended           # one_shot | recommended | every_step | strict (see human-review.md)
human_review:                         # per-stage gate: auto | hybrid | human (optional/required accepted)
  RESEARCH_DOSSIER: hybrid
  STORYBOARD: human
improvement:
  preserve_human_edits: true
  default_import_mode: improve        # preserve | review-only | improve | rebuild
tracking:                             # learner results (see tracking.md); set by the setup questions
  destination: none                   # none | lms | sheet | tracker
  endpoint: null                      # https address results are sent to (sheet, tracker)
  identity: name                      # name | name_and_id | name_and_email
  id_label: null                      # label for the staff-number box
setup:
  configured_at: null                 # when the setup questions were last answered
```

| Field | Notes |
|---|---|
| `course.risk_tier` | Sets gate floors (see [human-review.md](human-review.md)). CONCEPT may raise it from its classification; it is never lowered automatically |
| `course.risk_override` | Only value: `acknowledged`. Lets `--gate` go below the risk floor; appears in the plan's gate decision and the release manifest |
| `pipeline.agent_backend` | Overridden by `--backend`. `auto` uses the first available, signed-in backend in `config/fallbacks.json` order |
| `pipeline.backend_fallback` | Fallback also requires `fallbacks.json#backend.enabled: true`; triggers are `unavailable`, `authentication_failed`, `billing_error`, `model_not_found` |
| `human_review` | Keys are stage names in any case (`storyboard`, `instructional_design`); `research` means RESEARCH_DOSSIER |
| `pipeline.visual_family` | `scientific-clinical`, `technical-industrial`, `corporate-professional`, `editorial-humanities`, `modern-technology`, `environmental-natural` |

## Registries (`config/`)

These define the pipeline for every course. They are validated at startup and by `courseforge validate-config`
(and `doctor`'s `config.valid`). Editors get completion from `schemas/*.schema.json`.

| File | Change it to… |
|---|---|
| `stages.json` | Change a stage's inputs/outputs, generator skills and tools, validators, reviewer panel, rerun map, default gate, limits, writable paths |
| `reviewers.json` | Add or disable a reviewer, change its rubric, skills, inputs or categories |
| `skills.json` | Register a skill file and the stages/roles that may use it |
| `tools.json` | Register a tool or renderer and its harness tool names |
| `routing.json` | Change archetype → renderer routes, icon names, block kind → component |
| `fallbacks.json` | Renderer repair budget, schema/process retries and backoff, backend fallback, concurrency |
| `guidance.json` | The plain-language wording of the setup questions, their choices and messages, and the description of every stage |
| `review-policy.json` | Repair cycle cap, repair and release-blocking severities, axe blocking impacts, `onCapReached` (`human` or fail), gate defaults, risk floors, intake-mode behaviour |

The architecture behind these files is described in [routing.md](../architecture/routing.md) and
[review-and-repair.md](../architecture/review-and-repair.md). Developer recipes:
[adding a reviewer](../developer-guide/adding-a-reviewer.md),
[adding a visual archetype](../developer-guide/adding-a-visual-archetype.md),
[adding a component](../developer-guide/adding-a-component.md).

## Environment variables

See the table in [cli.md](cli.md#environment-variables).
