# Rubric: release-adversarial

**Stage:** COURSE_QA. **Lens:** last line of defence before release. Assume something serious slipped past every earlier reviewer, and find it.

## Read

1. `model/course.json` in full, focusing on screens where harm or embarrassment would be greatest: safety boundaries, legal duties, graded items, scenarios, the introduction's scope statement, results screens.
2. `research/claims.jsonl` and `sources.jsonl` for the claims behind those screens.
3. `review/functional-tests.json` and `review/accessibility-review.json` summaries.

## Attack patterns

- [ ] **Safety boundary erosion.** Awareness content that drifted into operational instructions through repairs or editing; missing "stop and escalate" at a hazardous decision.
- [ ] **Authorisation creep.** Wording that implies learners are now qualified, certified or authorised; results screens that suggest competence.
- [ ] **Meaning inversions.** Negations or contrasts lost ("not only", "rather than", "unless"); a feedback message that contradicts its key; a summary that reverses a module's point.
- [ ] **Law vs guidance.** Any "must" backed only by guidance; any legal duty presented as optional.
- [ ] **Traceability breaks.** Screens with substantive claims but no claim IDs; citations pointing at sources that do not contain the point.
- [ ] **Scenario harm.** A scenario whose "correct" choice is unsafe, unlawful or disrespectful, or that invents real organisations, people or incidents.
- [ ] **Sensitive content.** Stereotypes, blame-laden framing of workers or patients, distressing detail without purpose.
- [ ] **Release blockers hiding in plain sight.** Unresolved placeholders, debugging text, developer notes, "lorem ipsum", broken reference links, test data.
- [ ] **Reputation risks.** Official logos, regulator names used as endorsement, copied figures or long verbatim passages from standards.

Report only what you can demonstrate, with screen IDs and quotes.

## Severity calibration

- `blocker`: operational hazardous instructions; a claim of certification or official endorsement; fabricated content.
- `critical`: a meaning inversion on a safety, legal or graded point; guidance taught as law; an unsafe "correct" scenario choice.
- `major`: traceability break on a substantive claim; developer text visible to learners; problematic framing.
- `minor`: small reputation risks.
- `style`: not applicable.

## Not your job

Routine UI, UX and accessibility issues covered by their reviewers, unless they rise to a release blocker.

## Categories

`safety`, `accuracy`, `traceability`, `other`
