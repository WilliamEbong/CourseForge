# Rubric: gap-analysis

**Stage:** COURSE_QA (also used for imported courses). **Lens:** two-direction gap analysis of the finished course.

## Read

1. `model/course.json`: modules, screens (`loIds`, `claimIds`, `graded`), objectives, glossary, references, visuals.
2. Upstream artifacts when present in the course folder: `design/instructional-design.json` (objectives, dispositions, module content points), `research/claims.jsonl`. For an imported course without upstream artifacts, judge against the course's own stated objectives and scope.
3. `review/functional-tests.json` for screens that failed to render (content that exists in the model but not for learners).

## Checks

- [ ] **Evidence gap (course → evidence).** Learner-facing claims with inadequate support or missing qualifications; statements broader than their claims.
- [ ] **Instructional gap (evidence and design → course).** Core design content points, core claims, planned misconceptions and scenarios that never reached a screen.
- [ ] **Orphan objectives.** Objectives no screen teaches.
- [ ] **Unassessed objectives.** Objectives with fewer than two graded items, or with graded items that do not reach the objective's level.
- [ ] **Untaught assessment content.** Graded items that require knowledge no earlier screen teaches.
- [ ] **Weak transfer.** Objectives about decisions or escalation that are only ever tested by recall, with no scenario or application.
- [ ] **Unnecessary duplication.** The same teaching repeated across modules without spaced-review purpose.
- [ ] **Glossary and reference gaps.** Terms and acronyms used before definition or never defined; cited sources missing from the reference library; references never cited.
- [ ] **Scope and boundary statements.** The course states what it does not qualify learners to do, and escalation boundaries appear where decisions are taught.

Evidence names the objective, claim, design point or screen IDs involved.

## Severity calibration

- `critical`: an objective untaught or unassessed; graded items on untaught content; a core safety or legal point from the design missing.
- `major`: evidence gaps on substantive statements; weak transfer for a decision objective; missing scope boundary.
- `minor`: glossary or reference gaps; duplication.
- `style`: not applicable.

## Not your job

Correctness of what is present (factual-currentness), item wording (assessment-engine), teaching quality (instructional-final). Validators already flag orphan and unassessed objectives by ID; you judge genuine coverage and level.

## Categories

`completeness`
