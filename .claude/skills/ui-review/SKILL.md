---
name: ui-review
description: Visual UI review of course screens from screenshots (hierarchy, typography, spacing, density, alignment, controls, clipping, figure legibility, responsive layouts, consistency). Use when reviewing the look of a CourseForge course or design plan.
---

# UI review

## How to look at screenshots

Review the same screen type side by side at 1440, 768 and 390 pixel widths, then compare the same component across modules. Squint test: blur your attention and ask what stands out first. It should be the screen title and then the primary content or question, not decoration or navigation chrome.

## Criteria

**Hierarchy**
- One clear focal point; heading levels visibly distinct; the primary action is the most prominent control.
- Callouts (law, guidance, warning, misconception) are distinguishable and subordinate to the main text.

**Typography**
- Body line length roughly 60–80 characters on desktop, 35–50 on phones.
- Line height comfortable for body text (around 1.5); headings tighter.
- Consistent sizes and weights for the same role; no more than a few sizes in use.
- No awkward breaks: single-word last lines in headings, hyphenated labels in buttons, text squeezed against borders.

**Spacing and rhythm**
- A consistent spacing scale; more space between sections than within them.
- Related elements grouped (question, options, feedback); unrelated ones separated.
- No cramped clusters or elements floating without alignment.

**Density**
- Screens neither walls of text nor mostly empty. Dense content is broken into scannable parts: lists, sub-headings, figures, disclosure for optional depth.

**Alignment and layout**
- Shared edges and a consistent content column; figures and callouts align with it.
- Nothing overlaps; nothing clipped; no horizontal page scrolling.

**Controls and states**
- Interactive elements look interactive; consistent button styles; adequate target size.
- Selected, correct, incorrect, disabled and focus states are distinct and not colour-only.

**Figures**
- Labels readable at each width; no text overlapping shapes or other text; consistent style with the course; figures scale down or switch to a vertical layout on phones.

**Responsive design**
- Tablet and phone layouts designed, not just shrunk: navigation collapses to an accessible menu, progress remains visible, tables and matrices adapt, controls remain reachable.

## Reporting

- Location: screen ID, or a CSS selector for shell-wide issues.
- Evidence: screenshot file names and a precise description of what is visible ("GA-04 at 390 px: option D label clipped after 'where reasonably'").
- Group by root cause (one component defect across many screens is one finding).
- Severity: unusable content or controls at a viewport → critical; broken hierarchy on a common screen type, illegible figures → major; spacing inconsistencies, single awkward wraps → minor; taste → style.
