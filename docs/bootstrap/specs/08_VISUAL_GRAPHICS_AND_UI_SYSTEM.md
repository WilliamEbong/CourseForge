# 08 — Visual, Graphics, and UI System

## Objective

CourseForge must produce courses that are materially more professional than the included example HTML. Visual design is a dedicated production stage, not an afterthought during HTML generation.

## Visual-direction stage

Before implementation, create:

```text
visual/design-brief.md
visual/design-tokens.json
visual/component-plan.json
visual/visual-specs.json
```

The visual-direction agent chooses a coherent design language appropriate to the subject and audience while obeying accessibility, readability, information-density, and responsive constraints.

## Approved course visual systems

CourseForge should eventually ship a small number of high-quality visual families rather than inventing a style from scratch for every course. Initial candidates:

- scientific / clinical;
- technical / industrial;
- corporate / professional;
- editorial / humanities;
- modern technology;
- environmental / natural.

Each defines tokens and rules for typography, spacing, surfaces, border radii, shadows, color, icons, diagrams, scenarios, feedback, assessments, and motion.

## Component system

Build a reusable component library and develop it in Storybook. Course rendering should select from approved components rather than inventing basic UI patterns repeatedly.

Initial components should include:

- course shell/header/menu/progress;
- module landing;
- content/concept block;
- optional technical depth;
- evidence/law/guidance callout;
- warning/qualification/misconception;
- comparison;
- process/timeline/lifecycle;
- scenario/decision activity;
- single choice;
- multiple response;
- matching;
- categorization;
- sequencing;
- feedback/rationale;
- assessment shell/results/review;
- glossary/acronym panel;
- citation/source panel;
- reference library.

Storybook cases should cover desktop/tablet/mobile, long/short content, focus states, correct/incorrect states, and dense content.

## Instructional visual archetypes

Visuals should be specified semantically before rendering. Initial archetypes:

1. process;
2. lifecycle;
3. timeline;
4. hierarchy;
5. decision tree;
6. comparison;
7. before/after;
8. layered system;
9. responsibility map;
10. feedback loop;
11. cause/effect;
12. continuum;
13. matrix;
14. labeled object/anatomy;
15. evidence map;
16. funnel;
17. relationship network;
18. quantitative chart;
19. scenario map;
20. system architecture.

A visual spec contains purpose, type, content/data, source IDs, accessibility text equivalent, interaction requirement, and preferred renderer only if explicitly required.

## Renderers

Core tooling:

- Mermaid/Mermaid CLI for structural diagrams;
- native SVG archetypes and SVG.js for custom conceptual graphics;
- Vega-Lite for standard quantitative charts;
- D3 for genuinely advanced custom/interacting data visualizations;
- Lucide as controlled icon vocabulary.

Compile graphics to inline SVG or HTML for release where practical. Do not require these libraries at course runtime unless a specific interaction cannot reasonably be precompiled.

## Optional AI-generated images

Raster/illustrative generation is optional and provider-pluggable. It must never be required for basic CourseForge operation. Use generated imagery only when it has instructional value, not as default decoration.

Any future image-provider adapter must include provenance and prompt metadata, licensing/usage notes where relevant, accessibility text, and a fallback behavior.

## Visual QA

Use Playwright screenshots at configured viewports. Review dimensions should include at least:

- desktop around 1440px;
- tablet around 768px;
- mobile around 375–390px.

Visual reviewers inspect hierarchy, rhythm, typography, density, alignment, component consistency, diagram legibility, awkward wrapping, clipping, excessive scrolling, and mobile usability.

Programmatic checks should catch overflow, horizontal scroll, overlap where detectable, broken images/SVG, console errors, missing focus styles where testable, and viewport regressions.

## Accessibility

Visuals must have meaningful text equivalents. Do not encode essential meaning only by color, animation, hover, or spatial position without an accessible representation. Interactions requiring drag must have keyboard alternatives.

## Release expectation

The final primary artifact remains a portable single-file HTML course with embedded CSS/JS/course data/inline SVG/icons. Development tooling is not shipped into the learner-facing file unless necessary.

