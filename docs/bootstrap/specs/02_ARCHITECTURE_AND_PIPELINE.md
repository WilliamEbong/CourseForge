# 02 — Architecture and Pipeline

## System layers

CourseForge should be organized into these logical layers:

```text
CLI / User Interface
        ↓
Environment Manager / Doctor
        ↓
Course Registry + Artifact Ingestion
        ↓
State Machine / Pipeline Engine
        ↓
Capability Classifier
        ↓
Deterministic Router
        ↓
Harness Adapter (Claude Code | Codex)
        ↓
Generators / Reviewers / Adjudicator / Repair Agents
        ↓
Validators / Build Tools / Browser QA
        ↓
Artifact Registry + Provenance + Release
```

## Shared core

The shared core must not contain provider-specific prompting assumptions. It owns:

- state transitions;
- stage contracts;
- artifact manifests;
- course manifest;
- tool registry;
- routing rules;
- reviewer policies;
- environment checks;
- subprocess execution;
- schemas;
- deterministic validators;
- logging;
- packaging;
- file versioning/snapshots;
- release checks.

## Agent harness adapters

Implement an interface conceptually similar to:

```ts
interface AgentHarness {
  name: 'claude' | 'codex';
  isAvailable(): Promise<Availability>;
  getVersion(): Promise<string | null>;
  runTask(request: AgentTaskRequest): Promise<AgentTaskResult>;
  runStructured<T>(request: StructuredAgentTaskRequest<T>): Promise<T>;
  supportsSubagents(): Promise<boolean>;
  supportsParallelWork(): Promise<boolean>;
}
```

No pipeline stage should directly shell out to `claude` or `codex`; it calls the adapter.

## State machine

A project state file records the canonical production state. Stages should support statuses such as:

```text
NOT_STARTED
INGESTED
VALIDATING
GENERATING
REVIEWING
REPAIRING
WAITING_FOR_HUMAN
APPROVED
LOCKED
FAILED
SUPERSEDED
```

A project may have multiple artifacts at one stage, but exactly one should be canonical/approved for downstream use unless the user intentionally selects another.

## Generic stage loop

Every major stage uses the same orchestration pattern:

```text
INPUT ARTIFACT(S)
      ↓
NORMALIZE / VALIDATE
      ↓
GENERATE OR TRANSFORM
      ↓
REVIEW PANEL (parallel where independent)
      ↓
ADJUDICATOR
      ↓
REPAIR
      ↓
DETERMINISTIC VALIDATION
      ↓
OPTIONAL HUMAN GATE
      ↓
LOCK CANONICAL ARTIFACT
      ↓
NEXT STAGE
```

Reviewers produce findings rather than rewriting the artifact directly.

## Parallelism

Parallel work is encouraged when tasks do not write the same files or depend on unfinished sibling work.

Good parallel tasks:

- evidence review + completeness review + safety/scope review;
- visual review + accessibility review + functional test execution;
- building independent modules/components in separate worktrees/directories;
- environment research + CLI design + schema design during planning;
- separate test categories.

Bad parallel tasks:

- two agents editing the same orchestrator file;
- storyboarding before instructional design is approved;
- repairing an artifact before adjudication has consolidated findings.

The parent coordinator must wait for all required reviewers, merge results deterministically, and prevent parallel agents from overwriting each other.

## Canonical data vs human-readable documents

Where a stage benefits from structure, maintain both:

```text
human-readable Markdown artifact
machine-readable JSON artifact
```

Example:

```text
storyboard/storyboard.md
storyboard/storyboard.json
```

The machine-readable representation should drive downstream compilation. The Markdown is for human review and portfolio readability.

## Traceability graph

CourseForge should maintain stable IDs and relationships:

```text
Source
  ↓
Claim
  ↓
Research section
  ↓
Learning objective
  ↓
Storyboard block
  ↓
Formative / graded assessment item
  ↓
Course-model component
  ↓
Rendered HTML element
```

The graph must support both directions. A changed source should allow CourseForge to identify affected downstream content; an assessment answer should be traceable back to its supporting evidence.

## Provider selection

The selected harness may be configured per project/run. The default should be auto-detected based on availability and user preference. The pipeline does not silently switch providers mid-stage unless the configured fallback policy permits it and the change is logged.

## Failure and retry policy

Retries should be bounded and classified.

Example:

```text
schema/format failure → retry same agent with validation feedback
review major finding → repair cycle
visual renderer failure → renderer-specific repair, then deterministic fallback
agent subprocess failure → retry with exponential delay, then fail stage
three unsuccessful repair cycles → human escalation or stage failure
```

Do not create infinite autonomous loops.

