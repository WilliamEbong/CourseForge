---
name: accessibility-review
description: WCAG 2.2 AA review essentials for e-learning (keyboard-operable interactions including matching and sequencing, focus management, announcements, text equivalents, no colour-only meaning, reduced motion, reflow). Use when planning or reviewing accessibility of course content, visuals or built HTML.
---

# Accessibility review for e-learning

Target: WCAG 2.2 level AA, applied to a single-page course with interactions and assessments.

## Keyboard

- Every control reachable with Tab and Shift+Tab in reading order; activated with Enter or Space; composite widgets (radio groups, listboxes) use arrow keys as conventional.
- No keyboard traps, except a modal dialog that deliberately contains focus while open and releases it on close (Escape closes).
- Interaction modes:
  - single choice: native radio group;
  - multiple response: native checkboxes;
  - matching: a select (or listbox) per prompt, choosing its match;
  - categorisation: a select per item, or category buttons per item;
  - sequencing: move-up and move-down buttons per step (or a select for position), with the new position announced;
  - reveal: a real button with `aria-expanded`.
- Drag and drop may exist only as an enhancement over one of the above.

## Focus

- Visible focus indicator on every interactive element, with sufficient contrast, not hidden under sticky headers or clipped (WCAG 2.2 focus not obscured).
- On screen change, move focus to the new screen's heading (`h1` with `tabindex="-1"`).
- Opening a dialog moves focus into it; closing restores focus to the control that opened it.
- After submitting an answer, focus stays near the question and the feedback is announced.

## Announcements

- One persistent polite status region for feedback and screen-change messages; announce the message, not the whole screen.
- Never put `aria-live` on the screen container.
- Errors and validation messages are associated with their controls.

## Semantics and structure

- One `h1` per screen; heading levels in order; landmarks for header, navigation and main.
- Native elements first (button, a, input, select, dialog, table); ARIA only to fill gaps, never to override correct native semantics.
- Form controls have visible labels; groups have legends (the question stem as a fieldset legend).
- Tables have header cells; lists are lists; link text makes sense out of context.
- `lang` set on the document and on passages in another language.

## Non-text content

- Figures: `role="img"` with an accessible name and a linked long description conveying the full meaning; decorative images hidden from assistive technology.
- Text equivalents describe content, never authoring instructions or appearance.
- Essential information is never only in an image, only in colour, only on hover, or only in position ("the box on the right").

## Colour, contrast and motion

- Text contrast at least 4.5:1 (3:1 for large text); UI component and focus indicator contrast at least 3:1. (CourseForge computes token contrast; reviewers check real screens.)
- Correct, incorrect and selected states use text and icon as well as colour.
- Respect `prefers-reduced-motion`; no information carried by animation; nothing flashes more than three times a second.

## Reflow, zoom and targets

- Content reflows at 320 CSS pixels wide without horizontal page scrolling (tables and figures may scroll within their own container with a visible cue).
- Text resizes to 200% without loss.
- Target size at least 24 by 24 CSS pixels (44 recommended for touch).

## Time and cognition

- No time limits on reading or answering.
- Clear instructions before interactions; consistent navigation; ability to review and change answers before submitting a graded assessment.
- Plain language, defined terms and expanded acronyms support cognitive accessibility.

## Reporting

Report each root cause once, listing affected screens or blocks. Map severity: cannot complete by keyboard → blocker; an interaction mode or dialog inoperable, axe serious or critical, missing text equivalent for an essential figure → critical; focus management, whole-screen live regions, colour-only states → major; minor semantic issues → minor.
