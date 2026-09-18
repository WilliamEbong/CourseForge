# CourseForge v1 — Implementation Plan

> Plan-mode note: the ZIP could not be extracted during planning (plan mode is read-only), so all bootstrap
> material was read by streaming ZIP members to stdout. Extraction is **Step 0** of execution. On execution,
> copy this file to `docs/exec-plans/active/courseforge-v1.md` (the location `MASTER_BUILD_PROMPT.md` requires).

## 0. Context

`CourseForge_Bootstrap_Contents_2026-09-18.zip` (50 files, integrity OK) specifies CourseForge: a local,
repo-contained, artifact-driven course engineering harness. It must take a concept **or any existing artifact**
(research, design, storyboard, HTML course) from any production stage to any later stage, ending in a tested,
portable single-file HTML course. Non-negotiables from the specs: deterministic state machine + routing +
saved execution plans, provider-neutral core with thin Claude Code / Codex adapters, reviewer ensembles →
adjudication → bounded controlled repair, optional human gates at every major stage, structured graphics,
source→claim→…→HTML traceability, setup/doctor self-repair, real browser + axe QA, existing-HTML improvement,
and an automated acceptance suite (spec 10 groups A–L). It must not collapse into a set of giant prompts.
The `examples/chemical-risk/` lineage is a quality floor and regression fixture, not the target.

Seven planning workstreams were run as parallel subagents (architecture/state/router, environment/bootstrap,
Claude/Codex compatibility, dependency/licence, course-pipeline/artifact, UI/graphics, QA/test) and reconciled
below. Where analysts disagreed, §2 records the ruling.

## 1. Current environment findings (inspected, not assumed)

| Item | Finding |
|---|---|
| OS / HW | Windows 10 Home 10.0.19045 x64; i7-3770 (4C/8T, AVX, no AVX2 — no blocker); 12 GB RAM, **only ~1.7 GB free** at inspection; C: 306 GB free |
| Shells | Windows PowerShell **5.1 only** (no pwsh 7); Git Bash (MSYS). Execution policy LocalMachine=Unrestricted |
| Git | 2.48.1; user `core.autocrlf=false` (system default true); `core.longpaths` unset; Windows LongPathsEnabled=1. **Folder is not a git repo** |
| Node | v24.14.1 (Active LTS), npm 11.11.0; npm cache in `%LOCALAPPDATA%` (not synced). No nvm/fnm/volta/pnpm/yarn |
| Agent CLIs | `claude` 2.1.258 (native `claude.exe` behind npm shim), `codex` 0.144.6 (node script). `codex login status` = logged in (ChatGPT). `claude auth status --json` = `loggedIn:false` from CLI's view (desktop app authenticates differently) → live Claude smoke may need a manual `claude` login; legitimate manual boundary |
| Global agent config | `~/.claude`: SessionStart/Stop/PreCompact/SessionEnd hooks + 10 plugins, several **style-altering** (terse "caveman" output, etc.), global CLAUDE.md + rules. `~/.codex`: global AGENTS.md + config.toml. **Spawned agents would inherit these and corrupt course prose** unless adapters isolate them. Never modified by CourseForge |
| Browsers | Playwright Chromium **not installed** (`%LOCALAPPDATA%\ms-playwright` has only an unrelated dir). System Chrome + Edge present (fallback channel) |
| Other | python 3.14, bun, rustc, gh, winget, choco present; no Docker/Java. None will be required |
| Project dir | `C:\Users\Owner\OneDrive\Documents\CourseForge` — under the OneDrive folder, but **user confirmed sync is disabled**; contains only the ZIP; no user work to preserve beyond it |

Material consequences: (1) OneDrive path is an advisory only on this machine (sync off; see R1); (2) low RAM → one shared Chromium, QA workers ≤2, agent process pool ≤3, never overlap QA
with a reviewer pool; (3) PS 5.1 → `setup.ps1` must avoid `&&`, ternaries, UTF-16 output; (4) CRLF → hash
LF-normalised bytes + `.gitattributes eol=lf`.

## 2. Reconciled decisions (analyst conflicts → ruling)

| Topic | Ruling | Why |
|---|---|---|
| Storybook (dep analyst: drop) | **Keep**, dev-only (`@storybook/html-vite`). Stories import the same `render()` the compiler uses. Not on the setup/smoke critical path; CI Storybook build is a non-required job | Spec 08/12 + user instruction require it; cost contained |
| Mermaid CLI | **Drop `@mermaid-js/mermaid-cli`**; render `mermaid` inside the one Playwright Chromium page | mmdc needs puppeteer → second Chromium (~180 MB, more RAM); in-page render is ~20 lines, deterministic IDs |
| SVG.js (dep analyst: drop) | **Keep `@svgdotjs/svg.js`**, executed in the same Playwright page (no `svgdom`: wrong font metrics). Native archetypes (`cf_svg`) are pure TS string builders with injected in-page text measurer | Spec H2 requires native/SVG.js compile; avoids fragile DOM shim |
| Vega-Lite | Headless `new vega.View(..., {renderer:'none'}).toSVG()` — no browser, no node-canvas | Verified in Vega docs |
| D3 | Declared dep; route exists from day 1; one in-page renderer (RELATIONSHIP_NETWORK / interactive-data) lands in Phase 5b | "D3 only for advanced cases" |
| Lucide | `lucide-static` devDependency; build inlines only icons named by a closed `IconName` enum; ISC notice embedded in released HTML + `licenses/` | Controlled vocabulary, no vendoring script |
| Schemas | **zod v4 is the single source** → generated `schemas/*.schema.json` committed + drift test. Agent-facing schemas flat/strict (no `$ref`, all required, `additionalProperties:false`, optional = nullable) | Codex needs schema *files*; Claude takes inline; one source for TS types |
| Process spawn | `cross-spawn`, `shell:false`, prompts via **stdin**; only `src/core/proc.ts` may import `child_process` | Windows shim safety, 8191-char limit, cross-platform |
| Harness substrate | Raw CLI spawn, no vendor SDKs; injectable `runner(argv, stdin)` → fixtures are recorded stdout files | Identical adapter shape; trivial offline tests |
| Config isolation | Flags only (`claude --setting-sources project --strict-mcp-config …`; `codex exec --ignore-user-config --ignore-rules …`). **Do not** redirect `CLAUDE_CONFIG_DIR`/`CODEX_HOME` (would break auth). Verified by a doctor canary (see R2) | Isolate without touching or losing global auth |
| Lint/format | Biome (one binary) | Minimal |
| CLI parsing | `node:util parseArgs` + manual subcommand dispatch | No dependency needed |
| Markdown / HTML parsing | `marked` lexer; `cheerio` | Flat tokens suffice for table/heading/ID extraction |
| DOCX / PDF / PPTX | `mammoth`, `unpdf`; **PPTX deferred** (no mature pure-JS reader) — fails clearly | Spec allows |
| TS execution | `tsc` → `dist/` built during setup (not committed); `bin/courseforge.mjs` launcher; `tsx` dev-only. No reliance on native type-stripping (22.12 floor). Pin TypeScript to the newest major with ≥ a few weeks of releases (TS 7.0 published the day of planning → start on ~6.x unless re-check shows 7.x stable) | Fresh-clone reliability |
| Pixel baselines | **None in v1.** Structural/programmatic visual checks + screenshots as reviewer evidence. (Later: component baselines generated only on `ubuntu-latest`) | Windows-dev vs Linux-CI baseline divergence |
| JSON vs Markdown | For twin-artifact stages **JSON is canonical; Markdown is rendered from it by code**. Human MD edits return via ingest + structural diff | No double authoring/drift |
| AI review at COURSE_BUILD | COURSE_MODEL / COURSE_BUILD / RELEASE are **deterministic-only**; spec-05 build `postReviewers` become deterministic validators; the AI final-course panel runs at COURSE_QA | Avoids paying twice for the same review; keeps build reproducible |
| Parallel implementation | Single working tree, **disjoint directory ownership**; coordinator alone edits `package.json`, root configs, Wave-0 interface files. Worktrees only if a conflict forces it (each needs its own ~350 MB install) | RAM/disk/OneDrive |

