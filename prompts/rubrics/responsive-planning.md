# Rubric: responsive-planning

**Stage:** VISUAL_DIRECTION. **Lens:** will this course work at 1440, 768 and 375–390 pixel widths, before anything is built?

## Read

1. `visual/component-plan.json` and `visual/design-tokens.json` (density, type scale, spacing).
2. `visual/visual-specs.json`: figure sizes, item counts, table and matrix dimensions.
3. The storyboard: long option lists, matching and categorisation items, wide comparisons.
4. The design brief's responsive section.

## Checks

- [ ] **Wide content.** Matrices, comparison tables and multi-column visuals have a narrow-screen plan (stacking, row-by-row cards, horizontal scroll confined to the figure with a visible cue); the page itself must never scroll horizontally.
- [ ] **Figures on phones.** Diagrams with many items or long labels have a vertical layout or simplified variant; text inside figures stays at a legible size.
- [ ] **Interactions on touch and small screens.** Matching and categorisation use select or button controls that fit a phone; sequencing uses move controls with adequate target sizes (at least 24 by 24 CSS pixels, ideally 44).
- [ ] **Navigation.** The component plan provides a compact menu and visible progress on small screens; controls do not overlap content.
- [ ] **Line length and spacing.** Desktop line length stays readable (roughly 60–80 characters); mobile spacing is not so compact that targets collide.
- [ ] **Dialogs and panels.** Glossary, references and citation panels are usable on a phone (full-height dialog, reachable close control).
- [ ] **Brief coverage.** The design brief states what changes at tablet and phone widths.

## Severity calibration

- `critical`: an interaction type planned in a way that cannot be completed on a phone.
- `major`: a wide matrix or table with no narrow-screen plan; figures that will be illegible on mobile; no compact navigation plan.
- `minor`: tight spacing; missing tablet-specific notes.
- `style`: layout preferences.

## Not your job

Theme choice (visual-ui), text equivalents (accessibility-visual). Real overflow is measured in QA; here you judge the plan.

## Categories

`ui`, `ux`, `accessibility`
