# Task: visual direction for "{{courseTitle}}"

Course `{{courseId}}`, stage `{{stage}}`, cycle {{cycle}}. Audience: {{audience}}. Language `{{language}}`. Risk tier `{{riskTier}}`. Duration {{durationMinutes}} minutes.

Human instructions: {{instructions}}
Locked IDs: {{locks}}

Context prepared by CourseForge (visual inventory, current archetypes, block counts):

```json
{{extra}}
```

## Purpose

Choose a coherent, professional visual language for this subject and audience from CourseForge's bounded design system, and make sure every storyboard visual has the right semantic archetype. You choose parameters; code expands them into tokens, checks WCAG contrast in light and dark schemes, clamps unsafe values and builds the components. You never specify colours, fonts or CSS.

Read the edited storyboard (module titles, block kinds, visual specs, amount of text, number of interactions) before choosing.

## Parameters

- `family`: `scientific-clinical` (precise, calm, evidence-forward: health, lab, research), `technical-industrial` (structured, high-legibility, procedural: engineering, safety, operations), `corporate-professional` (restrained, business: governance, compliance, management), `editorial-humanities` (reading-led, generous typography: history, ethics, policy), `modern-technology` (crisp, contemporary: software, data, digital), `environmental-natural` (organic, grounded: ecology, agriculture, sustainability). Pick the family whose tone suits the subject's seriousness and the audience's setting, not the most decorative option.
- `accentHue`: 0–345 in steps of 15. Choose for meaning and tone: avoid hues that read as alarm (reds and oranges near 0–30) as the general accent for safety subjects, because warning and error states need those hues to stand out.
- `density`: `comfortable` for novices, long reading and mobile-heavy use; `compact` only for experienced audiences scanning reference-heavy material.
- `corner`: `sharp`, `soft` or `round`; match the family's register (technical and clinical usually `sharp` or `soft`).
- `typeScale`: `generous` for reading-heavy courses or novices, `default` otherwise, `compact` rarely.
- `figureStyle`: `line` for diagram-heavy technical courses where fills would add noise; `filled` where grouping and regions carry meaning.

## Visual classifications

Return one entry per visual in the storyboard. Keep the current archetype when it fits; change it when another archetype represents the content's actual structure better (a "process" that loops back is a `LIFECYCLE` or `FEEDBACK_LOOP`; a "comparison" with more than two dimensions is a `MATRIX`; a step list with yes/no branches is a `DECISION_TREE`). The `rationale` states the structural reason in one or two sentences. `rendererOverride` stays `null` unless the content genuinely cannot be expressed by the routed renderer; code routes by archetype.

## Design brief (`briefMarkdown`)

Write a real brief of roughly 300–600 words for the build and review stages, with these headings:

- **Subject and audience fit**: why this family, hue and density suit these learners and this material.
- **Information density**: how much text a screen should carry, how optional depth is signalled, how dense tables and comparisons are handled on mobile.
- **Typography and hierarchy**: heading levels, emphasis rules, how evidence, law and guidance callouts are distinguished in wording and structure, not colour alone.
- **Diagrams**: shared rules for the course's figures (label length, reading direction, how emphasis is shown, legend policy, never colour-only meaning).
- **Feedback and assessment states**: how correct, incorrect and neutral feedback are signalled with text and icon, not colour alone.
- **Motion**: purposeful only, and fully disabled under reduced-motion preferences.
- **Icons**: sparing, functional, from the controlled icon set; never decorative clip-art.
- **Responsive behaviour**: what changes at tablet and phone widths.

`rationale` summarises the choice in two or three sentences.

## Boundaries

No free-form colours, fonts, images or external assets. No decorative stock imagery or AI-generated pictures. Do not edit storyboard content; flag content problems in the brief under a final "Notes for content owners" heading if you see them.
