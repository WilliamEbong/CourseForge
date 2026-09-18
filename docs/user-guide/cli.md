# CLI reference

```text
courseforge <command> [options] [--json]
```

Every command accepts `--json` (machine output on stdout; errors as `{ok:false, error:{code, message, exitCode}}`)
and `--help`. `courseforge help <command>` prints a command's usage. Set `COURSEFORGE_DEBUG=1` to print stack
traces.

## Stage names

`CONCEPT, RESEARCH_BRIEF, RESEARCH_DOSSIER, INSTRUCTIONAL_DESIGN, STORYBOARD, EDITORIAL, VISUAL_DIRECTION,
COURSE_MODEL, COURSE_BUILD, COURSE_QA, RELEASE` in any case, or the aliases `concept, brief, research|dossier,
design, storyboard, editorial, visual, model, build, qa, release`.

## Common options

| Option | Values | Meaning |
|---|---|---|
| `--backend` | `auto`, `claude`, `codex` | Backend preference for this invocation (overrides `course.yaml`) |
| `--harness` | `claude`, `codex`, `fake` | Force a harness implementation (also `COURSEFORGE_HARNESS`) |
| `--gate` | `auto`, `hybrid`, `human` (`optional`/`required` accepted) | Gate override for this run; cannot go below the risk floor |
| `--course` | course ID | Target course (kebab-case) |

## Commands

### Environment

| Command | Usage | Notes |
|---|---|---|
| `setup` | `setup [--no-smoke]` | `doctor --repair`, then the smoke fixture; prints `READY` |
| `doctor` | `doctor [--repair] [--only <id,...>]` | Exit 0 when ready, 3 otherwise |
| `validate-config` | `validate-config` | Validates `config/*.json`; exit 2 when invalid |
| `smoke` | `smoke` | Build, render, browser, axe, screenshot; exit 3 on failure. Accepts `--out <dir>` |
| `version` | `version` | CourseForge and Node versions (`--version` also works) |
| `help` | `help [command]` | |

### Creating and importing

| Command | Usage |
|---|---|
| `new` | `new <title> [--id <id>] [--notes <file>] [--audience <text>] [--duration <minutes>] [--jurisdiction <text>] [--language <code>] [--to <stage>] [--gate auto\|hybrid\|human] [--backend …] [--harness …]` |
| `ingest` | `ingest <file> [--course <id>] [--title <text>] [--stage <stage>] [--mode preserve\|review-only\|improve\|rebuild] [--replace] [--conservative] [--backend …] [--harness …]` |

`new` derives the course ID from the title unless `--id` is given and, with `--to`, immediately runs from
CONCEPT to that stage. `ingest` creates the course if it does not exist (ID from the file name unless
`--course`). `--replace` records the file as a human edit replacing the stage's canonical artifact.
`--conservative` uses `review-only` instead of stopping when stage inference is uncertain.

### Running

| Command | Usage |
|---|---|
| `run` | `run --course <id> [--from <stage>] [--to <stage>] [--gate <mode>] [--force] [--backend …] [--harness …]` |
| `continue` | `continue --course <id> [--backend …] [--harness …]` |
| `review` | `review --course <id> [--stage <stage>] [--backend …] [--harness …]` |
| `improve` | `improve --course <id> [--input <file>] [--to <stage>] [--backend …] [--harness …]` |
| `build` | `build --course <id> [--force] [--backend …] [--harness …]` — COURSE_BUILD only |
| `qa` | `qa --course <id> [--force] [--backend …] [--harness …]` — COURSE_QA only |
| `release` | `release --course <id> [--force] [--backend …] [--harness …]` — RELEASE only |

- `run` without `--from` starts at the first stage that still needs work; without `--to` it runs to the saved
  target stage (the previous run's target; initially `pipeline.target_stage`, RELEASE). `--force` re-runs the start stage even if it is `LOCKED` (new versions; locked IDs are
  still protected).
- `continue` resumes an interrupted or paused run toward the saved target stage.
- `review` runs the reviewer panel on a stage (default: the latest stage with content) in `review-only` mode,
  without repairs.
- `improve --input <file>` ingests the file in `improve` mode and runs to `--to` (default RELEASE). Without
  `--input` it re-runs COURSE_QA in `improve` mode on the existing build, then continues.
- `build`, `qa` and `release` are shorthands for `run --from <stage> --to <stage>`.

### Inspecting and deciding

| Command | Usage |
|---|---|
| `status` | `status [--course <id>]` — stage table, gates, open findings and next action; all courses when `--course` is omitted |
| `list` | `list` |
| `gate` | `gate <approve\|reject\|comment\|lock\|unlock\|rereview> --course <id> --stage <stage> [--by <name>] [--text <text>] [--ids a,b] [--abort] [--instructions <text>]` |
| `findings` | `findings <list\|accept\|reject> --course <id> [--stage <stage>] [--ids a,b] [--by <name>]` |
| `versions` | `versions <list\|restore\|select> --course <id> [--label <label>] [--artifact <id>]` |
| `trace` | `trace --course <id> [--id <id>] [--direction up\|down] [--depth <n>] [--impact a,b]` |

See [human-review.md](human-review.md) for gate and findings semantics.

### Housekeeping

| Command | Usage |
|---|---|
| `package` | `package --course <id> [--out <file>]` — zip the course folder (excludes `.lock` and `logs/tasks`); default `.courseforge/packages/<id>.zip` |
| `clean` | `clean [--course <id>] [--build] [--cache] [--dry-run]` — removes only generated paths: `logs/tasks/` and `.cache/` per course, `build/` with `--build`, and `.courseforge/{wire-schemas,smoke,packages}` with `--cache` or when no course is given. Never sources, originals, versions or approved artifacts |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (for `run`-like commands: target stage reached) |
| 1 | Internal error |
| 2 | Usage or configuration error (bad flag, unknown stage, invalid registry, low-confidence ingest) |
| 3 | Environment problem (doctor not ready, smoke failed, no CLI build) |
| 4 | Blocked by the release gate |
| 5 | Course locked by another process |
| 10 | Waiting for human review |
| 11 | Stage failed |

## Environment variables

| Variable | Effect |
|---|---|
| `COURSEFORGE_HARNESS` | `claude`, `codex` or `fake` (same as `--harness`) |
| `COURSEFORGE_FIXTURES` | Fixture directory for the fake harness |
| `COURSEFORGE_FAKE_MODE` | Fake harness failure injection: `fail`, `fail:<class>`, `invalid-json`, `timeout`, `slow:<ms>` |
| `COURSEFORGE_RECORD` | Directory to record real harness results as scrubbed fake-harness fixtures |
| `COURSEFORGE_QA_PROFILE` | `smoke`, `dev` (default) or `release` |
| `COURSEFORGE_COURSES_DIR` | Alternative courses directory (tests use temporary directories) |
| `COURSEFORGE_ROOT` | Override repository root detection |
| `COURSEFORGE_DEBUG` | `1` prints stack traces |
| `COURSEFORGE_LIVE` | `1` enables live-backend tests |
