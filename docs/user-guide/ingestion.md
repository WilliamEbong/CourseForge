# Ingestion: starting from existing work

`courseforge ingest` brings an artifact from any production stage into a course, so CourseForge can review,
improve or continue it instead of starting from a concept.

```sh
./courseforge ingest <file> [--course <id>] [--title <text>] [--stage <stage>]
                     [--mode preserve|review-only|improve|rebuild] [--replace] [--conservative]
./courseforge run --course <id> --to release
```

## Formats

| Format | Extensions | Adapter | Notes |
|---|---|---|---|
| Markdown | `.md`, `.markdown` | `marked` lexer | Headings, tables (including inline HTML in cells), IDs, links |
| Plain text | `.txt` | Markdown adapter | |
| HTML | `.html`, `.htm` | `cheerio` | Embedded course data (`const COURSE = {…}` or a JSON `<script>`) is extracted first; otherwise DOM heuristics (`lossy`) |
| JSON | `.json` | built-in | Validated against the accepted stage's schema and written as-is |
| Word | `.docx` | `mammoth` → HTML | Magic bytes must be a zip/Word package |
| PDF | `.pdf` | `unpdf` text extraction | Layout, tables and headings are lost; marked `lossy` |

PPTX, XLSX, images and other binaries are rejected with a message asking for one of the supported formats.

## What happens on import

1. The file is copied byte-for-byte to `input/originals/<hash12>-<name>` and made read-only. Its hash is
   re-verified at every run and by the release gate (`ORIGINAL_MODIFIED`).
2. It is parsed into a normalised document (text, headings, tables, IDs, links, embedded data, warnings).
3. The production stage is inferred (below) or taken from `--stage`. A declared stage is still validated; a
   disagreement with the inference is reported as a warning.
4. A stage normaliser writes the canonical course files: concept notes, research brief, dossier (plus
   `sources.jsonl`, `claims.jsonl`), instructional design, storyboard (including the 10-column block and item
   tables of the reference example), or, for HTML, a reconstructed course model and storyboard.
5. `input/intake-report.json` is written and the artifacts are registered with producer `imported` (or `human`
   with `--replace`).
6. The stage becomes `INGESTED` with the chosen mode; later stages that were locked become stale.

Imported IDs are kept verbatim (`AB-OHS-4`, `LO4`, `T3-07`, `GA-15`); the kind of an ID comes from where it
lives, not its spelling.

## Stage inference

`scoreStages` (`src/ingestion/infer.ts`) scores every stage from document signals, for example:

| Stage | Signals |
|---|---|
| RESEARCH_BRIEF | a single fenced prompt block, ALL-CAPS section labels, many numbered research questions |
| RESEARCH_DOSSIER | a claim-to-source table, an annotated bibliography, many bracket citation tokens |
| INSTRUCTIONAL_DESIGN | `LO<n>` headings, a content disposition matrix, an objective alignment matrix |
| STORYBOARD / EDITORIAL | tables headed `Block ID … Complete learner-facing content`, item tables with `Correct answer`; editorial-pass markers select EDITORIAL |
| COURSE_QA | a QA report title and verification/accessibility/functional sections |
| COURSE_BUILD | HTML with embedded course data, or an interactive DOM with scripts |
| JSON stages | the JSON validates against that stage's schema |

Confidence is `high` when the best score is ≥ 0.7 with a margin ≥ 0.2 over the runner-up, `medium` at ≥ 0.5
with margin ≥ 0.1, otherwise `low`. Without `--stage`, a `low` result stops the import (exit 2) with the best
guess and evidence, unless `--conservative` is given, in which case the import proceeds in `review-only` mode.

## Modes

| Mode | Generate | Review panel | Repair | Use when |
|---|---|---|---|---|
| `preserve` | no | no (validators only) | no | The artifact is final; you only want to continue downstream |
| `review-only` | no | yes | no | You want findings and a report, no changes |
| `improve` | no | yes | yes | Default (`course.yaml` `improvement.default_import_mode`): keep the work, fix what reviewers find |
| `rebuild` | yes | yes | yes | Treat the import as source material and regenerate the stage |

Mode behaviour is defined in `config/review-policy.json#intakeModes`.

## Intake report

`input/intake-report.json`:

| Field | Meaning |
|---|---|
| `originals[]` | name, preserved path, hash, bytes, format |
| `declaredStage`, `inferred {stage, confidence, method, scores, evidence}`, `acceptedStage` | How the stage was decided |
| `mode` | Intake mode |
| `contractGaps[]` | Stage-contract requirements with `met`, `partial` or `missing` |
| `idsFound`, `counts` | ID counts by kind; content counts (modules, blocks, items, sources, screens, …) |
| `producedArtifacts[]` | Canonical files written |
| `warnings[]`, `lossy` | Parsing caveats; `lossy` when structure could not be fully recovered |
| `nextLegalTargets[]` | Stages you can run to next |

## Existing HTML courses

```sh
./courseforge ingest old-course.html --course old-course --stage course_build --mode improve
./courseforge improve --course old-course
```

The HTML is preserved and a model is reconstructed (embedded data first, DOM heuristics otherwise). COURSE_QA
crawls the original in a real browser (heuristic crawler, axe, screenshots) and runs the reviewer panel. In
`improve` mode, when a storyboard could be reconstructed, the course is rebuilt through CourseForge components
with approved content repairs applied, re-reviewed, and compared with the original in
`review/regression-report.md`. Without a reconstructable model, repairs are exact find/replace edits to a copy of
the HTML. The original file is never modified.

## Replacing an artifact after hand edits

Edit a copy of a canonical artifact, then:

```sh
./courseforge ingest edited-storyboard.json --course <id> --stage storyboard --mode preserve --replace
```

The replacement is recorded as a `human-edited` version. Hand edits made directly to canonical files are also
detected at the next run by hash.