## 3. Step 0 — bootstrap import (first actions once execution is permitted)

1. `unzip -n` the ZIP **directly into the project root** (no nested dir); leave the ZIP in place untouched, add it to `.gitignore` (its contents are committed extracted). Verify with `sha256sum -c SHA256SUMS.txt`.
2. `git init -b main`; first commit = `.gitignore`, `.gitattributes` (`* text=auto eol=lf`, `*.ps1`/`*.cmd` crlf, binaries `-text`), bootstrap files verbatim (`chore: import bootstrap kit`). `git config --local core.longpaths true`.
3. Copy this plan to `docs/exec-plans/active/courseforge-v1.md`.
4. In Wave 0, `git mv` bootstrap material so it does not masquerade as runtime architecture (master §21): `specs/`, `templates/`, `agent-instructions/`, `tooling-sources/`, `MASTER_BUILD_PROMPT.md`, `README_START_HERE.md`, `OPUS_EXECUTION_HANDOFF.md`, `PACKAGE_MANIFEST.md`, `BOOTSTRAP_PACKAGE_QA.md`, `SHA256SUMS.txt` → `docs/bootstrap/` (kept verbatim as requirements of record; SHA list path-adjusted note). `examples/chemical-risk/` stays. The freed root `templates/` becomes CourseForge's own course templates.
5. Re-verify package versions/licences with `npm view` immediately before writing `package.json` (spec 12: do not pin stale versions).

## 4. Target repository structure

```
CourseForge/
├─ README.md  CLAUDE.md  AGENTS.md  LICENSE  THIRD-PARTY.md  CHANGELOG.md
├─ package.json  package-lock.json  tsconfig.json  biome.json  .npmrc(engine-strict)  .nvmrc  .node-version
├─ setup.ps1  setup.sh  courseforge.cmd  courseforge        # thin wrappers → node
├─ bin/courseforge.mjs                                      # plain-JS launcher → dist/cli
├─ scripts/  bootstrap.mjs  gen-schemas.ts  fresh-clone-smoke.mjs  fixtures-rekey.ts
├─ .github/workflows/ci.yml  nightly.yml
├─ .claude/  settings.json  rules/{architecture,courses,testing}.md  skills/<id>/SKILL.md  agents/cf-{author,reviewer,adjudicator,repairer}.md
├─ config/   stages.json tools.json skills.json reviewers.json routing.json fallbacks.json review-policy.json
├─ schemas/  *.schema.json                                  # generated from zod, committed, drift-tested
├─ prompts/  templates/*.md  rubrics/<reviewer>.md  classifiers/*.md
├─ src/      cli core environment pipeline artifacts routing harness ingestion review graphics renderer qa release
├─ components/course-ui/  tokens/ src/{primitives,blocks,assessment,shell,visuals,runtime} stories/ icons.ts
├─ .storybook/
├─ templates/  course.yaml  concept.md                      # new-course scaffolds
├─ tests/    unit/ integration/ e2e/ fixtures/{courses/smoke,courses/midsize,harness,findings,env,ingest} helpers/fakeHarness.ts
├─ docs/     architecture/ user-guide/ developer-guide/ exec-plans/{active,completed}/ bootstrap/
├─ examples/chemical-risk/                                  # regression fixture + lineage showcase
├─ vendor/LICENSES/
└─ courses/  <course-id>/ …                                 # per spec 11, plus artifacts.json, .lock
```

Course folder = spec 11 layout exactly, plus `artifacts.json` (single registry), `.lock`, `logs/tasks/`,
`review/findings/<stage>/c<cycle>/<reviewer>.json`, `versions/<label>/…`, `model/trace.json`, `model/build-manifest.json`.
The per-course `logs/environment.json` copy is **redacted** (versions/statuses only; no absolute paths, usernames, env values).

## 5. Dependencies and licence notes (versions as observed 2026-09-18; re-verify at install)

**dependencies:** `playwright` 1.63 (Apache-2.0; build-time render engine + QA), `mermaid` 12 (MIT; requires Node ≥22.12),
`@svgdotjs/svg.js` 3.2 (MIT), `vega` 6 + `vega-lite` 6 (BSD-3, ESM-only), `d3` 7 (ISC), `zod` 4 (MIT), `yaml` 2 (ISC),
`marked` 18 (MIT), `cheerio` 1.2 (MIT), `esbuild` 0.28 (MIT), `cross-spawn` 7 (MIT), `mammoth` 1.12 (BSD-2), `unpdf` 1.8 (MIT),
`axe-core` 4.13 + `@axe-core/playwright` (MPL-2.0 — executed only, never embedded in a course → no obligation).
**devDependencies:** `@playwright/test`, `vitest` 5, `typescript`, `tsx`, `@biomejs/biome`, `storybook` + `@storybook/html-vite` + `@storybook/addon-a11y` 10.x,
`lucide-static` (ISC), `@types/node`, `@types/cross-spawn`.
`engines.node: ">=22.12.0"`; `.nvmrc`/`.node-version` = `24`; exact pins via lockfile. Est. install ≈ 400–450 MB + Chromium ≈ 280 MB (shared cache, outside OneDrive).

**Inside a released course:** CourseForge's own JS/CSS, renderer *output* SVG (no licence burden), Lucide icon paths (ISC notice in an HTML comment + `release/licenses/lucide-ISC.txt`). Nothing else.
**Reference repos (study only):** `anthropics/skills` = Apache-2.0 except `docx/pdf/pptx/xlsx` skills (source-available — do not vendor); `anthropics/knowledge-work-plugins` Apache-2.0; `anthropics/claude-code` frontend-design skill is **all-rights-reserved → not vendorable**; write CourseForge-owned skills. shadcn/Radix/Excalidraw MIT, inspiration only. Small third-party skill repos listed in spec 12: not used. `THIRD-PARTY.md` + `vendor/LICENSES/` record everything; a test checks every lockfile top-level dep has a licence entry.

## 6. Shared core

### 6.1 Modules and dependency direction
`core` (types, zod schemas, ids, hash, `fsx` atomic-write/lock, `proc`, append-log) ← everything.
`routing` (pure; registries + `resolveExecutionPlan`) · `artifacts` (registry, versions, locks, drift, trace graph) ·
`harness` (interface, claude/codex/fake adapters, prompt assembly, backend select) · `review` (finding schema, pre-adjudication, repair-plan builder, reviewer pool) ·
`ingestion` (file adapters, stage heuristics, intake report) · `graphics` · `renderer` (pure) · `qa` · `release` (pure gate + reports) ·
`pipeline` (runStage, transitions, gates, compilers glue; imports all but cli/environment) · `environment` (doctor/setup) · `cli`.
**Boundary test:** `child_process` import outside `src/core/proc.ts` fails; string literals naming `claude`/`codex` binaries outside `src/harness/**` fail (BackendName union allowlisted).

