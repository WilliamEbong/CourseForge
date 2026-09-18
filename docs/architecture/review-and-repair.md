# Review, adjudication and repair

Review is an ensemble of narrow reviewers plus deterministic validators. Code merges and prioritises their
findings, an AI adjudicator is consulted only when judgement is needed, and repairs are scoped to IDs named in a
byte-stable repair plan. The loop is bounded.

## Reviewer panels (`config/stages.json` + `config/reviewers.json`)

| Stage | Reviewers |
|---|---|
| CONCEPT | concept-scope-safety |
| RESEARCH_BRIEF | brief-scope-completeness, brief-evidence-strategy, brief-safety |
| RESEARCH_DOSSIER | evidence-source, domain-completeness, currentness-jurisdiction, safety-scope, adversarial-research |
| INSTRUCTIONAL_DESIGN | learning-architecture, alignment, audience-cognitive-load, source-fidelity, assessment-strategy |
| STORYBOARD | content-completeness, instructional, assessment, citation-evidence, accessibility-planning, editorial-readability |
| EDITORIAL | editorial-integrity, editorial-readability |
| VISUAL_DIRECTION | information-design, visual-ui, responsive-planning, accessibility-visual, content-integrity |
| COURSE_MODEL, COURSE_BUILD, RELEASE | none (deterministic validators only) |
| COURSE_QA | factual-currentness, gap-analysis, instructional-final, assessment-engine, functional-browser, accessibility-final, ui, ux, visual-consistency, release-adversarial |

Registered but disabled: learner-novice, learner-practitioner, learner-keyboard, learner-mobile,
learner-returning (enable in `reviewers.json`). Each reviewer gets one rubric (`prompts/rubrics/<id>.md`), the
generic `prompts/templates/review.md`, its routed skills, read-only tools and only its declared inputs. QA
reviewers with `needsScreenshots` also receive the screenshot manifest. Reviewers run in a pool of 3
(`fallbacks.json#concurrency.reviewers`) with `writeMode: findings-only`.

## Findings

A reviewer returns a `FindingSet { summary, findings[] }`. Code assigns IDs and provenance
(`src/review/findings.ts`):

| Field | Notes |
|---|---|
| `findingId` | `<stage code>-C<cycle>-<seq>` for reviewers (`SB-C0-003`), `-V<seq>` for validators, `-Q<seq>` for QA checks, `-H<n>-001` for human instructions |
| `stage`, `cycle`, `reviewer`, `source` | `source` is `reviewer`, `validator`, `qa` or `human` |
| `artifactId`, `location` | `location` is a stable ID (`M2-B03`, `LO4`, `V-07`) or `global` |
| `severity` | `blocker`, `critical`, `major`, `minor`, `style` |
| `category` | Closed enum of 23 categories (accuracy, citation, alignment, accessibility, functional, traceability, …) |
| `problem`, `evidence[]`, `recommendedAction`, `confidence` | `confidence` is `high`, `medium` or `low` |
| `status` | `open`, `accepted`, `rejected`, `fixed`, `waived`, `deferred` |
| `mergedFrom[]`, `checkId` | Duplicates merged into this finding; validator/QA check ID |

Stored per cycle under `<stage dir>/review/<stage>/c<cycle>/` (QA: `review/findings/c<cycle>/`): each reviewer's raw
output, `findings.json`, `repair-plan.json` and a consolidated Markdown report.

## Deterministic pre-adjudication

`preAdjudicate` (`src/review/adjudicate.ts`) is pure and order-independent:

1. **Cluster** findings with the same `artifactId`, `location` and `category` whose problem texts have token
   Jaccard similarity ≥ 0.8. The kept finding has the highest severity, then confidence, then lowest ID; the
   others go into `mergedFrom` and their evidence is unioned.
2. **Apply human decisions** from the stage gate (`findings accept|reject`).
3. **Sort** by severity, location, category, ID.
4. **Split** findings at repair severities (`blocker`, `critical`, `major` by default) into `actionable` and
   `lockConflicts` (the location is a locked ID or a child of one).
