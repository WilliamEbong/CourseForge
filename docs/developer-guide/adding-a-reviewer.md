# Adding a reviewer

A reviewer is data: a registry entry, a rubric file and a place in a stage panel. No TypeScript is needed.

## 1. Write the rubric

Create `prompts/rubrics/<reviewer-id>.md`. The generic `prompts/templates/review.md` already explains the
finding format; the rubric states only what this reviewer judges:

- the question it answers and what is out of scope (so panels do not overlap);
- concrete checks, each tied to a finding category and a default severity;
- what counts as evidence (IDs, quotes, screenshot names);
- when to return no findings.

Keep deterministic checks out of rubrics. If a rule can be checked by code (an ID exists, a count, a regex), add
a validator instead.

## 2. Register it in `config/reviewers.json`

```json
"plain-language": {
  "description": "Plain-language and reading-level review of learner-facing text",
  "rubric": "prompts/rubrics/plain-language.md",
  "promptTemplate": "review",
  "skills": ["editorial-humanization"],
  "tools": ["read", "grep", "glob"],
  "categories": ["editorial", "cognitive-load"],
  "inputs": ["storyboard/storyboard-edited.json"],
  "needsScreenshots": false,
  "network": false,
  "enabled": true
}
```

- `inputs` are course-relative paths the reviewer is told to read (it reads them itself).
- `categories` must come from `FINDING_CATEGORIES` (`src/core/enums.ts`).
- `skills` must exist in `config/skills.json`; `tools` must be `agent-tool` entries in `config/tools.json`.
  Network tools (`web-search`, `web-fetch`) require `"network": true`.
- `needsScreenshots: true` adds the QA screenshot manifest (COURSE_QA only).

## 3. Add it to a stage panel

In `config/stages.json`, append the ID to the stage's `reviewers` and map the categories it cares about in
`rerunMap`, so it reruns after repairs in those categories:

```json
"reviewers": ["editorial-integrity", "editorial-readability", "plain-language"],
"rerunMap": { "editorial": ["editorial-readability", "plain-language"] }
```

## 4. Validate and test

```sh
./courseforge validate-config
npm test -- tests/unit/routing tests/unit/config
```

The router snapshot tests in `tests/unit/routing/router.test.ts` will show the new TaskSpec; update them
deliberately. For offline pipeline runs, add fake-harness fixtures at
`tests/fixtures/harness/demo/review/<reviewer-id>.json` (or a `default.json` already covers it); regenerate the
demo set with `npx tsx scripts/gen-demo-fixtures.ts` if the reviewer is added there.

## Notes

- Reviewers are always `findings-only` with read-only tools; they cannot edit anything.
- The panel runs 3 reviewers at a time (`fallbacks.json#concurrency.reviewers`); large panels cost time and tokens.
- To trial a reviewer without affecting runs, register it with `"enabled": false`; plans log it as skipped.
- A missing rubric file fails the task at prompt assembly (`PROMPT_ASSET_MISSING`), not at config validation.
