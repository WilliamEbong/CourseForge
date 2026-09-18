# Deterministic routing

Every choice about what runs is made by `resolveExecutionPlan` in `src/routing/plan.ts`: a pure function of the
registries, the course manifest, the stage state, backend probes and CLI overrides. It takes the current time as
an argument, so the same input always yields a deep-equal plan. Agents never pick tools; where a semantic choice
is needed they return a closed enum and code maps it to a tool.

## Registries (`config/`)

All files are validated with zod at load (`loadRegistries`) and cross-checked (`crossCheck`: every stage has a
route; every referenced reviewer, skill, agent tool, output schema, renderer and Lucide icon exists; `rerunMap`
names only the stage's own reviewers; network tools require `network: true`; every archetype has a route and
every block kind a component). `courseforge validate-config`
runs the same checks; an invalid registry is a `RoutingError` (exit 2). JSON Schemas for editors live in
`schemas/*.schema.json`.

| File | Contents |
|---|---|
| `stages.json` | Per stage: `kind` (agent / deterministic), `inputs.required/optional`, `outputs`, `artifacts` (logical keys), `generator {role, promptTemplate, skills, tools, outputSchema, fanOut, writeMode, network}`, `compiler`, `validators[]`, `reviewers[]`, `rerunMap` (finding category → reviewers to rerun after repair), `repairer`, `gateDefault`, `limits {taskTimeoutSec, stageTimeoutSec, maxTurns, processRetries}`, `writable[]` / `readOnly[]` path templates (`{course}/storyboard/**`) |
| `reviewers.json` | Per reviewer: rubric file, prompt template, skills, tools, finding categories, input files, `needsScreenshots`, `network`, `enabled` |
| `skills.json` | Per skill: `.claude/skills/<id>/SKILL.md` path, stages, roles, `maxBytes` |
| `tools.json` | Per tool: kind (`agent-tool`, `renderer`, `asset`, `qa`, `parser`, `bundler`), capabilities, npm package, harness tool names (`Read`, `WebSearch`, …) |
| `routing.json` | Stage routes (`STG-<STAGE>-001`), ordered visual routes, semantic icon → Lucide icon map, block kind → component map |
| `fallbacks.json` | Renderer repair budget and terminal fallback, schema retries, process retries and backoff, backend fallback policy, concurrency (reviewers, fan-out) |
| `review-policy.json` | `maxRepairCycles` (3), per-stage overrides, repair and release-blocking severities, blocking axe impacts, `onCapReached`, gate defaults, risk floors, intake-mode behaviour |

## Execution plan

Saved to `courses/<id>/logs/execution-plans/<planId>.json` before any agent work; `planId` is
`PLAN-<runId>-<stage code>-r<revision>`. Fields (`ExecutionPlanSchema` in `src/core/schemas/registry.ts`):

| Field | Meaning |
|---|---|
| `planId`, `runId`, `courseId`, `stage`, `revision`, `supersedes`, `createdAt` | Identity and lineage |
| `transition` | `fromStatus`, `startStage`, `targetStage` |
| `mode` | `generate` or the intake mode (`preserve`, `review-only`, `improve`, `rebuild`) |
| `backend` | `requested`, `selected`, `version`, `rule` |
| `inputs` | `{artifactId, path, hash, required}` per input |
| `generator`, `generatorFanOut` | Generator TaskSpec and fan-out keys (per section / per module) |
| `compiler`, `validators` | Deterministic compiler and validator IDs |
| `reviewers`, `reviewConcurrency`, `rerunMap` | Reviewer TaskSpecs (findings-only), pool size, rerun mapping |
| `adjudicator`, `repairer` | TaskSpecs, or `null` when not applicable |
| `skills`, `tools` | Union over all tasks (sorted); a task can never use a tool outside its own list |
| `visualRoutes` | Per visual: archetype, renderer, fallback chain, rule |
| `fallbacks`, `maxRepairCycles`, `onCapReached`, `repairSeverities` | Loop policy |
| `humanGate` | Effective `{mode, source}` |
| `writablePaths`, `readOnlyPaths`, `expectedOutputs`, `limits` | Filesystem scope and budgets |
| `decisions` | Every routing decision (below) |
| `registryHashes` | Hash of each registry file used |

