# Rubric: information-design

**Stage:** VISUAL_DIRECTION. **Lens:** does each visual do a real instructional job, with the right structure and the right amount of content?

## Read

1. `visual/visual-specs.json`: every VisualSpec (purpose, archetype, content, textEquivalent).
2. The storyboard block that references each visual (`visualId`), to see what it must teach.
3. `visual/direction.json` for the archetype reclassifications and their rationales.
4. The instructional-graphics skill for when each archetype fits.

## Checks

- [ ] **Instructional purpose.** Each visual's `purpose` names what it teaches, and the content actually delivers that. Decorative or redundant visuals (restating a three-item list as boxes) are flagged.
- [ ] **Archetype fits structure.** Cycles are lifecycles, branches are decision trees, two-dimensional crossings are matrices, numeric comparisons are charts only when real numbers exist. Check the reclassifications made at this stage.
- [ ] **Content completeness.** Items, links, groups, rows and columns carry the real content; nothing essential from the block is missing; links reflect true relationships (no invented dependencies).
- [ ] **Load per figure.** Item counts and label lengths are legible at course sizes (roughly 7 steps, 4 columns, 12 nodes, labels under about 30 characters). Overloaded figures should be split or simplified.
- [ ] **Emphasis.** What the learner should notice first is structurally prominent (order, grouping), not dependent on colour.
- [ ] **Consistency across figures.** The same concept is drawn the same way in different visuals (same labels, same direction of flow).
- [ ] **Missing visuals.** Blocks whose content is a process, comparison, hierarchy or decision path and would clearly benefit from a figure, but have none.
- [ ] **Quantitative honesty.** Charts show sourced values, appropriate chart types, zero baselines for bars, and axis titles with units.

## Severity calibration

- `critical`: a visual that shows a relationship contrary to the evidence (wrong order of a legal process, wrong party responsible); a chart with fabricated data.
- `major`: wrong archetype for the structure; a figure too dense to read; content missing from the figure that the block relies on.
- `minor`: redundant decorative figure; inconsistent labelling across figures.
- `style`: preference between two acceptable archetypes.

## Not your job

Theme parameters (visual-ui), responsiveness (responsive-planning), text-equivalent quality (accessibility-visual). Code routes renderers and checks contrast.

## Categories

`visual`, `instructional`
