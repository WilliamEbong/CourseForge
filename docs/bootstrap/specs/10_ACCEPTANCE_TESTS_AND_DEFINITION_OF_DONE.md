# 10 — Acceptance Tests and Definition of Done

The builder must treat this file as the minimum v1 acceptance suite. A plausible-looking codebase that has not been exercised end-to-end is not complete.

## A. Bootstrap/install

From a fresh clone on a supported environment:

- setup detects prerequisites;
- repo-local dependencies install through lockfile;
- Playwright Chromium is installed if missing;
- CourseForge configuration validates;
- no global plugin/skill installation is required;
- `doctor` reports machine-readable and human-readable status;
- smoke fixture executes successfully.

## B. Claude/Codex adapters

- availability/version checks work;
- command construction is tested;
- structured-output parsing is tested with fixtures;
- provider selection is configurable;
- adapter failures are classified and logged;
- the shared pipeline does not contain direct provider-specific calls outside adapters.

Optional live tests run only when authentication/credentials are available.

## C. Stage/state engine

- legal transitions are enforced;
- start at concept and stop at any requested stage;
- start from imported research/design/storyboard/HTML artifact;
- `continue` resumes from state;
- locked canonical artifacts are not silently replaced;
- retry limits work;
- human-gate state works;
- multiple versions/superseded artifacts are tracked.

## D. Deterministic router

- stage-to-skill/tool/reviewer mapping has unit tests;
- visual-type routing has unit tests;
- fallbacks are deterministic and logged;
- unknown enum/config fails safely;
- execution plan is saved before agent work;
- agent cannot silently expand allowed tool bundle through CourseForge routing logic.

## E. Review system

- multiple reviewer findings can be produced concurrently;
- finding schema validation works;
- adjudicator deduplicates/merges fixture findings;
- repair plan is schema-valid;
- repair does not modify unrelated locked content in regression fixture;
- post-repair validation reruns.

## F. Course artifact handling

- every course is self-contained in its folder;
- imported originals are preserved;
- manifests include hashes/provenance;
- example chemical-risk artifacts can be ingested;
- artifact IDs/relationships persist across stages.

## G. HTML build

Using a fixture/storyboard:

- build completes;
- released course is a single HTML file;
- core operation works offline after build (excluding external reference destinations);
- expected block/item IDs appear;
- interactions function;
- assessment scoring is correct;
- glossary/references work;
- progress/reset behavior works;
- no blocking console errors.

## H. Graphics

- Mermaid fixture compiles to SVG;
- native/SVG.js visual compiles;
- Vega-Lite chart compiles;
- fallback routing test exists;
- generated visuals have text equivalents;
- release does not depend on Mermaid/Vega runtime for precompiled visuals.

## I. Browser QA

Playwright tests:

- traverse screens;
- activate interaction families;
- test correct/incorrect paths;
- verify scoring;
- check menu/navigation;
- capture desktop/tablet/mobile screenshots;
- check common overflow/horizontal-scroll problems;
- collect page/console errors.

## J. Accessibility

- axe-core runs on representative/all screens according to test strategy;
- configured serious/critical violations block release;
- keyboard navigation tests cover primary controls;
- focus state is observable;
- drag-only interaction is prohibited;
- instructional visuals have text equivalents.

## K. Existing HTML improvement

Using the included example HTML:

- ingest without overwriting original;
- browser-run it;
- reconstruct enough structure to create an intake report;
- produce UI/UX/accessibility/function review findings;
- create a controlled repair plan;
- generate an improved copy or demonstrable fixture transformation;
- rerun regression tests.

## L. Public repository quality

- README has install/quickstart/architecture/example/troubleshooting sections;
- setup scripts are documented;
- licenses/attributions are present;
- no secrets or machine-specific absolute paths are committed;
- CI executes lint/typecheck/unit/integration tests where possible;
- architecture and contribution docs are coherent;
- sample course fixture demonstrates value.

## Definition of done

v1 is complete only when the implemented system, not just documentation, demonstrates these workflows with automated tests and a real end-to-end fixture. Known limitations are documented explicitly rather than hidden.