### 6.2 Key types (abridged; full zod in `src/core/schemas.ts`)
- `Stage` = the 11 canonical stages (ordered); `StageStatus` = the 11 statuses of spec 02; `GateMode = auto|hybrid|human` (aliases `optional→auto`, `required→human`); `RiskTier = standard|elevated|high_stakes`; `IntakeMode = preserve|review-only|improve|rebuild`.
- `CourseManifest` (`course.yaml`): course{id,title,language,duration,risk_tier,risk_override?}, pipeline{start,target,agent_backend,backend_fallback,max_repair_cycles?}, human_review per stage, improvement{preserve_human_edits, default_import_mode}.
- `CourseState` (`state.json`): currentStage, targetStage, activeRunId, `canonicalArtifacts{logicalPath→ArtifactId}`, per-stage `{status, mode, planId, cyclesUsed, completedSteps[], gate, stale, failure, lastRunId}`.
- `ArtifactRecord` (in `artifacts.json`): every field from spec 03 — id, stage, path, logicalPath, version, label, producer{kind human|claude|codex|imported|courseforge, backendVersion, taskId, runId}, parents, schemaVersion, `sha256` hash (LF-normalised for text), timestamps, humanModified, approval, locked, `lockedIds[{id,hash}]`, reviewStatus, supersededBy, snapshotPath, notes, conflicts.
- **Locks:** whole-artifact (hash) + section locks by ID. JSON artifacts: region = object with that `id`, hashed as key-sorted canonical JSON. MD-only artifacts: `<!-- cf:id RS-03 -->` markers, region to next same/higher heading. `verifyLocks(before, after)` after every mutating step; mismatch → restore snapshot, fail `lock_violation`.
- **Versions:** plain copies under `versions/<slug>-v<N>-<event>/` (events: generated, imported, reviewed, repaired, human-edited, human-approved, build, qa-repaired, release). Restore = copy forward as N+1; history never rewound. `courseforge versions list|restore|select`.

### 6.3 State machine
Status transitions (trigger/guard) as designed by the architecture analyst: NOT_STARTED→INGESTED (ingest) · →VALIDATING (run/continue; plan saved, inputs canonical & not stale) · →GENERATING (generate/rebuild) or →REVIEWING (preserve/review-only/improve) · REVIEWING⇄REPAIRING (actionable plan, cycles<cap, no lock conflict; `cyclesUsed++`) · REVIEWING→APPROVED (auto, no blocking findings) or →WAITING_FOR_HUMAN (human/hybrid gate, cycle cap with `onCapReached=human`, lock conflict, low-confidence classification, upstream change on human-approved work) · WAITING_FOR_HUMAN→APPROVED/REVIEWING/REPAIRING/FAILED via `gate` verbs · APPROVED→LOCKED (snapshot + canonical pointer) · LOCKED→SUPERSEDED when upstream canonical hash changes (non-human artifacts only; human-approved ones open an `upstream_changed` gate instead of being replaced) · any in-flight→FAILED (retries exhausted / violation; snapshot restored).
Stage legality: `--from A --to B` needs idx(A)≤idx(B) and A's required inputs canonical; stages before an import stay NOT_STARTED; loop stops when B is LOCKED.
Resume: each step writes files keyed `(runId, cycle, step)`; `completedSteps` persisted after each; `continue` reloads the saved plan (re-resolves as revision r+1 only if input hashes changed), skips done steps, restores pre-step snapshot for an interrupted mutating step, reruns only missing reviewer outputs.
Concurrency: `courses/<id>/.lock` (`wx`, {pid,host,startedAt,cmd}; stale-pid steal is logged; else exit 5). Atomic write = temp + fsync + rename with EBUSY/EPERM/EACCES retry (5×, 50·2ⁿ ms) for OneDrive/AV. Only the parent process appends logs.

### 6.4 Generic stage loop (`src/pipeline/runStage.ts`)
`detectDrift` (human edits → new version + downstream invalidation) → `assertLegal` → **`resolveExecutionPlan` saved to `logs/execution-plans/<planId>.json` + decisions appended to `routing-decisions.jsonl` BEFORE any agent work** → validate inputs → generate (agent) or compile (deterministic), wrapped in `guarded()` → deterministic validators (failures become findings, source `validator`) → loop: reviewers via capped pool (3) → `preAdjudicate` (pure: dedupe by artifactId+location+category & token-Jaccard ≥0.8, severity=max, lock-conflict detection, stable sort) → AI adjudicator only if contradictions/evidence checks remain → `buildRepairPlan` (pure, byte-stable, `review/repair-plan.json`) → lock conflict ⇒ gate; no actions ⇒ exit loop; cap reached ⇒ gate or fail per policy; `human` mode ⇒ stop after report → repair agent (`guarded`) → validators → rerun reviewer subset via `rerunMap[category]` → … → human gate if mode≠auto → `approveAndLock`. Every step appends `step.start/step.end` to `logs/run-events.jsonl`.
`guarded()` = snapshot + hash-walk course dir (excluding `logs/`) before/after; any change outside `writablePaths`, or any tool outside `plan.tools`, → restore + `write_violation`; then `verifyLocks`. This (not CLI permission flags) is the hard guarantee that an agent cannot widen its bundle.
`runAgent()` = harness.run + zod parse + one retry with validation feedback on `schema_invalid` + bounded backoff for process/rate-limit/overloaded + backend fallback only when the failure class is in `fallbacks.backend.triggers` (new plan revision, rule `BACKEND-FALLBACK-001` logged).

### 6.5 What AI does vs what code does
| Stage | AI (semantic) | Code (deterministic) |
|---|---|---|
| CONCEPT | normalise concept, assumptions/gaps, classify `riskTier`/domains (closed enums) | scaffold `course.yaml`, apply gate floors |
| RESEARCH_BRIEF | author brief; 3 reviewers | required-sections validator |
| RESEARCH_DOSSIER | web research; write dossier + `sources.jsonl` + `claims.jsonl`; 5 reviewers | ID/citation integrity, URL syntax, **stable claim IDs minted** |
| INSTRUCTIONAL_DESIGN | author JSON; 5 reviewers | render MD; alignment/trace validators (LO verb allow/deny list, 4–6 LOs, every LO has content+formative+graded, disposition enum…) |
| STORYBOARD | author per-module JSON parts (avoids output-token limits); set visual archetype enums; 6 reviewers | merge parts, render MD, validators (IDs unique, no placeholders, answer keys, every LO assessed ≥2×, text equivalents, citations resolve…) |
| EDITORIAL | edit text fields only | **structural diff** (IDs, types, keys, citations set-equal, numbers, LO maps unchanged) + **polarity guard** (deleted `not only`/`rather than`/`never`/`unless`… ⇒ finding) |
| VISUAL_DIRECTION | choose bounded enums + rationale; 5 reviewers | expand tokens, contrast-check, component plan, route every visual |
| COURSE_MODEL | — | compile `course.json`, `trace.json`, `build-manifest.json` |
| COURSE_BUILD | only one VisualSpec content repair after a renderer failure | graphics, render, inline, smoke validators |
| COURSE_QA | 10-reviewer panel on extracted model + screenshots; adjudicate; repair | Playwright, axe, screenshots, regression |
| RELEASE | — | pure gate fn, reports, manifest, package |

The polarity guard is evidence-driven: the example's humanised storyboard turned "…not only the product classification" into "…the product classification alone" (GA-01, F1-01) and the defect shipped in the example HTML. It becomes a regression fixture.

## 7. Registries, deterministic router, execution plan

