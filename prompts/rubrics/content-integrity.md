# Rubric: content-integrity

**Stage:** VISUAL_DIRECTION. **Lens:** do the visuals, and any content touched while planning them, still say exactly what the approved storyboard and evidence say?

## Read

1. `visual/visual-specs.json` and the reclassifications in `visual/direction.json`.
2. `storyboard/storyboard-edited.json`: the blocks that reference each visual and the claims they cite.
3. The claims behind each visual's `sourceIds` when a figure states facts.

## Checks

- [ ] **Figure matches block.** Every label, order, grouping and link in a figure agrees with the block text it illustrates. No step added, dropped or reordered; no party given a duty it does not have.
- [ ] **Figure matches evidence.** Facts shown in a figure are supported by its `sourceIds`; numbers match the cited source.
- [ ] **Qualifications survive simplification.** Short labels have not dropped a condition that changes meaning ("must" vs "should"; "listed substances" vs "all substances"); where a label cannot carry it, the text equivalent and block do.
- [ ] **Reclassification preserved content.** Where visual direction changed an archetype, the content still represents the same relationships.
- [ ] **Traceability.** Every visual is referenced by a block; every block `visualId` resolves; `sourceIds` are present for factual figures.
- [ ] **Text equivalent accuracy.** The long equivalent says the same thing as the figure and the block, with no additions.
- [ ] **No invented data.** Quantitative charts show only sourced values.

Evidence: visual ID, the item or link, the block text or claim it contradicts.

## Severity calibration

- `critical`: a figure contradicting its block or evidence on a legal, safety or core point; fabricated data.
- `major`: a dropped qualifier in a label that changes meaning; reordered process steps; unreferenced or dangling visual.
- `minor`: label wording that differs from block terminology without changing meaning.
- `style`: not applicable.

## Not your job

Whether a figure is well designed (information-design) or accessible (accessibility-visual). Code checks that visual and source IDs resolve.

## Categories

`accuracy`, `consistency`, `traceability`
