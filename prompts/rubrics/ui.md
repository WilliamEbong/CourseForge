# Rubric: ui

**Stage:** COURSE_QA. **Lens:** visual quality of the built interface. Does it look professional, readable and well composed at every viewport?

## Read

1. `review/screenshots/manifest.json`, then view screenshots: every module landing screen, one content screen, one figure screen and one item screen per module, at 1440, 768 and 390 widths. View more where you find problems.
2. `review/functional-tests.json` for overflow data per screen.
3. `model/course.json` to map screenshots to screen IDs and components; `visual/design-brief.md` if present, for intended direction.
4. The ui-review skill.

## Checks

- [ ] **Hierarchy.** One obvious focal point per screen; heading sizes distinguish levels; the primary action is visually primary.
- [ ] **Typography.** Comfortable line length (roughly 60–80 characters on desktop), adequate line height, no orphaned single words in headings where avoidable, consistent sizes for the same element.
- [ ] **Spacing and rhythm.** Consistent spacing scale; related items grouped, unrelated items separated; no cramped or floating elements.
- [ ] **Density.** Screens neither walls of text nor mostly empty; long content is broken into scannable parts.
- [ ] **Alignment.** Elements share edges; figures and callouts align with the text column.
- [ ] **Controls.** Buttons and inputs look interactive, have consistent styles and adequate size; disabled states are distinguishable; selected and feedback states are clear.
- [ ] **Clipping and wrapping.** No clipped text, awkward label wrapping inside figures or buttons, overlapping elements, or horizontal scrolling.
- [ ] **Figures.** Diagrams legible at each viewport; labels readable; figure styling matches the course.
- [ ] **Responsive.** Tablet and phone layouts are designed, not just shrunk: navigation collapses sensibly, tables and matrices adapt.

Location = screen ID (or a CSS selector for shell-wide issues). Evidence names the screenshot file(s) and what is visible.

## Severity calibration

- `critical`: content or controls unusable at a viewport (clipped answer options, overlapping navigation hiding content).
- `major`: broken hierarchy on a screen type used throughout; illegible figures on mobile; inconsistent control styling that confuses states.
- `minor`: spacing inconsistencies; one awkward wrap.
- `style`: aesthetic preferences within the design system.

## Not your job

Navigation logic and flow (ux), cross-course consistency of components (visual-consistency), accessibility conformance (accessibility-final). Report each root cause once, listing affected screens.

## Categories

`ui`, `visual`
