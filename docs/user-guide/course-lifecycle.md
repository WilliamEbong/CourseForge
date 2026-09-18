# Course lifecycle

A course moves through eleven stages. Each stage reads the locked outputs of earlier stages, writes its own
artifacts, is reviewed, and is locked before the next stage may use it.

| # | Stage | Produces | Kind |
|---|---|---|---|
| 1 | CONCEPT | `input/concept.json`, `input/concept.md` (normalised concept, assumptions, gaps, risk tier) | agent |
| 2 | RESEARCH_BRIEF | `research/research-brief.json` / `.md` | agent |
| 3 | RESEARCH_DOSSIER | `research/research-dossier.json` / `.md`, `research/sources.jsonl`, `research/claims.jsonl` | agent, one task per section, web tools |
| 4 | INSTRUCTIONAL_DESIGN | `design/instructional-design.json` / `.md` (objectives, modules, assessment strategy, alignment) | agent |
| 5 | STORYBOARD | `storyboard/storyboard.json` / `.md` (complete learner-facing blocks, items, visual specs) | agent, one task per module |
| 6 | EDITORIAL | `storyboard/storyboard-edited.json` / `.md`, `storyboard/editorial-diff.json` | agent, prose only |
| 7 | VISUAL_DIRECTION | `visual/direction.json`, `design-tokens.json`, `component-plan.json`, `visual-specs.json`, `design-brief.md` | agent picks enums, code expands |
| 8 | COURSE_MODEL | `model/course.json`, `model/trace.json`, `model/build-manifest.json` | deterministic |
| 9 | COURSE_BUILD | `build/index.html`, `build/build-report.json` | deterministic |
| 10 | COURSE_QA | `review/functional-tests.json`, `accessibility-review.json`, `screenshots/`, `consolidated-review.md`, `repair-plan.json`, `regression-report.json` | browser QA + 10 reviewers |
| 11 | RELEASE | `release/course.html`, `qa-report.md`, `source-report.md`, `release-manifest.json`, `licenses/` | deterministic |

For stages with twin artifacts, **JSON is canonical** and the Markdown is rendered from it by code. Editing
only the Markdown changes nothing; edit the JSON, or edit a copy and re-import it with `ingest --replace`.

## Inside a stage

1. **Plan.** The router resolves an execution plan (reviewers, skills, tools, backend, gate, paths, visuals) and
   saves it with its decision log before any agent runs.
2. **Generate or compile.** Agent stages fan out tasks where configured (dossier sections, storyboard
   modules); outputs are schema-validated, merged, rendered to Markdown and registered as new artifact versions.
3. **Validate and review.** Deterministic validators run; the reviewer panel runs in parallel (3 at a time).
4. **Adjudicate and repair.** Findings are merged and prioritised; a repair plan lists actions by target ID; the
   repairer replaces only those objects; only affected reviewers rerun. At most 3 cycles by default.
5. **Gate.** `auto` locks when no blocking findings remain. `hybrid` and `human` wait for you.
6. **Lock.** Canonical artifacts are marked approved; later stages that were locked become stale.

Stage-specific guards worth knowing:

- RESEARCH_DOSSIER mints stable claim IDs (`CLM-0001`) and checks citation/ID integrity.
- INSTRUCTIONAL_DESIGN validators check objective verbs, coverage and alignment.
- STORYBOARD validators: unique IDs, no placeholders, answer keys, every objective assessed, citations resolve,
  figure text equivalents, no drag-only interactions, locks intact.
- EDITORIAL may change prose only. A structural diff rejects changes to IDs, types, keys, citations, numbers and
  objective maps; a polarity guard flags edits that drop negations or qualifiers ("not only", "rather than",
  "never", "unless"). This guard exists because the reference example's humanised storyboard turned
  "…not only the product classification" into "…the product classification alone".
- VISUAL_DIRECTION: the agent chooses only a visual family, accent hue, density, corner style, type scale and
  figure style plus an archetype per visual; code computes tokens and a light/dark contrast matrix.

## Controlling a run

```sh
./courseforge run --course <id> --to design              # stop after a stage
./courseforge run --course <id> --from storyboard --to storyboard --force   # redo one stage
./courseforge status --course <id>
./courseforge continue --course <id>                     # after a pause, failure or interruption
```

Runs are resumable. If the process dies, the next `continue` detects the in-flight stage, reuses completed
generation when all outputs exist, and redoes the rest. Only one run per course at a time (`.lock`).

## Versions

Every write to a canonical artifact registers a new version in `artifacts.json` and a snapshot copy under
`versions/<label>/`, with labels such as `storyboard-v3-repaired` or `storyboard-v4-human-approved`. Events:
`generated`, `imported`, `reviewed`, `repaired`, `human-edited`, `human-approved`, `build`, `qa-repaired`,
`release`.

```sh
./courseforge versions list --course <id>
./courseforge versions restore --course <id> --label storyboard-v2-generated
```

Restoring copies the old version forward as a new version (history is never rewound) and marks the stage
`INGESTED` in `preserve` mode so it is re-validated on the next run.

## Changes upstream

When a stage produces new canonical content, later locked stages are invalidated: machine-approved ones become
`SUPERSEDED` and are regenerated on the next run; human-approved ones wait for you with reason
`upstream_changed`. Hand edits to canonical files are detected by hash at the next run and recorded as
`human-edited` versions.

## Where to look

| Question | File |
|---|---|
| What ran and why? | `logs/execution-plans/*.json`, `logs/routing-decisions.jsonl` |
| What happened, in order? | `logs/run-events.jsonl` |
| Raw agent output? | `logs/tasks/<task>.stdout` / `.stderr` (gitignored; `clean` removes it) |
| What did reviewers say? | `<stage dir>/review/<stage>/c<cycle>/`, `review/findings/c<cycle>/` for QA |
| Why was release blocked? | `release/release-decision.json` |