A TaskSpec carries `taskId, role, promptTemplate, subject, rubric, skills, tools, agentTools, inputPaths,
outputSchema, writeMode (structured | findings-only | artifact-write), network, readOnlyPaths, writablePaths,
timeoutSec, maxTurns`. Adjudicator and repairer receive only the read-only tools already present in the stage
bundle, so they can never widen it.

## Routing-decision log

Each decision is appended to `logs/routing-decisions.jsonl`:
`{ts, runId, planId, stage, kind, subject, input, selected, rule, fallback, reason}` with `kind` one of
`stage | backend | gate | reviewer | skill | tool | visual | fallback | classification` (the last two are reserved
for renderer fallbacks and classifier tasks). Lines from an offline demo run:

```json
{"ts":"2026-09-18T22:39:36.982Z","runId":"RUN-20260918T223936Z-61e0","planId":"PLAN-RUN-20260918T223936Z-61e0-CN-r1","stage":"CONCEPT","fallback":false,"kind":"stage","subject":"CONCEPT","input":"VALIDATING:generate:CONCEPT->STORYBOARD","selected":"agent","rule":"STG-CONCEPT-001","reason":null}
{"ts":"2026-09-18T22:39:36.982Z","runId":"RUN-20260918T223936Z-61e0","planId":"PLAN-RUN-20260918T223936Z-61e0-CN-r1","stage":"CONCEPT","fallback":false,"kind":"backend","subject":"backend","input":"auto","selected":"fake","rule":"BACKEND-FORCED-001","reason":"harness forced to fake"}
{"ts":"2026-09-18T22:39:36.982Z","runId":"RUN-20260918T223936Z-61e0","planId":"PLAN-RUN-20260918T223936Z-61e0-CN-r1","stage":"CONCEPT","fallback":false,"kind":"gate","subject":"CONCEPT","input":"risk=standard;override=none;cli=none","selected":"auto","rule":"GATE-STAGE-DEFAULT-001","reason":null}
{"ts":"2026-09-18T22:39:36.982Z","runId":"RUN-20260918T223936Z-61e0","planId":"PLAN-RUN-20260918T223936Z-61e0-CN-r1","stage":"CONCEPT","fallback":false,"kind":"reviewer","subject":"concept-scope-safety","input":"CONCEPT","selected":"enabled","rule":"STG-CONCEPT-001","reason":null}
```

Disabled reviewers and reviewers skipped by the intake mode are logged with `selected: "skipped"` and a reason.
Visual decisions record `input` as `ARCHETYPE/interaction[/override=x]` and `selected` as the chain
`renderer>fallback>…>text_equivalent`.

## Visual routing

`routeVisual` takes the first rule in `routing.json#visualRoutes` whose `archetype` and `interaction` match
(`null` matches anything). The fallback chain is the rule's fallbacks followed by `text_equivalent`, which always
succeeds. A `rendererOverride` on a visual spec is honoured only if it names a registered renderer (rule
`VIS-OVERRIDE-000`, primary route appended as fallbacks); otherwise routing fails.

