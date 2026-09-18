# Rubric: visual-ui

**Stage:** VISUAL_DIRECTION. **Lens:** is the chosen visual language appropriate, coherent and professional for this subject and audience?

## Read

1. `visual/direction.json`: family, accentHue, density, corner, typeScale, figureStyle, rationale, and the design brief.
2. `visual/design-tokens.json` and `visual/component-plan.json`, to see what the parameters expand into.
3. The storyboard, to understand the tone, amount of text and interaction density.

## Checks

- [ ] **Family fit.** The family's register suits the subject's seriousness and the audience's setting (a clinical or safety course is not styled as a playful tech product).
- [ ] **Accent hue.** The accent does not compete with warning, error and success semantics; for safety subjects it is not in the red-orange range used for alerts.
- [ ] **Density and type scale.** Match the audience and reading load: novices and reading-heavy courses need comfortable density and default or generous type.
- [ ] **Figure style.** Line or filled suits the diagram mix (line for dense technical diagrams, filled where regions and grouping carry meaning).
- [ ] **Brief quality.** The design brief is specific to this course: it explains hierarchy, how law, guidance and evidence callouts are distinguished, diagram conventions, feedback states, motion and icon policy. Generic boilerplate is a finding.
- [ ] **Component plan.** Components chosen for each block kind are the right ones (evidence callout for law and guidance statements, warning callout for safety boundaries, comparison for comparisons); nothing essential is rendered as plain text where a component exists.
- [ ] **Coherence.** One visual system across the course: consistent callout semantics, consistent figure style, consistent icon use.
- [ ] **Restraint.** No decorative imagery, gratuitous icons or motion.

## Severity calibration

- `major`: a family or accent that undermines credibility or safety semantics; a brief too generic to guide build decisions; components mismatched to content kinds across a module.
- `minor`: density or type scale slightly off for the audience; brief missing one heading.
- `style`: preference between acceptable hues or corner styles.
- This lens rarely produces critical findings; a choice that makes warning states indistinguishable would be critical.

## Not your job

Contrast ratios (computed and clamped by code), responsive behaviour (responsive-planning), individual figures (information-design).

## Categories

`ui`, `visual`
