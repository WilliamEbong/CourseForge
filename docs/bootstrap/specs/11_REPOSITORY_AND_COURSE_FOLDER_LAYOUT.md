# 11 — Repository and Course Folder Layout

## Repository layout

Target structure, subject to implementation refinement:

```text
CourseForge/
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── setup.ps1
├── setup.sh
├── .gitignore
├── .github/workflows/
├── .claude/
│   ├── settings.json
│   ├── rules/
│   ├── skills/
│   └── agents/
├── config/
│   ├── stages.json
│   ├── tools.json
│   ├── skills.json
│   ├── reviewers.json
│   ├── routing.json
│   └── fallbacks.json
├── schemas/
├── src/
│   ├── cli/
│   ├── core/
│   ├── environment/
│   ├── pipeline/
│   ├── artifacts/
│   ├── routing/
│   ├── harness/
│   ├── ingestion/
│   ├── review/
│   ├── graphics/
│   ├── renderer/
│   ├── qa/
│   └── release/
├── components/
│   └── course-ui/
├── storybook/
├── templates/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── e2e/
├── docs/
│   ├── architecture/
│   ├── user-guide/
│   ├── developer-guide/
│   └── exec-plans/
├── vendor/
│   └── LICENSES/
└── courses/
```

Do not blindly reproduce the bootstrap kit's `specs/` folder as runtime architecture if a cleaner docs structure is appropriate; preserve the substance and traceability.

## Course folder rule

All course-specific content belongs inside one course directory. No course should depend on hidden files scattered elsewhere in the repository for its project state or evidence.

Example:

```text
courses/laboratory-chemical-risk/
├── course.yaml
├── state.json
├── README.md
├── input/
│   ├── originals/
│   └── intake-report.json
├── research/
│   ├── research-brief.md
│   ├── research-dossier.md
│   ├── sources.jsonl
│   ├── claims.jsonl
│   └── review/
├── design/
│   ├── instructional-design.md
│   ├── instructional-design.json
│   └── review/
├── storyboard/
│   ├── storyboard.md
│   ├── storyboard.json
│   ├── storyboard-edited.md
│   └── review/
├── visual/
│   ├── design-brief.md
│   ├── design-tokens.json
│   ├── component-plan.json
│   └── visual-specs.json
├── model/
│   └── course.json
├── build/
│   ├── index.html
│   └── build-report.json
├── review/
│   ├── screenshots/
│   ├── findings/
│   ├── consolidated-review.md
│   ├── repair-plan.json
│   └── regression-report.json
├── versions/
├── logs/
│   ├── environment.json
│   ├── execution-plans/
│   ├── routing-decisions.jsonl
│   └── run-events.jsonl
└── release/
    ├── course.html
    ├── qa-report.md
    ├── source-report.md
    └── release-manifest.json
```

## Why this matters

A course folder should be portable as a self-contained audit trail. It can be zipped, archived, moved, handed to a reviewer, or reopened months later without depending on chat history.

Reusable software and visual components remain in the CourseForge repository; course-specific generated content does not leak into global directories.

## Semantic versions/snapshots

CourseForge should maintain semantic artifact versions or snapshots without requiring the user to understand Git internals. Git remains the repository-level history system, but artifact manifests should describe meaningful stage versions such as:

```text
research-v1-generated
research-v2-reviewed
storyboard-v1-generated
storyboard-v2-human-approved
html-v1-build
html-v2-qa-repaired
release-v1
```

Do not duplicate every file blindly if content-addressed manifests/hardlinks/copies can provide a cleaner implementation, but always preserve the ability to recover prior canonical states.

