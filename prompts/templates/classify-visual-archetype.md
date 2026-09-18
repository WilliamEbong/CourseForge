# Task: classify the archetype of visual `{{subject}}`

Course `{{courseId}}`, "{{courseTitle}}". Stage `{{stage}}`.
Human instructions: {{instructions}}

The visual's description, content and surrounding block text:

```json
{{extra}}
```

## Your job

Choose the one archetype that matches the structure of the idea the visual must teach. CourseForge maps the archetype to a renderer and layout deterministically, so choose by structure, not by what the source text calls it ("process" in prose is often a lifecycle or a decision tree).

## Archetypes

- `PROCESS`: linear steps from start to end.
- `LIFECYCLE`: stages that return to the start (a repeating cycle).
- `FEEDBACK_LOOP`: an output that influences its own input (monitoring and correction, reinforcement).
- `TIMELINE`: events placed by date or time.
- `SEQUENCE`: messages or hand-offs between named parties over time.
- `STATE_DIAGRAM`: states and the events that move something between them.
- `DECISION_TREE`: questions with branches leading to different outcomes.
- `SCENARIO_MAP`: a scenario's decision points and consequences as a path through a case.
- `HIERARCHY`: parent-child levels (organisation, classification, priority order).
- `LAYERED_SYSTEM`: stacked layers where each depends on or protects the one beneath.
- `SYSTEM_ARCHITECTURE`: components of a system and their connections.
- `RELATIONSHIP_NETWORK`: many-to-many relationships without a single direction or level.
- `RESPONSIBILITY_MAP`: parties and which duties or decisions each owns.
- `COMPARISON`: two or three options compared on shared attributes.
- `MATRIX`: two dimensions crossed into a grid (likelihood by consequence, option by criterion).
- `BEFORE_AFTER`: one situation shown in two states.
- `CAUSE_EFFECT`: causes and contributing factors leading to an effect.
- `CONTINUUM`: positions along a single scale between two poles.
- `FUNNEL`: progressive narrowing through filters or stages.
- `EVIDENCE_MAP`: claims or questions linked to the strength or type of supporting evidence.
- `LABELED_OBJECT`: parts of one physical or visual object, labelled.
- `QUANTITATIVE_CHART`: numeric values that must be compared or shown as a trend.

Tie-breakers: repeating stages → `LIFECYCLE`, not `PROCESS`; branches → `DECISION_TREE`; more than three compared options or more than one comparison dimension → `MATRIX`; real numbers from a source → `QUANTITATIVE_CHART`, otherwise never a chart.

## Output

- `value`: one archetype.
- `confidence`: `high` when the structure clearly matches; `medium` when two archetypes could work and one is better; `low` when the description is too vague to tell.
- `evidence`: 2–4 short quotes or observations from the description or content that show the structure (for example "step 5 returns to step 1").
