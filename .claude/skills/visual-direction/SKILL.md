---
name: visual-direction
description: Choosing CourseForge's bounded visual-direction parameters (family, accent hue, density, corners, type scale, figure style) and writing the course design brief. Used by CourseForge VISUAL_DIRECTION tasks and visual reviewers.
disable-model-invocation: true
---

# Visual direction

## What you control, and what code controls

You choose six parameters and write the reasoning. CourseForge expands them into design tokens, computes WCAG contrast for light and dark schemes, clamps anything that fails, selects components and routes every figure to a renderer. You never specify colours, fonts, pixel sizes or CSS. This keeps every course accessible and consistent while still fitting its subject.

## Families

| Family | Register | Good fits |
|---|---|---|
| `scientific-clinical` | precise, calm, evidence-forward | health, laboratory, research, clinical governance |
| `technical-industrial` | structured, legible, procedural | engineering, occupational safety, operations, manufacturing |
| `corporate-professional` | restrained, businesslike | compliance, governance, management, finance awareness |
| `editorial-humanities` | reading-led, typographic | history, ethics, policy, law concepts, writing |
| `modern-technology` | crisp, contemporary | software, data, digital skills, cybersecurity awareness |
| `environmental-natural` | organic, grounded | ecology, agriculture, sustainability, public health outdoors |

Choose by the subject's seriousness and the learners' setting. A safety course should feel trustworthy and clear, not playful. When two fit, prefer the one whose typography suits the reading load.

## Accent hue

Degrees on the colour wheel, in steps of 15. The accent marks links, focus and emphasis. Keep it away from the hues that carry state meaning in the course: reds and oranges (roughly 0–30) signal warnings and errors, greens (roughly 105–150) often signal success. Blues, teals and violets (roughly 180–270) are safe general accents. Consider subject associations (clinical teal, environmental green-blue) but never at the expense of state clarity.

## Density, corners, type scale, figure style

- `density`: `comfortable` for novices, reading-heavy courses and mobile-first use; `compact` only for experienced audiences using the course as reference.
- `corner`: `sharp` for technical and regulatory registers; `soft` as the neutral default; `round` for friendlier, lower-stakes subjects.
- `typeScale`: `generous` for long reading or novice audiences; `default` otherwise; `compact` rarely.
- `figureStyle`: `line` for dense technical diagrams, where fills add noise; `filled` when regions and grouping carry meaning (layers, categories, matrices).

## Writing the design brief

The brief guides build decisions and reviewers. Make it specific to this course:

- **Subject and audience fit:** why these parameters suit these learners and this material.
- **Information density:** words per screen, how optional depth is signalled, how tables and matrices adapt to phones.
- **Typography and hierarchy:** heading levels, emphasis rules, and how law, guidance, evidence, warning and misconception callouts are distinguished by heading text and structure as well as style.
- **Diagram conventions:** reading direction, label length, emphasis without colour-only meaning, legend policy, consistency of recurring models.
- **Feedback and assessment states:** words plus icon plus colour, never colour alone.
- **Motion:** purposeful, short, removed under reduced-motion preference.
- **Icons:** controlled set, functional use only, always with text for meaning.
- **Responsive behaviour:** what changes at tablet and phone widths.

## Archetype reclassification

At this stage, each storyboard visual's archetype is re-checked against the structure of its content. Change it when another archetype represents the relationships better; keep it otherwise. Set a renderer override only when the routed renderer genuinely cannot express the content (rare). See the instructional-graphics skill for archetype fit.

## Things that never belong

Decorative stock imagery, AI-generated pictures, brand logos of regulators or standards bodies, free-form colours, custom fonts, animation for its own sake.
