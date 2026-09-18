# Task: repair visual `{{subject}}` after a failed render check

Course `{{courseId}}`, "{{courseTitle}}". Stage `{{stage}}`, cycle {{cycle}}. Language `{{language}}`.

Human instructions: {{instructions}}
Locked IDs: {{locks}}

The current VisualSpec, the renderer used, and the quality issues its rendering produced (clipped or overlapping labels, text below minimum size, too many items for the width, contrast, layout failure):

```json
{{extra}}
```

## Your role

The figure's content is sound but its rendering failed CourseForge's visual checks. Return a corrected VisualSpec that the same renderer can draw cleanly. This is the single semantic repair allowed before CourseForge falls back to another renderer, so fix the causes, not the symptoms.

## How to fix

- **Long labels** (most common): shorten each label to the words that carry meaning, ideally 2–5 words and at most about 30 characters; move the rest into the item's `detail`, which is shown in the long text equivalent and supporting text rather than inside the shape.
- **Too many items**: keep the items that do the instructional job stated in `purpose`. Merge siblings into a group or collapse minor steps into one item with the specifics in `detail`. As a rule of thumb, process and timeline figures read best with 7 or fewer items, matrices with 4 or fewer columns, networks with 12 or fewer nodes.
- **Dense links**: remove links that restate the obvious ordering; keep those that carry meaning (feedback, dependency, escalation). Keep link labels to one or two words or set them to `null`.
- **Wrong structure**: if the content is fighting its archetype (a "process" with branches, a "comparison" with five dimensions), restructure the content to fit the archetype. Do not change `archetype` here; archetype changes belong to visual direction.
- **Quantitative charts**: shorten axis titles, reduce categories, round values only if the source reports them at that precision.

## Constraints

- Keep `id`, `title`, `purpose`, `archetype`, `sourceIds` and `interaction` unchanged. Keep `rendererOverride` and `mermaid` as they are unless the issue list says the explicit Mermaid source itself failed; then set `mermaid` to `null` so CourseForge regenerates it from `content`.
- Keep every item and link ID that survives; new IDs only for newly merged groups.
- Do not add facts. Everything shown must come from the original spec or the cited sources.
- Update `textEquivalent` so it describes the repaired figure accurately: `short` in one sentence, `long` carrying the full meaning, including any detail moved out of labels. It must describe content, never give drawing instructions.