`config/*.json`, zod-validated at startup (`courseforge validate-config`); unknown enum/key ⇒ `RoutingError`, exit 2.
- `stages.json` — per stage: kind agent|deterministic, inputs{required,optional}, outputs, generator{role,promptTemplate,skills,tools,fanOut}, compiler, validators[], reviewers[], rerunMap, gateDefault, limits{taskTimeoutSec,stageTimeoutSec,maxTurns,processRetries}, writable/readOnly path templates.
- `tools.json` (renderer|asset|qa|agent-tool|parser + capabilities + doctor check), `skills.json` (path, stages, roles, maxBytes), `reviewers.json` (rubric, skills, tools, categories, inputs, needsScreenshots; learner-perspective reviewers present but disabled by default), `fallbacks.json` (renderer: 1 semantic repair then fallback chain, terminal `text_equivalent`; schemaRetries 1; process retries/backoff; backend{enabled,order,triggers,afterAttempts}), `review-policy.json` (maxRepairCycles 3, per-stage overrides, releaseBlockingSeverities blocker+critical, axeBlocking serious+critical, onCapReached, gateDefaults, `riskFloors` — high_stakes forces hybrid/human on research, design, storyboard, QA, release; lowering requires `risk_override: acknowledged`, recorded in the release manifest).
- `routing.json` — stage routes (`STG-<STAGE>-001`) and visual routes for **all 20 archetypes** (`VIS-<ARCHETYPE>-001`): mermaid→svgjs {PROCESS, TIMELINE, DECISION_TREE, CAUSE_EFFECT, SYSTEM_ARCHITECTURE, + SEQUENCE/STATE subtypes}; cf_svg→svgjs {LIFECYCLE, COMPARISON, BEFORE_AFTER, LAYERED_SYSTEM, RESPONSIBILITY_MAP, FEEDBACK_LOOP, CONTINUUM, MATRIX, EVIDENCE_MAP, FUNNEL, SCENARIO_MAP}; cf_svg→mermaid {HIERARCHY}; svgjs→cf_svg {LABELED_OBJECT}; svgjs→d3 {RELATIONSHIP_NETWORK}; vega_lite→d3 {QUANTITATIVE_CHART}; `VIS-QUANT-002` interactive-data d3→vega_lite; `VIS-ICON-001` lucide→cf_svg; `VIS-OVERRIDE-000` honours `rendererOverride` only if registered. Decorative/AI imagery: optional provider adapter interface only, omitted by default.
- `resolveExecutionPlan(input): ExecutionPlan` — **pure**. Plan carries: planId/runId/revision, transition, mode, backend{requested,selected,version,rule}, inputs{artifactId,path,hash}, generator/compiler, validators, reviewer TaskSpecs + concurrency, rerunMap, adjudicator, repairer, skills, tools, visualRoutes, fallbacks, humanGate{mode,source}, maxRepairCycles, writable/readOnly paths, expectedOutputs, limits, `decisions[]`, registryHashes.
- Semantic classification = structured agent task returning `{value: closed enum, confidence: high|medium|low, evidence[]}` (visual-archetype, import-stage, claim-category, risk-tier). Invalid → one retry → hard fail; `low` → gate. Code maps enum → tool.
- `routing-decisions.jsonl` record: `{ts,runId,planId,stage,kind,subject,input,selected,rule,fallback,reason}`.

## 8. Harness adapters

