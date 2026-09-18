# Human review

You can be as involved as you like: fully automatic, approve-after-AI-review at chosen stages, or approve
everything yourself. Human decisions are authoritative; CourseForge never silently overwrites approved or locked
content.

## Gate modes

| Mode | AI review | AI repair loop | Then |
|---|---|---|---|
| `auto` | yes | yes | Locks if no blocking findings remain; otherwise opens a gate (`validator_failed`) |
| `hybrid` | yes | yes | Always waits for your decision |
| `human` | yes | no | Always waits; you decide what gets repaired |

The legacy words `optional` (= `auto`) and `required` (= `human`) are accepted everywhere.

The effective mode for a stage is the strictest of: the stage default (`config/stages.json`, STORYBOARD is
`hybrid`, others `auto`), `config/review-policy.json#gateDefaults`, `course.yaml#human_review` and the risk-tier
floor. `--gate` on a command overrides for that run but cannot go below the risk floor unless the course sets
`risk_override: acknowledged` (recorded in the plan).

| Risk tier | Stages with a minimum gate |
|---|---|
| `standard` | none |
| `elevated` | RELEASE hybrid |
| `high_stakes` | RESEARCH_DOSSIER, INSTRUCTIONAL_DESIGN, STORYBOARD hybrid; COURSE_QA, RELEASE human |

## Why a run pauses

A paused run exits with code 10 and `status` shows the gate reason:

| Reason | Meaning |
|---|---|
| `policy` | The stage's gate is hybrid or human |
| `high_stakes` | The risk floor set the gate |
| `validator_failed` | Blocking findings remain (auto gate), or with any gate at release |
| `cycle_cap` | Repair cycles ran out with actionable findings (`onCapReached: human`) |
| `lock_conflict` | A finding targets content you locked |
| `upstream_changed` | Work you approved depends on an upstream stage that changed |
| `low_confidence` | Reserved for low-confidence classifications |

## Reviewing

```sh
./courseforge status --course <id>
./courseforge findings list --course <id> --stage storyboard
```

Read the stage's `consolidated-review` Markdown and `findings.json` under
`<stage dir>/review/<stage>/c<cycle>/` (QA: `review/consolidated-review.md`, `review/findings/c<cycle>/`), and
the artifact itself.

## Deciding

| Command | Effect |
|---|---|
| `gate approve --course <id> --stage <s>` | Accept the stage; `continue` locks it (a `human-approved` version) and moves on |
| `gate reject --course <id> --stage <s> --instructions "…"` | Re-review with your instructions added as an accepted `major` finding and one extra repair cycle |
| `gate reject … --abort` | Mark the stage `FAILED` (reason recorded) |
| `gate rereview --course <id> --stage <s>` | Re-run the review without new instructions |
| `gate comment --course <id> --stage <s> --text "…" [--ids X]` | Add a comment (optionally about one ID) |
| `gate lock --course <id> --stage <s> --ids M2-B03,LO4` | Protect these IDs from any repair (section locks) |
| `gate unlock --course <id> --stage <s> --ids M2-B03` | Remove section locks |
| `findings accept --course <id> --ids SB-C0-003` | Mark findings accepted: they will be repaired, and still block release while unresolved |
| `findings reject --course <id> --ids SB-C0-004` | Waive findings: they are not repaired and do not block |

`--by <name>` records who decided (default: the OS user name). Then:

```sh
./courseforge continue --course <id>
```

## Locks

- **Section locks** (`gate lock --ids`) record the hash of each locked object. Repairs that target a locked ID,
  or would change it indirectly, are rejected; a finding that targets locked content opens a `lock_conflict`
  gate instead of being repaired.
- **Stage locks** happen automatically when a stage is approved. Changing an approved stage later requires a
  new run, an import with `--replace`, or a version restore; human-approved downstream work waits for you rather
  than being regenerated.

## Editing by hand

Hand edits are welcome. Either edit a copy and `ingest --replace` it, or edit the canonical JSON in place: at the
next run the hash change is detected, recorded as a `human-edited` version, the stage re-validates in `preserve`
mode, and downstream stages are invalidated. Do not edit `input/originals/`, `versions/`, generated outputs
(`model/`, `build/`, `release/`, reports) or `state.json`.