5. **Detect contradictions** among actionable findings at the same location: one says remove and another says
   expand, or categories differ and recommendations share < 20 % of tokens.

The AI adjudicator (`prompts/templates/adjudicate.md`) runs only if there are contradictions, low-confidence
findings, or blocker/critical findings. It returns per-finding verdicts (`accept` with final severity and an
optional repair instruction, `reject`, `defer`); unknown finding IDs are ignored with a warning.

## Repair plans

`buildRepairPlan` (`src/review/repair-plan.ts`) groups actionable, non-conflicting findings by target ID into
actions `A<cycle>-NN`, ordered by severity then target, each with the merged instruction text. It also lists
`lockConflicts`, `deferred`, `rejected` and `unrepairable` (findings with location `global`, or any finding when
the target is `tooling-defect`). The same findings in any order produce byte-identical JSON. Targets:

- `model` — the stage's JSON artifact (storyboard, design, visual specs, …); for imported HTML at COURSE_QA, the
  reconstructed model;
- `html-direct` — the built HTML when no model repair spec exists;
- `tooling-defect` — nothing repairable by an agent; findings are reported, not actioned.

## Scoped repair

- **Model repairs** (`applyRepairResult`, `src/review/apply.ts`; stage wiring in `src/pipeline/repair-target.ts`):
  the repairer returns whole replacement objects by `id`. Each replacement is rejected if its target is not in
  the plan, is locked, is duplicated, cites actions for another target, is not valid JSON, changes its own `id`,
  is missing or ambiguous in the artifact, fails the object's zod schema, or would change the hash of any locked
  region (ancestor or descendant). Accepted and rejected replacements are written to
  `repair-applied-c<cycle>.json`.
- **HTML repairs** (`applyHtmlEdits`): exact find/replace edits tied to plan action IDs; an edit must match
  exactly once and must not change the number of `<script>` elements.

## Write audit and rollback

Every agent step (generate, review, adjudicate, repair) runs inside `audited()` in `src/pipeline/run-stage.ts`:
the course directory (excluding `logs/`) is hash-walked before and after. A change outside the task's writable
paths is restored from the artifact's snapshot (or deleted if it is new), logged as `audit.violation`, and the
stage fails with `write_violation`. This, not CLI permission flags, is the hard guarantee that an agent cannot
widen its scope. Section locks are enforced by the repair application above and the `locks-intact` validator.

## Cycles and caps

After a repair, only reviewers whose findings were actioned plus those mapped by `rerunMap[category]` rerun;
other reviewers' unresolved findings carry forward. The loop ends when no actions remain, when nothing could be
applied, or at `maxRepairCycles` (3; overridable per stage in `review-policy.json` or per course with
`pipeline.max_repair_cycles`). At the cap, `onCapReached: human` opens a gate with reason `cycle_cap`; otherwise
the stage fails with `cycle_cap`. A lock conflict always opens a gate (`lock_conflict`). In `human` gate mode the
AI repair loop is skipped.

## Gate outcome

After the loop, findings at release-blocking severities (`blocker`, `critical`) that are still `open`,
`accepted` or `deferred` decide the result. With an `auto` gate the stage locks if there are none; otherwise it
opens a gate (reason `validator_failed`). With `hybrid` or `human` the stage always waits (reason `policy`,
`high_stakes` when the risk floor set the gate, or `validator_failed`).

## Human findings decisions

`courseforge findings accept --ids …` marks findings `accepted` (they will be repaired or, at release, still
block); `findings reject --ids …` marks them `waived`. Decisions are stored in the stage gate's
`findingDecisions` and re-applied in later cycles, including to findings merged under a new ID.

## Tests

`tests/unit/review/*.test.ts` (E2–E5), `tests/integration/pipeline/pipeline.test.ts` (E6, C5, C6).
