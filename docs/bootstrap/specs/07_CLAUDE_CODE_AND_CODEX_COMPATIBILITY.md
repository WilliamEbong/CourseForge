# 07 — Claude Code and Codex Compatibility

## Shared-core rule

Do not create a Claude implementation and a separate Codex implementation of the pipeline. CourseForge owns the stages, schemas, tool routing, review policy, logging, and file layout. Harness adapters only translate a standardized task into the native CLI/instruction mechanisms.

## Claude Code integration

Use project-scoped capabilities rather than relying on user-global configuration:

```text
CLAUDE.md
.claude/settings.json
.claude/rules/
.claude/skills/
.claude/agents/
```

Keep `CLAUDE.md` concise, ideally well under 200 lines. It should point to system-of-record docs/specs rather than duplicate them.

Use isolated subagents for context-heavy independent work and parallel reviewer panels. Skills should be on-demand; heavy explicitly-routed skills should not be unnecessarily visible in every context.

The Claude adapter should support non-interactive/structured operation where stable enough, while allowing interactive human-gated use. It must capture exit status, logs, structured outputs where requested, and generated files.

## Codex integration

Use a project-root `AGENTS.md` as the concise map of project instructions. Avoid placing the entire system specification inside it. Codex reads hierarchical `AGENTS.md` instructions, so use nested files only when directory-specific constraints are needed.

The Codex adapter should use the current non-interactive `codex exec` interface for programmatic tasks when appropriate, including machine-readable JSONL and output-schema features where they improve reliability.

Current Codex supports parallel subagents; CourseForge should still coordinate task ownership and prevent concurrent writes to the same files.

## Provider-neutral task request

A canonical task request should contain fields conceptually like:

```json
{
  "taskId": "TASK-...",
  "courseId": "...",
  "stage": "STORYBOARD",
  "role": "assessment-reviewer",
  "promptTemplate": "assessment-review",
  "inputArtifacts": ["ART-..."],
  "allowedPaths": ["courses/foo/storyboard", "courses/foo/review"],
  "readOnlyPaths": ["courses/foo/research", "courses/foo/design"],
  "skills": ["assessment-review"],
  "tools": [],
  "outputSchema": "schemas/reviewer-finding.schema.json",
  "outputPath": "...",
  "timeout": 1800,
  "writeMode": "findings-only"
}
```

The adapter maps this into Claude/Codex invocation details.

## Subagent strategy

The pipeline must request parallel subagents explicitly for independent tasks where the harness supports it. If a backend cannot provide native parallel subagents in a specific mode, CourseForge may run independent harness processes concurrently, provided file ownership and rate/concurrency limits are enforced.

## Backend selection

Configuration should allow:

```yaml
agent_backend: auto | claude | codex
```

`auto` checks availability and project preference. The selected backend and version are written into the execution plan and artifact provenance.

## Backend fallback

Fallback between Claude and Codex should be explicit, configurable, and logged. Do not silently switch because one answer was poor. Appropriate fallback triggers include unavailable CLI, authentication failure, repeated process failure, or a user-configured stage preference.

## Project instructions shipped by CourseForge

The repository should eventually contain real concise `CLAUDE.md` and `AGENTS.md` files, not just templates. They should agree on:

- source-of-truth docs;
- build/test commands;
- architectural non-negotiables;
- no global dependency assumptions;
- deterministic routing requirement;
- required tests before completion;
- parallel-agent ownership rules;
- preservation of user artifacts;
- course-folder isolation;
- security/privacy rules.

## Compatibility acceptance test

At minimum, CI/local tests should be able to validate adapter command construction and parse captured fixture outputs without requiring live paid model calls.

Where credentials are available, provide optional live smoke tests for both backends.

