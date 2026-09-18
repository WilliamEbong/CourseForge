# CourseForge Bootstrap Package Manifest

## Top-level

- `README_START_HERE.md` — placement/use instructions and package overview.
- `MASTER_BUILD_PROMPT.md` — main prompt to paste into Claude Code in Plan Mode; also defines execution behavior.
- `OPUS_EXECUTION_HANDOFF.md` — short handoff after switching from planning to execution.

## Specifications

- `specs/01_PRODUCT_VISION_AND_SCOPE.md`
- `specs/02_ARCHITECTURE_AND_PIPELINE.md`
- `specs/03_STAGE_CONTRACTS_AND_ARTIFACTS.md`
- `specs/04_REVIEWERS_HUMAN_GATES_AND_ADJUDICATION.md`
- `specs/05_DETERMINISTIC_ROUTING_AND_TOOL_POLICY.md`
- `specs/06_ENVIRONMENT_BOOTSTRAP_AND_PORTABILITY.md`
- `specs/07_CLAUDE_CODE_AND_CODEX_COMPATIBILITY.md`
- `specs/08_VISUAL_GRAPHICS_AND_UI_SYSTEM.md`
- `specs/09_EXISTING_ARTIFACT_REVIEW_AND_IMPROVEMENT.md`
- `specs/10_ACCEPTANCE_TESTS_AND_DEFINITION_OF_DONE.md`
- `specs/11_REPOSITORY_AND_COURSE_FOLDER_LAYOUT.md`
- `specs/12_DEPENDENCIES_AND_EXTERNAL_REPOS.md`
- `specs/13_SECURITY_PRIVACY_AND_LICENSE_POLICY.md`
- `specs/14_BUILD_PARALLELIZATION_PLAN.md`
- `specs/15_QUALITY_BAR_AND_EXAMPLE_USAGE.md`

## Templates

Machine-readable examples for the intended registries/state/manifests live in `templates/`.

## Agent instruction templates

- `agent-instructions/CLAUDE_MD_TEMPLATE.md`
- `agent-instructions/AGENTS_MD_TEMPLATE.md`

These are guidance for the builder; it should create polished real root instruction files in the finished repository.

## Tooling sources

- `tooling-sources/SELECTED_REPOS.md`
- `tooling-sources/CURRENT_AGENT_HARNESS_NOTES.md`

## Chemical-risk reference lineage

`examples/chemical-risk/` contains the research brief, first and expanded research dossiers, instructional-design blueprint, original and humanized storyboards, interactive HTML, QA report, source transformation prompts, and browser screenshots.

The example is a quality floor/reference fixture. It is not the desired final design system.
