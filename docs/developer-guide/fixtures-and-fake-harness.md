# Fixtures and the fake harness

No test needs a live agent. The fake harness answers agent tasks from JSON fixtures, and recorded CLI output
tests the real adapters' parsing.

## Fixture sets

| Directory | Contents | Used by |
|---|---|---|
| `tests/fixtures/harness/demo/` | Complete, schema-valid agent outputs for the "Spotting Phishing Emails" micro-course, concept to QA panel | Integration tests, e2e, the offline quick start, CI |
| `tests/fixtures/harness-raw/claude/`, `…/codex/` | Recorded, scrubbed stdout/stderr of the real CLIs (success, rate limit, billing, not signed in, truncated, noise, help text) | `tests/unit/harness/parse-*.test.ts`, `detect.test.ts` |
| `tests/fixtures/courses/smoke/` | Small course model covering every interaction family and renderer | Render, QA and e2e tests |
| `tests/fixtures/findings/` | Overlapping reviewer finding sets | Adjudication tests |
| `tests/fixtures/ingest/`, `env/`, `qa/`, `visuals/` | Parser inputs, environment probes, QA pages, visual specs | Unit and integration tests |

Chemical-risk example files are read directly from `examples/chemical-risk/`.

## Fixture layout and lookup

```text
<fixtures>/<promptTemplate>/<subject>.c<cycle>.json   # most specific
<fixtures>/<promptTemplate>/<subject>.json
<fixtures>/<promptTemplate>/default.c<cycle>.json
<fixtures>/<promptTemplate>/default.json              # least specific
```

`subject` is the fan-out key (dossier section, storyboard module) or the reviewer ID; `cycle` is 0 for
generation and the review/repair cycle otherwise. Examples from the demo set: `storyboard-module/M1.json`,
`review/assessment.c0.json`, `review/default.json` (every other reviewer), `repair/default.json`.

Envelope:

```json
{
  "output": { "summary": "…", "findings": [] },
  "failure": null,
  "delayMs": 0,
  "files": { "relative/or/absolute/path": "content written before returning" }
}
```

`failure: {class, message}` simulates a classified failure; `files` simulates an agent writing to disk (use it
to test the write audit). Missing fixtures fail with the list of expected paths.

## Regenerating the demo set

The demo fixtures are generated from typed TypeScript objects so they always match the current schemas:

```sh
npx tsx scripts/gen-demo-fixtures.ts           # rewrite tests/fixtures/harness/demo/
npx tsx scripts/gen-demo-fixtures.ts --check   # CI: fail if the committed files differ
```

Change `scripts/gen-demo-fixtures.ts`, never the generated JSON. One reviewer
(`review/assessment.c0.json`) raises a finding on `M1-F01` in the first storyboard cycle so the
adjudication → repair → re-review path is exercised offline.

## Using the fake harness

```sh
COURSEFORGE_HARNESS=fake COURSEFORGE_FIXTURES=tests/fixtures/harness/demo ./courseforge new "Spotting Phishing Emails" --to storyboard
```

In tests, use `useFakeEnv()` from `tests/integration/pipeline/helpers.ts` (temporary courses directory, fake
harness, demo fixtures, `smoke` QA profile) and `fixturesWith({...})` to override individual fixture files. For
unit tests construct `new FakeHarness({ responder })` directly. Failure injection:
`COURSEFORGE_FAKE_MODE=fail | fail:<class> | invalid-json | timeout | slow:<ms>`.

## Recording from a real backend

```sh
COURSEFORGE_RECORD=tests/fixtures/harness/recorded ./courseforge new "Tiny topic" --to brief --backend claude
```

Each call is written as a fake-harness envelope at `<dir>/<template>/<subject>.c<cycle>.json` after scrubbing home
paths (as `<HOME>`), email addresses (`<EMAIL>`) and token shapes (`<SECRET>`). If a secret-like pattern
survives, the file is not written and a warning is printed. Review recorded files before committing; the
repository hygiene test (`tests/unit/repo/hygiene.test.ts`) scans fixtures for absolute user paths and secrets.

## Live tests

`tests/unit/harness/live.test.ts` runs a tiny structured task against installed backends only when
`COURSEFORGE_LIVE=1`. The nightly workflow runs it only when secrets are configured and never for forks.
