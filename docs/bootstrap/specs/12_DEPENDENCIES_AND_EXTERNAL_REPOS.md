# 12 — Dependencies and External Repositories

## Selection principle

Use mature, actively maintained projects for infrastructure. Avoid making small experimental Claude-skill repositories critical dependencies merely because their README is appealing.

The build agent must re-check current maintenance, licensing, installation requirements, and compatibility before pinning versions.

## Core selected ecosystem

### Anthropic project skills/plugin patterns

Use official Anthropic project-scoped mechanisms and selectively study/adapt appropriate open-source materials from:

- `anthropics/skills` — skill structure/spec/examples;
- `anthropics/knowledge-work-plugins` — especially design/validation/operations/plugin architecture patterns;
- the official Claude Code `frontend-design` plugin/skill.

Do not load or vendor an entire large plugin suite if only a few concepts/skills are required. Perform license review before copying upstream content. Prefer CourseForge-owned thin skills that cite/inherit ideas rather than unnecessary duplication.

### Testing/accessibility

- Microsoft Playwright — browser automation, screenshots, responsive and functional QA;
- Deque axe-core — automated accessibility checks.

### UI/component development

- Storybook — development/test workshop for reusable course components; not shipped into released courses;
- Lucide — controlled icon vocabulary, with only used SVGs embedded at release.

### Structured graphics

- Mermaid + Mermaid CLI — process, timeline, sequence, state diagrams;
- SVG.js — custom conceptual vector graphics;
- Vega/Vega-Lite — declarative quantitative charts;
- D3 — advanced/custom interactive data visualization when simpler routes are insufficient.

### Optional reference/inspiration, not required runtime dependencies

- shadcn/ui and Radix primitives — accessibility/component behavior reference; do not force React into v1 merely to use them;
- Excalidraw — optional human-editable diagram workflow, not a core dependency unless later justified.

## Repositories explicitly not required for v1

Do not make the following small/young third-party Claude design/review skill repos hard dependencies. Their useful ideas may be reproduced in CourseForge-owned reviewer specs after license-aware study:

- dawitlabs/ui-skills;
- richhemsley3/claude-design-skills;
- AslanMazhidov/design-review-skill;
- cdmx-in/ui-review;
- GrillerGeek/ux-review;
- small standalone accessibility/design review skills;
- small visual-regression wrapper skills.

Likewise, education-specific repos previously reviewed should be inspiration only unless a later license/quality review justifies integration. CourseForge's instructional-design core should be its own system based on the workflow and examples in this kit.

## Local installation

Core JS dependencies should be installed locally from `package.json`/`package-lock.json`. Avoid global installs.

The build agent should confirm the exact package choices and compatibility before finalizing `package.json`; this specification defines capability requirements, not permission to pin stale package versions blindly.

## Dependency update policy

Implement or document:

- pinned versions;
- deliberate upgrade process;
- `doctor` compatibility checks;
- smoke/regression tests before accepting upgrades;
- license/attribution updates;
- changelog notes when a dependency changes output behavior.

## Finished course runtime

Development dependencies must not automatically become learner-facing runtime dependencies. Prefer compiling diagrams/icons/assets into the single HTML release.

