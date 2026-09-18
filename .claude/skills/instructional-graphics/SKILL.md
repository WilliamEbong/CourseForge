---
name: instructional-graphics
description: Specifying instructional visuals as CourseForge VisualSpecs (when each of the 22 archetypes fits, which content fields to fill, label discipline, and writing genuine text equivalents). Used by storyboard authoring, visual direction, visual repair and visual reviewers.
disable-model-invocation: true
---

# Instructional graphics

## When a visual earns its place

Use a figure when the idea is structural: order, cycle, branching, hierarchy, layers, comparison across dimensions, relationships, magnitude. Use prose for argument, nuance and exceptions. Never add a figure for decoration or to restate a three-item list as boxes.

Every VisualSpec states its `purpose` as the instructional job ("shows that controls act at different points between the hazard and the worker"), and its content does that job.

## Archetypes and content fields

Content fields: `items` (id, label, detail, group, value), `links` (from, to, label), `groups` (id, label), `columns` and `rows` (label, cells), `axes` (x, y), `chartType`. Fill what the archetype uses; leave the rest empty or null.

| Archetype | Fits when | Fill |
|---|---|---|
| `PROCESS` | linear steps, start to finish | items in order; links optional (order implied) |
| `LIFECYCLE` | stages that repeat | items in order; a link from last to first |
| `FEEDBACK_LOOP` | an output feeds back to change an input | items; links forming the loop, labelled with the effect |
| `TIMELINE` | events placed in time | items with labels and dates in detail; value may hold a year |
| `SEQUENCE` | hand-offs or messages between parties over time | groups = parties; items = messages with group = sender; links sender→receiver in order |
| `STATE_DIAGRAM` | states and transitions triggered by events | items = states; links = transitions labelled by event |
| `DECISION_TREE` | yes/no or multi-way questions leading to outcomes | items = questions and outcomes; links labelled with the answer |
| `SCENARIO_MAP` | a case's decision points and consequences | items = situations, choices and outcomes; links labelled by choice |
| `HIERARCHY` | parent-child levels, priority order | items; links parent→child |
| `LAYERED_SYSTEM` | stacked layers, each depending on or protecting the next | items in order from outermost to innermost (or top to bottom) with detail |
| `SYSTEM_ARCHITECTURE` | components and their connections | items = components, groups = subsystems, links = connections |
| `RELATIONSHIP_NETWORK` | many-to-many relationships | items = nodes, links = relationships (labelled) |
| `RESPONSIBILITY_MAP` | who owns which duties | groups = parties; items = duties with group = owner; or columns = parties, rows = duties |
| `COMPARISON` | two or three options on shared attributes | columns = options; rows = attributes with cells per option |
| `MATRIX` | two dimensions crossed | columns = one dimension; rows = the other; cells = the intersection |
| `BEFORE_AFTER` | one situation in two states | groups `before` and `after`; items assigned to each |
| `CAUSE_EFFECT` | causes and contributing factors leading to an effect | items = causes (group = category) and the effect; links cause→effect |
| `CONTINUUM` | positions along one scale | items ordered from one pole to the other; axes.x names the scale |
| `FUNNEL` | progressive narrowing | items in order from widest to narrowest; value optional |
| `EVIDENCE_MAP` | claims or questions and the strength of evidence for each | items = claims with group = evidence level; groups = levels |
| `LABELED_OBJECT` | parts of one object | items = parts with detail; the object named in title |
| `QUANTITATIVE_CHART` | sourced numbers to compare or trend | items with numeric value (group for series); axes with units; chartType |

Tie-breakers: a process that loops is a lifecycle; any branching is a decision tree; more than three options or more than one comparison dimension is a matrix; only sourced numbers justify a chart.

## Label discipline

- Labels are learner-facing words, 2–5 words, ideally under 30 characters. Put explanation in `detail`.
- Use the course's defined terms exactly; the same concept has the same label in every figure.
- Keep counts legible: about 7 steps, 4 columns, 6 rows, 12 nodes. Split or group beyond that.
- Qualifications that change meaning must survive. If a label cannot carry "where reasonably practicable", the detail and text equivalent must.

## Text equivalents

- `short`: one sentence naming what the figure shows and its type: "Cycle of five CAPA stages, from detecting a problem to checking effectiveness."
- `long`: the complete meaning, so a learner who never sees the figure learns the same thing. Write it as a list or prose that includes every item, the order or relationships, groupings, and the takeaway. For matrices and comparisons, go row by row. For decision trees, state each question and where each answer leads.
- Describe content, not appearance. No "image of", "diagram showing boxes", "Alt text:", "Create an original…", "as shown above". Code rejects obvious authoring instructions; write so it never has to.

## Colour, emphasis and interaction

Meaning never depends on colour alone: groups have labels, emphasis comes from order and text. `interaction: reveal` only when progressive disclosure genuinely helps and the revealed text is also in the long equivalent. `interactive-data` only for real datasets where exploration serves the objective.

## Originality and rights

Draw original figures from the content. Never reproduce protected figures, regulator pictograms, standards diagrams or logos; describe the concept in your own structure and cite the source.

## Fixing figures that fail to render

Shorten labels first, then reduce or group items, then remove links that restate obvious order. Keep the purpose, sources and archetype, and update the text equivalent to match.
