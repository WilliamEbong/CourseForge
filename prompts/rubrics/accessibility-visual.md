# Rubric: accessibility-visual

**Stage:** VISUAL_DIRECTION. **Lens:** will the visual system and each figure be perceivable and understandable without sight, without colour and with reduced motion?

## Read

1. `visual/visual-specs.json`: textEquivalent (short and long), content, interaction.
2. `visual/direction.json` and the design brief: feedback states, callouts, motion, icons.
3. `visual/design-tokens.json` for state styling. Contrast ratios are computed by code; you judge meaning.
4. The accessibility-review skill.

## Checks

- [ ] **Text equivalents.** `short` names the figure's subject and type in one sentence. `long` conveys everything the figure teaches: every item, the order or relationships, groupings, and the takeaway. A reader of `long` alone would pass an item about the figure.
- [ ] **Not authoring instructions.** Text equivalents describe content, not how to draw it ("Create a diagram…", "Alt text: …", "Image of boxes…"). Code rejects the obvious patterns; you catch the subtle ones ("Shows the process described above").
- [ ] **No colour-only meaning.** Groups, states and emphasis in figures and UI have a non-colour cue (label, pattern, icon, position plus text).
- [ ] **Feedback states.** Correct, incorrect and partial feedback carry words and an icon, not colour alone.
- [ ] **Motion.** Motion is purposeful and disabled under reduced-motion preference; no information depends on animation.
- [ ] **Reveal visuals.** Figures with `interaction: reveal` expose the hidden content to keyboard and screen readers, with the revealed text also available in the long description.
- [ ] **Icons.** Icons that carry meaning have text labels; decorative icons are marked decorative in the plan.
- [ ] **Callouts.** Law, guidance, warning and misconception callouts are distinguishable by heading text, not styling alone.

## Severity calibration

- `critical`: a figure whose essential meaning is unavailable in text; feedback conveyed by colour only.
- `major`: a `long` equivalent that omits relationships or order; subtle authoring-instruction text; meaningful icons without labels.
- `minor`: a `short` equivalent that is vague; minor motion concerns.
- `style`: phrasing.

## Not your job

Figure content choice (information-design), responsive layout (responsive-planning), numeric contrast (code).

## Categories

`accessibility`, `visual`
