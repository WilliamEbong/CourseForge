# Setup wizard and learner tracking: execution record

The plan is [tracking-and-setup-wizard.md](../active/tracking-and-setup-wizard.md). The judgement calls made
during the build are listed at the end of that plan. The decision is recorded in
[ADR 0013](../../adr/0013-optional-tracking.md).

## What was built

| Phase | Result |
|---|---|
| P0 | Plan copied into the repository; ADR 0013 added and indexed |
| P1 | `config/guidance.json` (plain-language stage descriptions, questions and messages, validated and cross-checked); `tracking` and `setup` blocks in `course.yaml`; terminal wizard (`src/cli/wizard.ts`) run by `new` and `ingest` for new courses in an interactive terminal; `configure` / `reconfigure`; `--defaults`; `status` reminders; `invalidateStages` shared with the stage loop |
| P2 | Tracked builds: CSP `connect-src` limited to the destination's origins; `checkSingleFile` accepts exactly that list; runtime record panel and `track.ts`; QA stubs the origin and requires exactly one valid result; Google Sheet option with an Apps Script and click-by-click instructions |
| P3 | SCORM 1.2 runtime adapter; `zipEntries`; `package --scorm`; RELEASE writes `release/course-scorm.zip` for LMS courses; LMS upload instructions |
| P4 | `courseforge tracker` (`src/tracker/`): validated, size- and rate-limited result intake; password-protected dashboard, JSON and CSV; instructions for the author and their IT person |

## Verification on the build machine (2026-09-18)

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only, all in existing CSS idioms) |
| `npx tsx scripts/gen-schemas.ts --check` | pass (47 schemas, including `guidance-config` and `tracking-event`) |
| `npm test` | 655 passed, 2 skipped |
| `npm run test:e2e` | 1 passed |
| `npm run test:acceptance` | 81 of 82 IDs passing; B7 (live) is opt-in, as before |
| Offline pipeline to RELEASE, Google Sheet course | completed; QA tracking check passed; CSP allows only the Apps Script origins |
| Reconfigure that course to untracked, then rerun | build, QA and release invalidated; rebuilt course contacts nothing |
| Offline pipeline to RELEASE, LMS course | completed; `release/course-scorm.zip` written; `package --scorm` works |
| `courseforge tracker` started from the CLI | unauthenticated dashboard request answered 401; results accepted; the dashboard, rendered from those live results, was checked in a real browser at 1440 and 390 px (hostile text shown as plain text, figures correct) |

## Manual live checks left for the author

These need real accounts or systems, so they were not done during the unattended build:

1. **Google Sheet.** Follow `courses/<id>/tracking/google-sheet-setup.md` with a real Google account. Check that
   the wizard's test result arrives and that a learner's result from the released course adds a row and updates
   the Summary tab. This confirms the Apps Script redirect behaviour end to end.
2. **LMS.** Upload `release/course-scorm.zip` to a real LMS, or to SCORM Cloud (free tier). Check that it shows
   *incomplete* on start, then *passed*/*failed* with the score on completion.
3. **Own dashboard behind HTTPS.** Run `courseforge tracker` behind a reverse proxy with a certificate and send a
   result from a course served over HTTPS.
4. **The wizard in a real terminal** (Windows Terminal and PowerShell): run `courseforge new "Test"` and
   `courseforge configure --course test` by hand once. The automated tests drive the wizard through scripted
   replies, not a real keyboard.
