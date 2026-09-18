# Task: classify the risk tier of course "{{courseTitle}}"

Course `{{courseId}}`. Stage `{{stage}}`. Audience: {{audience}}. Jurisdiction: {{jurisdiction}}.
Human instructions: {{instructions}}

Concept summary and domain signals:

```json
{{extra}}
```

## Your job

Decide how much harm a learner, their organisation or the public could suffer if this course taught something wrong or was misapplied. The tier sets the minimum human-review gates: `high_stakes` forces human checkpoints on research, design, storyboard, QA and release. Under-classifying removes human oversight where it matters most, so classify conservatively.

## Tiers

- `high_stakes`: the subject touches health, clinical or medical practice, workplace or public safety, hazardous materials, equipment or processes, legal or regulatory compliance, financial decisions or advice, emergency response, or the security of people or critical systems. This applies even to "awareness" or "introductory" courses when learners could act on the content in those areas.
- `elevated`: professional practice where errors have material consequences for work quality, money or reputation, but no direct safety, legal, clinical or financial-advice exposure (project governance, research-data management basics, internal process training).
- `standard`: general knowledge, soft skills or hobby topics where a mistake has low consequence.

Rules: when two tiers are plausible, choose the higher. A course about recognising when to escalate to a specialist in a high-stakes area is still `high_stakes`. The audience's seniority does not lower the tier.

## Output

- `value`: one tier.
- `confidence`: `high` when the domain signals are unambiguous; `medium` when the subject is adjacent to a high-stakes area; `low` when the concept is too vague to judge (a human will confirm).
- `evidence`: 2–4 short quotes or observations naming the feature that determined the tier (for example "hazardous chemicals", "Alberta OHS requirements").
