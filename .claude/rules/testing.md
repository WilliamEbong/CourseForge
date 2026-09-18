---
paths:
  - "tests/**"
  - "src/**"
---

# Testing rules

- **Tag acceptance tests.** Tests that cover a spec-10 requirement carry its ID in the title (for example `@C6 retry limit stops after 3 cycles`) so `npm run test:acceptance` selects them and coverage of A–L stays queryable.
- **Offline by default.** No test calls a live agent. Use the fake harness (`src/harness/fake.ts`, or `COURSEFORGE_HARNESS=fake` + `COURSEFORGE_FIXTURES=<dir>`) with fixtures keyed by template, subject and cycle. Live smoke tests run only with `COURSEFORGE_LIVE=1`.
- **Fixtures are scrubbed.** Recorded outputs contain no home paths, usernames, emails or tokens; the recorder refuses to write if a secret pattern survives.
- **Before finishing any change to `src/` or `tests/`,** run and pass:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  Run `npm run test:e2e` when the change touches the renderer, components, runtime or QA, and never while agent pools or other browser runs are active (limited RAM).
- **Deterministic tests.** No reliance on wall-clock time, randomness or network; inject clocks, seeds and runners.
- **Schema changes** require `npm run gen:schemas` and a passing drift test.
