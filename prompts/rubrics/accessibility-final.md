# Rubric: accessibility-final

**Stage:** COURSE_QA. **Lens:** does the built course meet WCAG 2.2 AA in practice for keyboard, screen-reader, low-vision and reduced-motion users?

## Read

1. `review/accessibility-review.json`: axe violations per screen and viewport, `totals`.
2. `review/functional-tests.json`: `keyboard` (ok, focusVisible, detail).
3. Screenshots (via the manifest) of screens with violations and of interaction screens, to check focus indicators, text size and contrast in context.
4. `model/course.json` for visuals' text equivalents and interaction modes. Grep `build/index.html` for specific markup (aria attributes, dialog elements, live regions) when diagnosing.
5. The accessibility-review skill.

## Checks

- [ ] **Axe results.** Group violations by rule and root cause (one component defect usually shows on many screens); serious and critical impacts block release.
- [ ] **Keyboard.** Every control, every interaction mode (including matching, categorisation and sequencing) and every dialog is operable by keyboard alone; tab order follows reading order; no keyboard traps.
- [ ] **Focus.** Focus is visible on every control and not hidden behind sticky headers; on screen change, focus moves to the new screen heading; dialogs trap focus while open and restore it on close.
- [ ] **Announcements.** One polite status region announces feedback and screen changes; the whole screen container is not a live region.
- [ ] **Semantics.** One `h1` per screen, logical heading levels, real buttons and inputs, labelled form controls, lists as lists, tables with headers, meaningful link text.
- [ ] **Visuals.** Every figure has `role="img"` with a title and a reachable long description conveying its meaning; no colour-only meaning in figures or feedback states.
- [ ] **Text and zoom.** Text resizes to 200% and reflows at 320 CSS pixels without loss; minimum target size 24 by 24 CSS pixels.
- [ ] **Motion.** Reduced-motion preference respected; nothing flashes.
- [ ] **Imported-course defects.** Alt text containing authoring instructions, `aria-live` on the screen host, missing focus styles, drawers without focus management.

## Severity calibration

- `blocker`: the course cannot be navigated or completed by keyboard.
- `critical`: axe serious or critical violations; an interaction mode not keyboard-operable; a focus trap; a figure with no text equivalent.
- `major`: focus not moved on screen change; invisible focus on some controls; whole-screen live region; heading structure broken.
- `minor`: redundant ARIA; minor landmark issues.
- `style`: not applicable.

## Not your job

Visual polish (ui), content correctness. Report each root cause once with all affected screens in `evidence`.

## Categories

`accessibility`
