# 15 — Quality Bar and Example Usage

## The example is not the target

The `examples/chemical-risk/` directory demonstrates the course-production lineage that motivated CourseForge. It is intentionally supplied so the builder has concrete artifacts rather than abstract requirements.

Do not replicate its visual appearance or implementation shortcuts as the default CourseForge design.

CourseForge must be able to ingest these examples and reason about their relationships, but its generated output should improve on them.

## What to learn from the examples

Preserve these strengths:

- rigorous research brief;
- source/citation emphasis;
- expanded evidence dossier;
- explicit instructional-design transformation;
- learning objectives and alignment;
- complete storyboard rather than slide-outline placeholders;
- formative and graded assessments;
- scope/safety qualification;
- editorial/humanization stage;
- final standalone HTML course;
- browser QA report.

## What CourseForge should improve

### Research
- stronger structured source/claim ledger;
- automated currentness checks where possible;
- multiple independent reviewers;
- explicit adjudication/repair loops;
- better provenance and versioning.

### Instructional design
- machine-readable objective/content/assessment graph;
- more systematic cognitive-load/transfer review;
- reusable stage schemas;
- stronger human review/locking.

### Storyboard
- canonical JSON model alongside Markdown;
- stronger visual specifications;
- better structured assessment metadata;
- deterministic validation of coverage/counts/IDs.

### Visual design
- much stronger design direction;
- topic-appropriate visual systems;
- reusable components;
- consistent icons;
- structured high-quality diagrams;
- better mobile layouts and information density;
- screenshot-based visual review.

### HTML implementation
- componentized generator rather than course-specific handcrafted logic;
- better semantic/accessibility architecture;
- stronger test coverage;
- maintainable course model;
- deterministic traceability attributes;
- regression testing;
- improved polish.

### QA
- multiple reviewers;
- real functional path coverage;
- axe integration;
- automated responsive checks;
- gap/fact/content-integrity review;
- controlled repairs and regression testing.

## Regression fixture use

The builder should create tests that ingest or inspect the included artifacts without requiring them to remain the only test fixture forever.

Examples:

- verify stage classifier recognizes the storyboard/HTML;
- verify HTML intake finds modules/interactions/references;
- verify QA can run the included HTML;
- verify pipeline can create a new course folder from imported storyboard;
- verify counts/traceability extraction where feasible.

## Portfolio presentation

The final repository should make the architecture and engineering visible. A reviewer should quickly understand that CourseForge is more than a prompt collection.

Public docs should demonstrate:

- architecture diagram;
- stage pipeline;
- deterministic router;
- environment doctor;
- reviewer ensemble/adjudication;
- sample artifact lineage;
- graphics system;
- browser QA;
- Claude/Codex adapters;
- human-in-the-loop options;
- example final course.

