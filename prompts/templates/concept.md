# Task: normalise a course concept into a scoped concept brief

Course `{{courseId}}`, working title "{{courseTitle}}". Stage `{{stage}}`, cycle {{cycle}}.
Manifest values known so far (may be defaults or blank at this stage): audience "{{audience}}", language `{{language}}`, jurisdiction "{{jurisdiction}}", target duration {{durationMinutes}} minutes, risk tier `{{riskTier}}`.

Human instructions: {{instructions}}
Locked IDs: {{locks}}

## What to do

1. Read the concept request and any attached notes listed under Inputs. Treat them as the requester's intent, not as verified facts.
2. Produce a concept brief that a research planner can act on without re-reading the request. Be concrete; one precise sentence beats three vague ones.
3. Separate what the requester said from what you are assuming. Every assumption goes in `assumptions`, never silently into another field.

## The author's own documents

If `input/source-material.md` is listed under Inputs, it holds documents the author supplied (their policies, procedures, notes or reference material), one section per document. Use them to understand the intended subject, audience, scope and organisational context. When they conflict with the request, follow the request and record the conflict in `assumptions`.

## Field guidance

- `title`: a learner-facing course title. Keep the requester's title unless it is misleading or ambiguous; if you change it, record why in `assumptions`.
- `summary`: 2–4 sentences: what the course teaches, to whom, to what depth, and what it will not do.
- `audience`: role, context and prior knowledge ("new laboratory coordinators with general workplace literacy, no chemistry training"), not demographics.
- `prerequisites`: knowledge learners must already have. Empty if none.
- `targetDurationMinutes`: the requested duration; if absent, estimate from the goals (a focused awareness course is usually 45–90 minutes) and record the estimate as an assumption.
- `language`: BCP-47 tag (`en`, `en-CA`, `fr`).
- `jurisdiction`: set only when the request names one or the subject is inherently jurisdiction-bound and the jurisdiction is obvious from the request. If the subject depends on law or regulation and no jurisdiction was given, set `null`, add a `gaps` entry, and add a high-stakes assumption stating what the research should assume meanwhile.
- `riskTier` and `riskRationale`: see the rules below. The rationale names the specific feature of the subject that drove the tier.
- `domains`: 2–6 short subject-area labels (e.g. `occupational health and safety`, `quality management`).
- `learningGoals`: 3–6 plain statements of what learners should be able to do afterwards. These are goals, not final objectives; the design stage writes measurable objectives later.
- `assumptions`: `{text, highStakes}`. Set `highStakes: true` when a wrong guess could make the course legally wrong, unsafe, clinically misleading, or aimed at the wrong audience or jurisdiction. High-stakes assumptions send the concept to a human gate. That is intended; never downgrade an assumption to avoid the gate.
- `gaps`: information the requester should supply or confirm (jurisdiction, audience, depth, certification expectations, organisation-specific procedures).
- `outOfScope`: explicit exclusions, including safety boundaries ("does not teach spill clean-up procedures", "not a substitute for regulator-approved certification").

## Risk-tier rules (classify conservatively)

- `high_stakes`: health, clinical or medical practice, workplace or public safety, hazardous materials or processes, legal or regulatory compliance, financial decisions or advice, the security of people or critical systems. If learners could plausibly use the course to make such decisions, it is high stakes even when the request calls it "awareness" or "introductory".
- `elevated`: professional practice with material consequences but no direct safety, legal, clinical or financial exposure (for example project governance, research-data handling basics).
- `standard`: everything else.
- When torn between two tiers, choose the higher one and say why in `riskRationale`.

## Boundaries

- Make no factual claims about the domain beyond what the request states; research comes later.
- Never promise certification, licensure, legal advice or professional authorisation. If the request implies it, add an `outOfScope` entry and a `gaps` entry asking the requester to confirm.
- If human instructions conflict with these rules, follow the instructions unless they would remove a safety boundary. In that case keep the boundary and record the conflict in `gaps`.