```ts
interface AgentHarness { name: 'claude'|'codex'|'fake';
  probe(): Promise<{available; version; authenticated: boolean|'unknown'; flags: string[]; detail}>;
  run(req: AgentTaskRequest): Promise<AgentTaskResult>; }
```
(Spec 02's `runTask`/`runStructured` merge into `run`; `supportsSubagents/ParallelWork` dropped — parallelism is N processes owned by CourseForge.) Request = spec 07 fields + runId/planId, `writeMode none|findings-only|artifact-write`, `network`, maxTurns. Result = ok, output, failure{class,retryable}, backend+version, model, usage/cost, duration, attempts, toolsUsed, promptHash, rawLogPath (`logs/tasks/<taskId>.{stdout,stderr}`).
Failure taxonomy: authentication_failed, rate_limit, overloaded, billing_error, invalid_request, model_not_found, server_error, max_output_tokens, timeout, schema_invalid, process_error, unknown.

**Claude adapter** (flags verified locally/in docs; adapter probes `--help` and only uses flags present — e.g. `--permission-prompts` needs ≥2.1.259, installed is 2.1.258):
reviewer → `claude -p --setting-sources project --strict-mcp-config --permission-mode dontAsk --tools "Read,Grep,Glob" --output-format json --json-schema <inline> --max-turns N --append-system-prompt-file <role> --no-session-persistence` (prompt on stdin, cwd = repo); generator/repairer → `--permission-mode acceptEdits --tools "Read,Grep,Glob,Write,Edit"` + `--settings '{permissions:{allow:[Write(<writable>/**)…],deny:[…]}}'`, `--output-format stream-json`, research tasks add WebSearch/WebFetch. Parse `.structured_output` / `is_error` / `subtype`; never trust exit code alone; exit 143 = timeout kill.
**Codex adapter:** `codex exec --ignore-user-config --ignore-rules --skip-git-repo-check --ephemeral -C <dir> -s read-only|workspace-write -a never --json --output-schema <file> -o <file> -` (stdin prompt); writable roots via `-C`/`--add-dir` (OS sandbox); parse JSONL events; missing `-o` file = hard failure. No `danger-full-access`, no `bypassPermissions`, ever.
**Fake adapter** (`tests/helpers/fakeHarness.ts`, also `COURSEFORGE_HARNESS=fake`): fixture key = (template, role, input hashes) — prose-independent; modes fail|invalid-json|timeout|slow(ms); records `calls[]`; missing fixture throws with the expected path. `COURSEFORGE_RECORD=1` wraps a real adapter, scrubs home paths/emails/token patterns, refuses to write if a secret pattern survives.
**Selection:** CLI flag → `course.yaml` → `auto` (first in `fallbacks.backend.order` that is available and not unauthenticated). Backend pinned per plan; switch only via new plan revision on a configured trigger; all logged. Never switch "because an answer was poor".
**Prompt assembly (provider-neutral):** role header + `prompts/templates/<t>.md` (`{{var}}` only) + routed skill bodies (frontmatter stripped) + input manifest (paths + hashes; agent reads files) + output contract. One generic reviewer template + one rubric file per reviewer (`prompts/rubrics/`). Rubrics/validators are distilled from example prompts 13/14 (deterministic checks → validators; judgement items → rubrics).
**Skills single-source:** `.claude/skills/<id>/SKILL.md` (heavy routed skills `disable-model-invocation: true`); Codex gets an index block in `AGENTS.md` pointing at the same paths; headless runs inline them. No copies. Skills: research-planning, research-authoring, research-review, instructional-design, alignment-review, storyboard-authoring, scenario-design, assessment-design, assessment-review, editorial-humanization, course-gap-analysis, fact-check, visual-direction, instructional-graphics, html-intake-review, accessibility-review, ui-review, ux-review. `.claude/agents/cf-*` exist for interactive use with least-privilege tools. Root `CLAUDE.md`/`AGENTS.md` ≤ ~80 lines each (map, non-negotiables, commands), AGENTS.md well under Codex's 32 KiB cap.

## 9. Traceability

IDs: regex `^[A-Za-z][A-Za-z0-9]*([-_.][A-Za-z0-9]+)*$`; **kind comes from the home artifact, never the ID text**, graph key `<kind>:<id>` — so imported example IDs survive verbatim (`AB-OHS-4`, `LO4`, `T3-07`, `F1-01`, `GA-15`, `V-07`; locator suffix `AB-OHS-4 s.21` resolves to the parent source). Minted defaults: `SRC-001`, `CLM-0001`, `RS-03`, `LO4`, `M4`, `M4-B07`, `FA-M4-02`/`GA-15`, `V-14`, `GL-012`, component `C-<blockId>`, element `cf-<blockId>`. Citation tokens carry `refKind external|internal` (example has `source dossier §8`).
Edges live in home artifacts (claim.sourceIds, lo.claimIds, block.{loIds,claimIds,sourceIds}, item.{loIds,blockIds,claimIds}, visual.sourceIds); `buildTraceGraph(courseDir)` derives on demand; snapshot to `model/trace.json` + release manifest. API/CLI: `courseforge trace --id X --direction up|down`, `trace impact --ids …` (record-hash diff of sources/claims → affected nodes/stages → stale marking + `impact-report.json`). Validators: TRACE-ORPHAN-LO, -UNASSESSED-LO, -UNTAUGHT-ITEM, -UNCITED-CLAIM, -DANGLING-REF (release-blocking), -DUP-ID, -UNUSED-SOURCE. HTML: `data-cf-block|lo|claim|source|visual` via one shared `blockAttrs()` helper; e2e asserts every model block ID is in the DOM. Evidence rules: no fabricated citations; claim `category` enum (law/regulation, scientific fact, statistic, version/currentness, guidance, scenario/synthesis) prevents guidance being restated as requirement; jurisdiction/currentness caveats propagate to `source-report.md`.

## 10. Ingestion and existing-artifact improvement

Adapters (`parse(bytes,name) → NormalizedDocument{format,title,text,headings,ids,links,json,html{embeddedData,scriptCount,interactionHints},warnings,lossy}`): md, txt, html, json, docx (mammoth), pdf (unpdf). PPTX/other binaries fail clearly. Originals → `input/originals/<hash12>-<name>`, read-only, hash re-verified at each run and in the release gate.
Stage inference: deterministic `scoreStages(doc)` first (signals catalogued from the example: brief = single fenced block + ALL-CAPS sections; dossier = claim-to-source matrix + annotated bibliography + bracket citation tokens; design = `### LO\d`, disposition/alignment matrices; storyboard = `Block ID`+`Complete learner-facing content` headers, item tables; editorial = storyboard + structural identity with a known parent; QA report; HTML = `const COURSE = {` / `application/json` script). Accept at score ≥0.7 & margin ≥0.2; else AI enum classifier; `low` → gate or `--conservative` review-only. A declared `--stage` is intent, still validated.
Modes: preserve (validators only) · review-only (full panel, report, no edits) · improve (panel → adjudicate → repair) · rebuild (import is read-only source; regenerate). `input/intake-report.json`: originals, declared/inferred stage, contract gaps, IDs found, warnings, lossy, next legal targets.
Storyboard MD parser handles the example's 10-column tables (inline HTML-in-MD, prose `Correct answer` parsed per interaction mode, LO ranges, semicolon citation lists) → `storyboard.json`.
**Existing HTML:** preserve → cheerio parse → model reconstruction: (1) embedded data (`const COURSE = …` / JSON script) first — the example yields a complete model (133 screens, 39 interactions, 38 refs, 29 glossary, 9 acronyms, 20 visuals, 11 modules: exact-equality regression assertions); (2) DOM heuristics fallback (`lossy:true` accepted) → browser-run via heuristic crawler (§14) → axe → screenshots → reviewer panel (fact/gap/instructional/assessment/UI/UX/a11y) → adjudicate → repair target `model-source` (patch model, rebuild through CourseForge components = the real "improved copy") or `html-direct` (edit a copy when no model) or `tooling-defect` → regression → before/after report. Known example defects become expected findings: zero real SVG (CSS boxes from a hard-coded switch), alt text containing authoring instructions, `aria-live` on the whole screen host, missing focus styles, drawer without focus trap, `GA-15`-special-cased results, fuzzy `norm()` grading, negation corruption.

## 11. Review, adjudication, repair, human gates

Finding schema = spec 04 fields + `source reviewer|validator|qa`, `status open|accepted|rejected|fixed|waived`, `mergedFrom[]`. Reviewers are findings-only (`writeMode findings-only`, read-only tools); each gets only its rubric + needed inputs. Panels per spec 04 (research 5, design 5, storyboard 6, visual 5, final course 10). Deterministic vs AI adjudication split as §6.4. Repair agent receives only canonical artifact + approved plan + needed evidence + stage contract; out-of-plan or locked-region edits are rejected by `guarded()`/`verifyLocks`. Cap 3 (configurable per stage); on exhaustion: unresolved findings emitted, all intermediates preserved, gate or FAILED per `onCapReached`.
Gates: `GateState{mode,status,reason policy|high_stakes|cycle_cap|lock_conflict|low_confidence|upstream_changed, reportPath, comments[], findingDecisions{}}`; effective mode = max(policy, course.yaml, risk floor). Paused runs exit 10; `continue` resumes. Human actions → CLI: `gate approve|reject [--abort|--instructions]|comment|lock --ids|unlock|rereview`, `findings list|accept|reject`, `ingest --replace` (edit externally + re-ingest/replace; hash drift auto-detected → `human-edited` version), `versions select`. Human-approved/locked content is authoritative; evidence conflicts surface as `conflicts[]` + gate, never silent rewrite.

## 12. Visual system, components, graphics, HTML compiler

- **Tokens:** DTCG 2025.10 JSON per family (all six families defined and contrast-validated; scientific/clinical, corporate/professional, technical/industrial get full story coverage first) → own small compiler → CSS custom properties in `@layer cf.tokens, cf.base, cf.components, cf.utilities`. VISUAL_DIRECTION agent picks only `{family, accentHue(15° steps), density, corner, typeScale, figureStyle}`; code validates, computes WCAG contrast matrix for light+dark (`contrast.ts`), clamps deterministically, logs to build report. System font stacks in v1 (font embedding = licence-gated opt-in later). Light/dark via `prefers-color-scheme` + `data-cf-theme`.
- **Components** (`components/course-ui`): contract `CfComponent<P> = {schema, render(p): string, behavior?}` — pure build-time render functions + a small vanilla runtime hydrating `[data-cf-behavior]`; no framework runtime, no shadow DOM. Full spec-08 list: shell/header/menu/progress, module landing, content/concept, technical depth, evidence/law/guidance callout, warning/qualification/misconception, comparison, process/timeline/lifecycle figure, scenario/decision, single choice, multiple response, matching, categorization, sequencing (keyboard-first; drag is enhancement only), feedback/rationale, assessment shell/results/review, glossary/acronym, citation/source panel, reference library. Pure `grade()` per item type. Story matrix: viewport 375/768/1440 × short/long/dense × default/focus/correct/incorrect/disabled; addon-a11y. Vitest: snapshot + grade tables + axe on rendered strings (cheap per-component a11y gate).
- **Runtime:** hash router `#/s/<screenId>` (works on `file://`), plain store, `cf:<courseId>:<schemaVersion>` localStorage with in-memory fallback, focus to screen `<h1 tabindex=-1>` + one persistent `role=status` announcer (not a live screen container), native `<dialog>` for glossary/references/citations/mobile nav, in-page confirm (no `window.confirm`), branching scenarios as a build-validated screen graph, reduced motion, print linearisation, `window.__cf` QA contract (`go, getState, screenCount, screen`), CSP meta with build-computed hashes + `connect-src 'none'`. Budgets: JS ≤40 KB, CSS ≤25 KB, total release ≤1.5 MB (gate).
- **Graphics:** `VisualSpec{id,purpose,archetype,content|data,sourceIds,textEquivalent{short,long},interaction,rendererOverride?}`; textEquivalent required and linted (rejects authoring-instruction strings such as `^Alt text|^Create original`). One persistent Playwright page hosts Mermaid (`htmlLabels:false`, `securityLevel:'strict'`, `deterministicIds`, token-derived `themeVariables`), SVG.js, D3, and batched text measurement; Vega-Lite headless in Node. First native archetypes: process-band, lifecycle, comparison, hierarchy, layered system, responsibility map, continuum, matrix; remaining archetypes route to mermaid/svgjs until their native builder lands (routes already fixed). Shared post-process: `cf-<visualId>-` id prefixing, strip scripts/handlers/external refs, `role=img` + `<title>/<desc>` + linked long description, viewBox-only sizing, palette → `var(--cf-viz-n, #hex)`. In-page visual QA (text bbox clipping/overlap, min font size, contrast). Bounded loop: render → fail → one semantic repair → fail → fallback renderer → fail → structured `text_equivalent` block; every hop logged.
- **Compiler:** `course.json` (zod) → tokens → route+render visuals → render components → esbuild bundle runtime/CSS → inline; data in `<script type="application/json">` with `<` escaped; deterministic output (sorted keys, no body timestamps, seeded ids) → byte-identical rebuild test. `build/build-report.json`: input hashes, direction values, per-visual {archetype, renderer, fallbackUsed, repairs, bytes}, contrast results, coverage counts, size breakdown, output sha256. Dev build = external assets + sourcemaps; release = inlined/minified.

## 13. Setup, doctor, CLI

- `setup.ps1` (PS 5.1-safe, UTF-8 BOM, `Unblock-File` for ZIP-extracted scripts) / `setup.sh` (POSIX, mode 100755): find Node, compare major.minor in-shell, print exact install command (`winget install OpenJS.NodeJS.LTS` / `brew install node@24` / fnm) and exit 2 if missing/old; else `node scripts/bootstrap.mjs "$@"`. Never installs system software silently, never touches PATH/global config.
- `scripts/bootstrap.mjs` (dependency-free; idempotent, fingerprinted steps in `.courseforge/state.json`): detect env (cloud-sync path, RAM, disk, long paths) → `npm ci` (skip if lock hash unchanged; retry ×3 on EPERM/EBUSY/ENOTEMPTY) → Playwright Chromium into the **shared default cache** (never repo-local inside OneDrive; fallback `channel: msedge|chrome` recorded as a warning) → `tsc` build → validate config/schemas/skills frontmatter → **smoke fixture** (build one screen → render one diagram → launch Chromium → one interaction → axe → screenshot → verify) → write `.courseforge/environment.json` (gitignored) → print `READY` only if smoke passes. Flags: `--ci --no-smoke --repair --json --offline --browsers=shared|local|system`.
- `doctor`: check catalogue (os, ram≥2 GB advisory, disk, node, npm, git, git.longpaths [repairable, `--local` only], autocrlf advisory, **path.cloudsync warn**, deps.lock, pw.package, pw.chromium, pw.deps [Linux sudo = manual boundary], gfx libs importable, axe, storybook env, claude/codex cli + auth presence (no model call, never read credential contents) + **globalconflict warn**, project skills/agents/AGENTS.md, schemas compile, registries validate, writable dirs). Classification ready|repairable|manual; `--repair` fixes repo-local issues only; human + `--json` output; optional live **canary** (`doctor --live`): tiny structured task per backend asserting clean schema-valid JSON — proves isolation from global hooks/plugins.
- CLI (all `--json`; exit codes 0 ok, 1 internal, 2 usage/config, 3 env/backend, 4 validation/release blocked, 5 course locked, 10 waiting for human, 11 stage failed): `setup`, `doctor`, `validate-config`, `new`, `ingest`, `run --from --to --backend --gate`, `continue`, `review`, `improve`, `status`, `gate …`, `findings …`, `versions …`, `trace`, `build`, `qa`, `release`, `package` (zip course folder), `clean` (allowlisted generated paths only; never course sources/originals/outside repo). Invocation without global install: `npm run <cmd>`, `npx courseforge`, `.\courseforge` / `./courseforge` wrappers.

## 14. QA engine and release gate

- `src/qa/runner.ts` (contract-driven, CourseForge-built courses): traverse all screens; per interaction drive correct path from the model's key and a mutated incorrect path; scoring all-correct/all-wrong/mixed; menu/nav via real controls + `__cf.go` for speed; glossary/references/citations; progress persist + reset; **offline** (`page.route` abort of non-`file:`/`data:` → zero blocked requests); console/page errors; overflow/horizontal-scroll/clipping detectors; keyboard-only traversal + observable focus; axe per screen (wcag2a/aa/21aa), serious/critical block; screenshots 1440/768/390; `reducedMotion: 'reduce'`.
- `src/qa/crawler.ts` (arbitrary imported HTML): discover advance/back/menu/form/dialog controls by role + accessible name; state hash (location.hash + normalised main text + visible control names); bounded BFS (maxStates 200, depth 40, 10 min); reports reachability/errors/a11y, not answer correctness.
- Profiles: `dev` (1440, functional all screens, axe on representative sample, ~3–4 min) vs `release` (all screens × 3 viewports functional, axe all @1440 + sample @390, ~20 min on this machine). Workers = 2, one browser reused. Reports: `review/functional-tests.json`, `accessibility-review.json`, `screenshots/manifest.json`, plus spec-03 S9 file set.
- **Release gate** = pure `gate(findings, deterministic reports, required artifacts, citation integrity, policy) → {decision, reasons[{code, findingIds, detail}]}`. Blocks on open blocker/critical findings (unless human-accepted), axe serious/critical, functional failure, missing artifacts, dangling/unresolved citations, unresolved lock conflicts, exhausted cycles with blockers, originals hash mismatch. Outputs `release/course.html`, `qa-report.md`, `source-report.md`, `release-manifest.json` (hashes, backend/versions, trace coverage, risk overrides, tool versions).

## 15. Test architecture and requirement-to-test mapping (spec 10)

vitest (unit+integration, v8 coverage: routing 90, pipeline/review 85, artifacts/environment 80, harness 75, renderer/graphics 60, qa 50, global floor 70) + `@playwright/test` (e2e; projects desktop-1440/tablet-768/mobile-390). Test titles carry acceptance tags (`@C6`) so `npm run test:acceptance` = the spec-10 suite and the mapping is queryable. **No test requires a live agent** except opt-in B7. Fixtures: `courses/smoke` (6 screens: every interaction family, Mermaid + native SVG + Vega-Lite, citations, glossary, references, graded 3-item assessment, optional screen, reset), generated `courses/midsize` (~30 screens), recorded harness outputs (Claude JSON, Codex JSONL, failure cases), overlapping findings sets, env probes, chemical-risk artifacts (read from `examples/`). Scripts: `test`, `test:unit`, `test:integration`, `test:e2e`, `test:acceptance`, `smoke`, `smoke:clean`, `typecheck`, `lint`, `doctor`, `coverage`, `storybook`, `gen:schemas`.

| ID | Requirement | Test (under `tests/`) |
|---|---|---|
| A1 | setup detects prerequisites | unit/env/preflight — injected probes → manifest |
| A2 | lockfile install | CI `npm ci` |
| A3 | Chromium installed if missing | integration/env/browser-install (spawn stubbed) |
| A4 | config validates | unit/config/schema — all registries valid; corrupt fixture rejected with path |
| A5 | no global plugin/skill needed | unit/env/no-global-writes (source scan) + fake-harness pipeline runs with empty HOME |
| A6 | doctor machine + human output | integration/cli/doctor — `--json` matches schema; text has READY/REPAIRABLE/MANUAL |
| A7 | smoke fixture executes | e2e/smoke.spec + CI |
| B1 | availability/version | unit/harness/detect — version fixtures incl. garbage |
| B2 | command construction | unit/harness/command — TaskRequest→argv inline snapshots, path rules, flag-probe gating |
| B3 | structured-output parsing | unit/harness/parse-claude, parse-codex — JSON/JSONL, truncated, stderr-interleaved |
| B4 | provider selection configurable | unit/harness/select |
| B5 | failures classified + logged | unit/harness/errors — taxonomy table |
| B6 | no provider calls outside adapters | unit/arch/harness-boundary |
| B7 | optional live tests | e2e/live-smoke (skipped unless `COURSEFORGE_LIVE=1`; secrets-gated, never forks) |
| C1 | legal transitions | unit/pipeline/transitions (table-driven) |
| C2 | concept → stop at any stage | integration/pipeline/run-range (fake) |
| C3 | start from imported research/design/storyboard/HTML | integration/pipeline/resume-import (4 fixtures) |
| C4 | `continue` resumes | integration/pipeline/continue — kill mid-run, no duplicate steps |
| C5 | locked canonical not silently replaced | integration/pipeline/locks — hash equality + conflict emitted |
| C6 | retry limits | integration/pipeline/retry-limit — always-fail → exactly 3 cycles |
| C7 | human-gate state | integration/pipeline/gates — auto/human/hybrid × approve/reject/lock/comment |
| C8 | versions/superseded tracked | unit/artifacts/versions |
| D1 | stage→skill/tool/reviewer map | unit/routing/router (snapshot per stage) |
| D2 | visual-type routing | unit/routing/visual-router (all 20 archetypes + override) |
| D3 | deterministic logged fallbacks | same — identical input twice ⇒ identical plan + decision log |
| D4 | unknown enum/config fails safely | same — throws RoutingError |
| D5 | plan saved before agent work | integration/pipeline/plan-first — fake asserts plan file exists at call time |
| D6 | agent cannot expand tool bundle | unit/routing/tool-policy + integration/pipeline/write-violation (fake writes outside → rollback + failure) |
| E1 | concurrent reviewers | integration/review/concurrency — slow(150 ms) ×5, interval overlap + await-all order |
| E2 | finding schema validation | unit/review/finding-schema |
| E3 | adjudicator dedupe/merge | unit/review/adjudicator (overlap fixtures, mergedFrom) |
| E4 | repair plan schema-valid | unit/review/repair-plan |
| E5 | repair leaves locked content | integration/review/repair-locks — malicious repair rejected, hashes equal |
| E6 | post-repair validation reruns | integration/review/repair-cycle (call log) |
| F1 | course self-contained | unit/artifacts/containment — all writes under `courses/<id>/` |
| F2 | originals preserved | integration/ingest/preserve (byte hash) |
| F3 | manifests hashes/provenance | unit/artifacts/manifest (+ CRLF normalisation case) |
| F4 | chemical-risk artifacts ingest | integration/ingest/chemical-risk — stage classifier on all 8 files + storyboard counts 94/24/15 |
| F5 | IDs/relationships persist | integration/pipeline/id-lineage + unit/artifacts/trace |
| G1–G2 | build completes; single file | integration/render/build; unit/render/single-file (no external src/href/runtime) |
| G3 | offline | e2e/course/offline |
| G4 | expected block/item IDs | integration/render/ids |
| G5–G6 | interactions; scoring | e2e/course/interactions, scoring |
| G7–G8 | glossary/references; progress/reset | e2e/course/resources, progress |
| G9 | no blocking console errors | shared e2e collector fixture |
| H1–H3 | Mermaid / native+SVG.js / Vega-Lite compile | integration/graphics/{mermaid,native-svg,svgjs,vega} |
| H4 | fallback routing | unit/routing/visual-router + integration/graphics/fallback (forced renderer failure → fallback → text_equivalent) |
| H5 | text equivalents | unit/graphics/text-equivalent (incl. authoring-instruction lint) |
| H6 | no Mermaid/Vega runtime in release | unit/render/single-file |
| I1–I8 | browser QA capabilities | e2e/course/*.spec driving `src/qa` on smoke + midsize; unit tests for detectors |
| J1–J2 | axe runs; serious/critical block | e2e/course/a11y; unit/release/gate |
| J3–J4 | keyboard nav; focus observable | e2e/course/keyboard |
| J5 | drag-only prohibited | unit/render/no-drag-only + schema forbids drag-only interaction |
| J6 | visuals have text equivalents | H5 + e2e DOM assertion |
| K1–K3 | ingest example HTML; browser-run; intake report | integration/ingest/html-intake (exact counts); e2e/existing/crawl |
| K4–K5 | review findings; repair plan | integration/review/existing-html (recorded findings) |
| K6–K7 | improved copy; regression rerun | integration/improve/transform; e2e/existing/regression (no new failures, original hash unchanged) |
| L1–L2 | README sections; setup docs | unit/docs/readme |
| L3 | licences/attributions | unit/docs/licenses |
| L4 | no secrets / absolute paths | unit/repo/hygiene (regex scan incl. fixtures) |
| L5 | CI runs gates | `.github/workflows/ci.yml` |
| L6–L7 | docs coherent; sample fixture shows value | unit/docs/links; A7 + committed smoke release |

## 16. CI, docs, release

CI (GitHub Actions): lint+typecheck (ubuntu/Node 24, required) · unit+integration matrix ubuntu/windows/macos × Node 22/24 (ubuntu-24 + windows-24 required) · e2e smoke+midsize (ubuntu required, windows optional) with Playwright cache keyed on lockfile version, `npx playwright install --with-deps chromium` · nightly: chemical-risk full QA, Storybook build, fixture-shape drift, optional live smoke (secrets, never on forks). PR critical path ≈ 15 min.
Docs: README (what/why, screenshots, architecture + pipeline Mermaid diagrams, install, quick start, lifecycle, any-stage ingestion, review modes, Claude/Codex, deterministic routing, graphics, QA model, example walkthrough, troubleshooting incl. OneDrive, limitations, contributing); `docs/architecture/*` (state machine, router, harness, traceability, ADRs for every §2/§18 deviation); `docs/user-guide/*`; `docs/developer-guide/*` (dependency upgrade policy, fixture recording, adding a reviewer/archetype/component). LICENSE (MIT proposed — confirm at publish), `THIRD-PARTY.md`, CHANGELOG. Example-content redistribution review recorded (analyst found paraphrase-only, no long verbatim standards text; WHMIS pictograms/protected figures blocked by visual policy).

## 17. Phases, parallel waves, ownership, checkpoints

Machine limits: ≤3 implementation subagents at once; the coordinator alone runs cross-cutting tests, serially; never run e2e while agent pools run.

| Wave | Streams (owner dirs) | Exit checkpoint (spec 14) |
|---|---|---|
| 0 — coordinator, serial | Step 0; `package.json`, tsconfig, biome, vitest/playwright configs; `src/core/*`; `src/harness/types.ts`; `src/renderer/model.ts` (CourseModel, VisualSpec); `src/review/finding.ts`; `config/*` skeletons; `scripts/gen-schemas`; `tests/helpers/fakeHarness.ts`; boundary test; bootstrap `git mv` | **CP1** `npm run typecheck && vitest run tests/unit/core` |
| 1 — parallel | **A** `src/{routing,artifacts}`, `config/`, `schemas/` · **B** `src/{cli,environment}`, setup scripts, `bin/`, `scripts/bootstrap.mjs` · **C** `src/harness`, `prompts/templates` scaffolding, recorded fixtures · **E1** `components/course-ui` tokens + primitives + runtime, `.storybook` | **CP1** (router/artifacts units) · **CP2** `node bin/courseforge.mjs doctor --json` exit 0 · **CP3** `vitest run tests/unit/harness` |
| 2 — parallel | **D** `src/{pipeline,review,ingestion}` + gates (needs A, C) · **E2** `src/{graphics,renderer}`, remaining components, compiler, smoke + midsize fixtures · **F** `src/qa`, `tests/e2e` (starts on example HTML crawler, then smoke build) | **CP4** fake concept→release + groups C–F · **CP5** build integration · **CP6** `playwright test` on fixture course |
| 3 — parallel | **D′** skills, rubrics, prompt templates, stage validators distilled from prompts 13/14, polarity guard · **K** existing-HTML intake/improve flow (D+F) · **G** docs, CI, licences, `.claude/*`, `AGENTS.md`, `CLAUDE.md` | **CP7** chemical-risk intake/improve e2e |
| 4 — coordinator | setup smoke wiring; `scripts/fresh-clone-smoke` (temp clone **outside OneDrive**, run twice for idempotency, PS 5.1 + Git Bash); D3 renderer + remaining native archetypes (5b); `doctor --live` canary + optional live smoke per backend (budget/turn-capped tiny concept); **showcase run**: import `05_storyboard_humanized.md` in `improve` mode → release, demonstrating the negation-corruption catch and visibly stronger output than the example (needs backend auth); final docs/screenshots | **CP8** fresh-clone READY · **CP9** `npm run ci` green, acceptance suite passes |

At every checkpoint: typecheck + lint + full unit/integration; fix before launching the next wave. Deviations get an ADR + a line in the active plan.

## 18. Proposed alterations / deferrals vs the specs (with rationale)

1. **No Mermaid CLI** — in-page Mermaid render via Playwright (one Chromium, low RAM, deterministic). Capability requirement (Mermaid → inline SVG) fully met.
2. **SVG.js runs in-browser at build time**, native archetypes are pure TS — no `svgdom`.
3. **COURSE_MODEL/COURSE_BUILD/RELEASE deterministic-only**; build-stage AI reviewers folded into validators + the COURSE_QA panel.
4. **JSON canonical, Markdown rendered** for twin artifacts.
5. **Single `artifacts.json` registry** instead of sidecars; **plain-copy snapshots**.
6. **Harness interface simplified** (`probe` + `run`); parallelism by CourseForge-managed processes (cap 3), not native subagents, in headless mode. Native subagents remain available for interactive Claude use via `.claude/agents`.
7. **Gate vocabulary** unified to auto/hybrid/human (legacy `optional/required` accepted).
8. **Classifier confidence** is a 3-value enum.
9. **`text_equivalent` terminal fallback** on every renderer chain (a figure never ships broken).
10. **No pixel-baseline visual regression in v1.**
11. **Phased, architecture intact:** PPTX ingestion; AI image provider (interface only); learner-perspective reviewers (registered, disabled); 3 of 6 families get full story polish first (all 6 defined/validated); ~8 native archetype builders first (all 20 routed); D3 renderer in Phase 5b; SCORM/xAPI extension point only (spec non-goal).
12. **Registry filenames** follow spec 11 (`stages.json`, `tools.json`…) rather than spec 05's `*-registry.json`; plus `review-policy.json`.
13. **Biome** instead of ESLint+Prettier; **parseArgs** instead of a CLI framework; **zod→JSON Schema** instead of hand-written schemas.

## 19. Assumptions, risks, unresolved items

| # | Risk / assumption | Mitigation |
|---|---|---|
| R1 | Repo path is under the OneDrive folder. **User confirmed (2026-09-18) OneDrive sync is disabled**, so the repo stays in place and sync locking/churn is not expected on this machine | Decision: build in the current folder. Keep the cheap generic safeguards because other cloners may have sync enabled: npm retry/backoff, atomic-write retries, browsers + temp clones outside the repo, doctor `path.cloudsync` **advisory** (warn only). If EPERM/EBUSY appears anyway, check whether sync was re-enabled before debugging further. CourseForge never moves the repo or edits OneDrive settings |
| R2 | Global hooks/plugins/AGENTS.md leak into spawned agents; exact effect of `--setting-sources project` on user CLAUDE.md memory and of `--ignore-user-config` on `~/.codex/AGENTS.md` **unverified** | Verify in stream C with a no-cost `--help`/dry inspection then `doctor --live` canary; if leakage remains, add explicit counter-instruction header + (Claude) `--system-prompt-file` full override; document. Never modify global files |
| R3 | `claude auth status` says not logged in for CLI | Manual boundary: user runs `claude` login once; everything except live smoke/showcase works without it (Codex is authenticated) |
| R4 | CLI flag drift (`--permission-prompts` ≥2.1.259; hidden `--max-turns`) | Adapter probes `--help`, gates flags, records CLI version in plan/provenance; nightly fixture-shape drift job |
| R5 | Claude write-scoping is permission-rule based, not sandboxed | `guarded()` hash-walk + snapshot rollback is the enforcement; e2e violation test |
| R6 | 1.7 GB free RAM | One Chromium, QA workers 2, agent pool ≤3, no overlap, Storybook off the critical path; doctor RAM advisory |
| R7 | Large structured outputs hit token limits | Per-module fan-out; artifact-write mode with small JSON receipts; validate files on disk |
| R8 | Strict-schema subset differs per backend | Flat-schema lint test on every agent-facing schema |
| R9 | Package versions observed today may shift (TS 7.0 just released, Mermaid 12, Vitest 5, Storybook 10) | Re-verify at Step 0.5; pin via lockfile; upgrade policy documented |
| R10 | Live end-to-end generation of a full 2-hour course is long/costly | Definition of done relies on fixtures + fake harness; live = tiny capped smoke + one showcase improve-run; budget/turn caps in every TaskSpec |
| R11 | Example content redistribution in a public repo | Analyst review: paraphrased, low risk; keep under `examples/` with authorship note; final check before publishing; screenshots optional |
| A1 | Licence of CourseForge itself assumed MIT; public GitHub remote not yet created | Confirm at publish time; nothing is pushed without the user's instruction |

## 20. Verification (end-to-end)

1. `.\setup.ps1` in the working folder → `READY`; rerun → all steps skipped (<10 s).
2. `npm run typecheck && npm run lint && npm test` (unit+integration, fake harness) → green; `npm run test:acceptance` lists every A–L tag as covered.
3. `npm run test:e2e` → smoke + midsize courses: traversal, interactions, scoring, offline, axe, keyboard, screenshots at 3 viewports.
4. `.\courseforge new "Smoke topic" --to RELEASE` with `COURSEFORGE_HARNESS=fake` → full course folder, execution plans, routing log, release manifest; `status`, `trace --id`, `versions list` behave.
5. `.\courseforge ingest examples\chemical-risk\06_interactive_course.html --stage COURSE_BUILD --course chem-demo --mode improve` → original preserved (hash), intake counts 133/39/38/29/9/20/11, crawler + axe reports, findings, repair plan, improved copy, regression report.
6. Human-gate drill: `run --gate human` exits 10 → `gate lock --ids …` → `gate approve` → `continue`; locked hashes unchanged after a repair cycle.
7. `node scripts/fresh-clone-smoke.mjs` (temp clone outside OneDrive; PowerShell 5.1 and Git Bash) → `READY`.
8. Optional (needs auth): `doctor --live` canary for both backends; showcase improve-run on the chemical-risk storyboard; visual comparison against `examples/chemical-risk/screenshots/`.
9. UI verification of built courses and Storybook with the Playwright MCP tools (navigate, snapshot/screenshot) per the user's standing tool rules, in addition to the automated suite.