| Archetype | Primary | Fallbacks | Rule |
|---|---|---|---|
| PROCESS | cf_svg | mermaid → text_equivalent | VIS-PROCESS-001 |
| TIMELINE | cf_svg | mermaid → text_equivalent | VIS-TIMELINE-001 |
| DECISION_TREE | mermaid | svgjs → text_equivalent | VIS-DECISION_TREE-001 |
| CAUSE_EFFECT | mermaid | svgjs → text_equivalent | VIS-CAUSE_EFFECT-001 |
| SYSTEM_ARCHITECTURE | mermaid | svgjs → text_equivalent | VIS-SYSTEM_ARCHITECTURE-001 |
| SEQUENCE | mermaid | svgjs → text_equivalent | VIS-SEQUENCE-001 |
| STATE_DIAGRAM | mermaid | svgjs → text_equivalent | VIS-STATE_DIAGRAM-001 |
| LIFECYCLE | cf_svg | svgjs → text_equivalent | VIS-LIFECYCLE-001 |
| COMPARISON | cf_svg | svgjs → text_equivalent | VIS-COMPARISON-001 |
| BEFORE_AFTER | cf_svg | svgjs → text_equivalent | VIS-BEFORE_AFTER-001 |
| LAYERED_SYSTEM | cf_svg | svgjs → text_equivalent | VIS-LAYERED_SYSTEM-001 |
| RESPONSIBILITY_MAP | cf_svg | svgjs → text_equivalent | VIS-RESPONSIBILITY_MAP-001 |
| FEEDBACK_LOOP | cf_svg | svgjs → text_equivalent | VIS-FEEDBACK_LOOP-001 |
| CONTINUUM | cf_svg | svgjs → text_equivalent | VIS-CONTINUUM-001 |
| MATRIX | cf_svg | svgjs → text_equivalent | VIS-MATRIX-001 |
| EVIDENCE_MAP | cf_svg | svgjs → text_equivalent | VIS-EVIDENCE_MAP-001 |
| FUNNEL | cf_svg | svgjs → text_equivalent | VIS-FUNNEL-001 |
| SCENARIO_MAP | cf_svg | svgjs → text_equivalent | VIS-SCENARIO_MAP-001 |
| HIERARCHY | cf_svg | mermaid → text_equivalent | VIS-HIERARCHY-001 |
| LABELED_OBJECT | svgjs | cf_svg → text_equivalent | VIS-LABELED_OBJECT-001 |
| RELATIONSHIP_NETWORK | svgjs | d3 → text_equivalent | VIS-RELATIONSHIP_NETWORK-001 |
| QUANTITATIVE_CHART + `interactive-data` | d3 | vega_lite → text_equivalent | VIS-QUANT-002 |
| QUANTITATIVE_CHART | vega_lite | d3 → text_equivalent | VIS-QUANTITATIVE_CHART-001 |

Icons are not routed per visual: semantic icon names map to Lucide icons in `routing.json#icons`.

## Backend selection

`selectBackend` in `src/routing/backend.ts`, applied once when the run opens and recorded in every plan:

| Rule | When |
|---|---|
| `BACKEND-FORCED-001` | `--harness` or `COURSEFORGE_HARNESS` forces `claude`, `codex` or `fake` |
| `BACKEND-EXPLICIT-001` | `--backend claude|codex` (or `course.yaml` `pipeline.agent_backend`) and that backend is available and not signed out |
| `BACKEND-AUTO-001` | `auto`: first usable backend in `fallbacks.json#backend.order` (`claude`, then `codex`) |
| `BACKEND-FALLBACK-001` | Explicit backend unusable, `fallbacks.json#backend.enabled` is true **and** `course.yaml` sets `backend_fallback: true` |
| `BACKEND-NONE-001` | Nothing usable: every agent task fails with class `unavailable` and a message naming the fix |

A backend is never switched because an answer was poor. Backend fallback is off by default
(`backend.enabled: false`).

## Gate strictness and risk floors

`effectiveGate` in `src/routing/gates.ts`: the strictest (`auto < hybrid < human`) of the stage's
`gateDefault`, `review-policy.json#gateDefaults[stage]`, `course.yaml#human_review[stage]` and the risk floor.
A `--gate` CLI override is applied last and may lower the gate, but never below the risk floor unless
`course.risk_override: acknowledged` is set (which is recorded in the plan's gate decision). Rule IDs:
`GATE-<SOURCE>-001` where source is `stage-default`, `policy`, `course`, `risk-floor` or `cli`.

| Risk tier | Floors |
|---|---|
| `standard` | none |
| `elevated` | RELEASE: hybrid |
| `high_stakes` | RESEARCH_DOSSIER, INSTRUCTIONAL_DESIGN, STORYBOARD: hybrid; COURSE_QA, RELEASE: human |

The CONCEPT stage can raise `course.risk_tier` from its classification but never lowers it.

## Tests

`tests/unit/routing/router.test.ts`, `visual-router.test.ts`, `backend-gates.test.ts` and
`tests/unit/config/config.test.ts` (acceptance tags D1–D4, A4).
