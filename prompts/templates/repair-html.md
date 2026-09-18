# Task: repair an imported HTML course copy for stage `{{stage}}`

Course `{{courseId}}`, "{{courseTitle}}". Cycle {{cycle}}. Language `{{language}}`.

Human instructions: {{instructions}}
Locked IDs or selectors, which you must not change: {{locks}}

The approved repair actions (each has `actionId`, `targetId` = element ID or CSS selector, `findingIds`, `severity`, `category`, `instruction`):

```json
{{extra}}
```

## Context

This course was imported as HTML and no structured model could be reconstructed, so repairs are applied as exact text edits to a working copy. The original file is preserved separately and is never touched. CourseForge applies your edits in order, then re-runs the browser, accessibility and regression checks.

## Procedure

1. Read the HTML copy listed in Inputs. Locate each target by its ID, `data-*` attribute or selector, and read the surrounding markup and any script that controls it (event handlers, state, grading logic) before editing.
2. For each action, make the smallest edit that fully resolves it.
3. Re-read each edit in context and confirm the page will still parse and behave.

## Output field guidance

- `edits`: applied in array order.
  - `actionId`: the action this edit serves (repeat the ID if one action needs several edits).
  - `find`: an exact substring of the current file (after earlier edits in your list are applied). It must occur exactly once; include enough surrounding characters to make it unique, but no more than needed. Copy whitespace and quotes exactly.
  - `replace`: the text that replaces it.
- `notes`: one line per action describing the change, and any action you could not complete safely (with the reason).

## Rules

- Minimal diffs. Do not reformat, re-indent, reorder or "clean up" code the actions do not mention.
- Keep behaviour working: navigation, scoring, progress storage, dialogs and every interaction must function as before, apart from the defect being fixed. If a fix touches JavaScript, keep identifiers and data shapes compatible with the rest of the script.
- Accessibility fixes use native semantics first (real buttons and inputs, labels, headings, `<dialog>`), then ARIA only where native elements cannot express the role. Never add `aria-live` to a whole screen container; announce only the changing message.
- Do not add external scripts, stylesheets, fonts, trackers or network requests. The course must keep working from `file://` offline.
- Content edits follow the same fidelity rules as the storyboard: no new facts without evidence, keep qualifications and negations, keep citations beside the claims they support.
- If a fix cannot be done safely with text edits, skip it and say so in `notes`.
