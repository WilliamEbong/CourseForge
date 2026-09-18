# Rubric: concept-scope-safety

**Stage:** CONCEPT. **Lens:** is the concept brief a faithful, honestly scoped, safely classified starting point for research?

## Read

1. The original concept request (what the requester actually asked for).
2. The concept brief (`input/concept.json`).

## Checks

- [ ] **Fidelity to the request.** Title, audience, duration, jurisdiction and goals match what the requester said. Anything added is recorded as an assumption, not stated as given.
- [ ] **Silent high-stakes assumptions.** Audience, jurisdiction, regulatory context, professional level or certification expectations that were not in the request appear in `assumptions` with `highStakes: true` when a wrong guess could make the course unsafe, legally wrong or aimed at the wrong people.
- [ ] **Risk tier.** Subjects touching health, clinical practice, safety, hazardous materials, law or regulation, finance or security are `high_stakes`, including "awareness" courses. The rationale names the feature that drove the tier. A lower tier needs a convincing reason.
- [ ] **Jurisdiction.** A jurisdiction-bound subject (law, regulation, licensing) has a jurisdiction, or `null` plus a gap and a high-stakes assumption. A jurisdiction is not invented.
- [ ] **Scope realism.** The learning goals can plausibly be taught in `targetDurationMinutes`. Flag goals that would need a course series, or durations that would force superficial coverage of safety-relevant content.
- [ ] **Out of scope and safety boundaries.** Operational, hazardous or professional-authorisation content is excluded explicitly. The brief never promises certification, licensure or legal advice.
- [ ] **Goals are outcomes.** Learning goals describe what learners will be able to do, not topics to cover.
- [ ] **Gaps are real questions.** Each gap is something a human can answer; nothing essential is missing from the gap list (for example an unclear audience).

## Severity calibration

- `blocker`: the brief would lead research towards hazardous operational instructions, or claims the course confers certification or professional authorisation.
- `critical`: a high-stakes subject classified `standard`; an invented jurisdiction or regulatory regime stated as fact; a high-stakes assumption not marked `highStakes`.
- `major`: learning goals that cannot be met in the duration; missing exclusions for an obviously unsafe adjacent topic; audience materially different from the request.
- `minor`: vague summary, a missing prerequisite, domains too broad.
- `style`: title wording preferences.

## Not your job

Domain facts (none should be asserted yet), research planning (research-brief reviewers), objective wording (design stage).

## Categories

`scope`, `safety`, `completeness`
