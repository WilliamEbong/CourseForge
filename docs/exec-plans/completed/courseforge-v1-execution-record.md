# CourseForge v1 — execution record

Companion to the approved plan in [`../active/courseforge-v1.md`](../active/courseforge-v1.md). It records what was
built, how it was verified, and every deviation from the plan.

## How it was built

- **Wave 0** (coordinator): shared contracts: enums, zod schemas, strict wire schemas, fs/proc/hash utilities, the
  harness interface and the pipeline API surface.
- **Parallel streams**, each owning disjoint directories:
  - A: routing and artifacts
  - B: CLI and environment
  - C: harness adapters
  - E: components, runtime and renderer
  - GFX: graphics
  - I: ingestion
  - P: prompts, rubrics and skills
  - R: review and release
  - F: QA
  - G: docs and CI
- **Coordinator:** the orchestrator (`src/pipeline/`), demo fixtures, cross-stream integration and fixes.

## Verification on the build machine (Windows 10, PowerShell 5.1, Node 24.14)

| Check | Result |
|---|---|
| `npm run typecheck`, `npm run lint` | clean |
| `npm test` (Vitest, fake harness) | ~600 tests pass |
| `npm run test:e2e` | crawl of the reference HTML: 133 screens reachable, 0 page errors, offline |
| `npm run test:acceptance` | 81/82 spec-10 IDs covered and passing; B7 (live) is opt-in via `COURSEFORGE_LIVE=1` |
| `courseforge smoke` | READY (diagrams → single-file build → Chromium → interactions → axe → screenshots) |
| `node scripts/fresh-clone-smoke.mjs` | clean clone → READY in 87 s; idempotent re-run in 22 s |
| `courseforge doctor --live` | both Claude Code and Codex return isolated, schema-valid replies |
| Offline demo, `new … --to release --gate auto --harness fake` | concept → release in about 30 s, all 11 stages locked |
| Reference HTML improvement (`ingest … --stage course_build --mode improve` → release) | about 2 min |
| Live Claude run (concept → research brief) | real generation, a real reviewer finding, a real repair, stage locked |

The reference HTML improvement run went through these steps:

1. Crawl QA of the original.
2. Review panel.
3. Rebuild through CourseForge components, giving 20 real SVG figures.
4. Contract QA of the rebuilt course.
5. Regression verdict: *improved*.
6. Release.

## Deviations from the plan (all intentional)

1. **PROCESS/TIMELINE routing.** These now route to native `cf_svg` first, with Mermaid as the fallback. Mermaid's
   left-to-right flowcharts rendered text too small to read at 390 px; the native builder wraps. Mermaid stays
   primary for decision trees, cause/effect, system architecture, sequence and state diagrams.
2. **CSS budget.** It is about 40 KB minified against the planned 25 KB. Six token families, dark mode and the print
   styles account for it. The test budget is 48 KB; the total single-file course is about 180 KB.
3. **Crash recovery works at stage level.** An interrupted stage restarts and reuses its generated outputs; review
   cycles are rerun rather than resumed mid-cycle.
4. **Only one AI classifier is wired as a fallback.** Import-stage inference falls back to the agent classifier when
   the heuristics are not decisive. The other classifiers (archetype, claim category, risk tier) are carried by the
   authoring agents' closed-enum fields.
5. **Backend fallback** triggers on a configured failure class, at most once per run. It is disabled by default
   (`config/fallbacks.json` and `course.yaml` must both allow it).
6. **Fake-harness fixtures** are keyed by template/subject/cycle, not by input hashes, so they do not break when
   prose changes.
7. **Graded items are single-attempt** in the learner runtime; QA resets the assessment between scripted attempts.
8. **Imported HTML improvement** always ends in a structural rebuild through CourseForge components, with content
   repairs applied to the reconstructed storyboard first. The imported copy and the original are both preserved.
9. **Section locks** now carry forward across artifact versions; the plan implied this, but the first
   implementation dropped them. Human approvals create `…-human-approved` milestone versions.
10. **Release-gate review records** live under `review/release/`, so `release/` holds only shippable outputs.

## Known limitations

These are the same limitations listed in the README:

- Automated accessibility checks are not a formal audit.
- Full live generation is slow and costs tokens.
- PPTX import is not supported.
- There is no SCORM/xAPI packaging.
- There is no AI imagery.
- Codex isolation is partial: the user-global `AGENTS.md` is always loaded.
- There are no pixel baselines.
