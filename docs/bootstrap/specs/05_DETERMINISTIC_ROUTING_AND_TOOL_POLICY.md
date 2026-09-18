# 05 — Deterministic Routing and Tool Policy

## Principle

The model should not freely decide which installed tool, plugin, skill, reviewer, or renderer to use when a deterministic rule can decide.

Use a pipeline:

```text
semantic classification (AI only where needed)
→ validated controlled enum
→ deterministic rule lookup
→ resolved execution plan
→ agent/tool receives only approved capabilities
```

## Registries

Create machine-readable registries under `config/`, for example:

```text
config/tool-registry.json
config/skill-registry.json
config/reviewer-registry.json
config/stage-registry.json
config/routing.json
config/fallbacks.json
```

These are validated at startup.

## Execution plan

Before a stage runs, the core emits and stores an execution plan containing:

- course/run ID;
- source artifact IDs/hashes;
- start and target stages;
- selected agent harness;
- required skills;
- required tools/renderers;
- required reviewers;
- human-gate policy;
- deterministic validators;
- fallback rules;
- output paths;
- timeout/retry policy.

The harness cannot silently add unrelated plugins/tools.

## Stage routing example

```json
{
  "COURSE_BUILD": {
    "skills": ["course-html-builder", "frontend-design", "instructional-graphics"],
    "tools": ["mermaid", "svgjs", "vega-lite", "d3", "lucide"],
    "postReviewers": ["content-integrity", "visual", "ux", "accessibility", "functional"]
  }
}
```

## Visual routing

Recommended deterministic visual policy:

| Classified visual type | Primary renderer | Fallback |
|---|---|---|
| flow/process | Mermaid | SVG.js/native SVG |
| timeline | Mermaid | SVG.js/native SVG |
| sequence | Mermaid | SVG.js/native SVG |
| state diagram | Mermaid | SVG.js/native SVG |
| lifecycle/loop | CourseForge native SVG archetype | SVG.js |
| comparison | CourseForge native SVG archetype | SVG.js |
| hierarchy | native archetype or Mermaid | SVG.js |
| responsibility map | native SVG archetype | SVG.js |
| conceptual system map | SVG.js/native archetype | D3 if genuinely data-driven |
| standard quantitative chart | Vega-Lite | D3 |
| advanced/custom interactive quantitative visual | D3 | static SVG/Vega-Lite |
| icon | Lucide controlled mapping | native SVG |
| decorative/scene illustration | optional image provider | omit/structured visual |

D3 is not the default for simple diagrams. AI-generated raster imagery is optional and must never be required for core operation.

## Fallback behavior

Fallbacks are bounded and logged. Example:

```text
Mermaid render
→ visual QA fail
→ one semantic/layout repair
→ render
→ second fail
→ router switches to SVG.js
```

Do not let an agent endlessly experiment.

## Skills/context policy

- Keep root `CLAUDE.md` and `AGENTS.md` short; they are maps, not encyclopedias.
- Put task-specific knowledge in on-demand skills/rules/docs.
- For Claude Code, use project-scoped skills/agents and disable model invocation for heavy explicitly-routed skills when appropriate.
- For Codex, keep root instructions concise and put detailed specs under `docs/`/`specs/` referenced by `AGENTS.md`.
- Subagents receive only task-relevant context and skills.

## Routing logs

Every routing decision should be append-only logged, e.g.:

```json
{"run":"RUN-12","artifact":"VIS-14","capability":"timeline","selected":"mermaid","rule":"VIS-TIMELINE-001","fallback":false}
```

This is important for portfolio explainability and reproducibility.

