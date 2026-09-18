# Rubric: visual-consistency

**Stage:** COURSE_QA. **Lens:** does the course look like one designed system from first screen to last, and do the figures belong to it?

## Read

1. Screenshots via the manifest: compare the same component type across modules (content screens, callouts, figures, items, feedback, results) at 1440 and 390 widths.
2. `model/course.json`: `theme`, visuals and their archetypes; `build/build-report.json` if present (renderer and fallback per visual).
3. `visual/design-brief.md` if present, for the intended rules.
4. The ui-review and instructional-graphics skills.

## Checks

- [ ] **Component consistency.** The same block kind renders with the same component, spacing, heading treatment and icon everywhere.
- [ ] **Callout semantics.** Law, guidance, evidence, warning and misconception callouts are consistently distinguished and never swapped.
- [ ] **Figure family.** Figures share typography, stroke weight, palette usage, label placement and direction of flow; a figure that fell back to a different renderer or to a text equivalent still fits (check the build report for `fallbackUsed`).
- [ ] **Same concept, same depiction.** A process or model that appears in several figures uses the same labels and order.
- [ ] **Icons.** Consistent icon set and meaning; no icon used for two meanings.
- [ ] **Feedback states.** Correct, incorrect and neutral states look the same in formative and graded contexts.
- [ ] **Brief adherence.** Density, corner style, type scale and figure style match the chosen direction.
- [ ] **Imported courses.** Flag figures that are not real graphics (text in CSS boxes posing as diagrams) and styles that vary screen by screen.

## Severity calibration

- `major`: callouts with swapped or inconsistent semantics; figures in visibly different styles; a fallback figure that breaks the design.
- `minor`: inconsistent icon use; small spacing differences between instances of a component.
- `style`: preferences.
- Consistency issues are rarely critical; they become critical only when inconsistency changes meaning (for example a warning styled as neutral information).

## Not your job

Individual screen composition (ui), flow (ux).

## Categories

`visual`, `consistency`
