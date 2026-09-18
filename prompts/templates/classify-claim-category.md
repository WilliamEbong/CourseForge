# Task: classify the category of claim `{{subject}}`

Course `{{courseId}}`. Stage `{{stage}}`. Jurisdiction: {{jurisdiction}}.
Human instructions: {{instructions}}

The claim, its surrounding text and the sources it cites:

```json
{{extra}}
```

## Your job

Classify what kind of statement this is. The category controls how the claim may be taught: a legal requirement may be stated as a duty, a recommendation may not; a statistic needs its year and population; a currentness claim must be re-checked before release. Classify by what the cited source actually is and says, not by how confidently the sentence is phrased.

## Categories

- `law-regulation`: what a statute, regulation, code or legally binding instrument requires, prohibits or permits.
- `guidance-recommendation`: what government guidance, a regulator's non-binding advice, a voluntary standard, a professional body or a framework recommends. A standard becomes law only where legislation incorporates it; classify as `law-regulation` only if that incorporation is cited.
- `scientific-technical`: how something works or behaves, established by scientific or technical evidence.
- `statistic`: a number describing frequency, rate, magnitude or trend, from a dataset or study.
- `version-currentness`: which edition, version or amendment applies, dates in force, or current status of a document or rule.
- `definition`: what a term means, formally or in the course's usage.
- `scenario-synthesis`: the author's reasoned combination of sources, an illustrative scenario, or an inference not stated directly by any single source.

If a sentence bundles several kinds (a legal duty plus a statistic), classify the part that carries the teaching point and mention the other in evidence.

## Output

- `value`: one category.
- `confidence`: `high` when the source type and wording agree; `medium` when the sentence is ambiguous but the source settles it; `low` when you cannot tell whether the source is binding or whether the claim is synthesis.
- `evidence`: 2–4 short quotes: the modal verb or phrasing ("must", "should", "found that"), the source's type or title, and any incorporation-by-reference.
