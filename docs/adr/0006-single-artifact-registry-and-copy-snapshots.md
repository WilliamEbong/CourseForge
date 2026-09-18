# ADR 0006: One artifact registry and plain-copy snapshots

## Context

The specification described per-artifact sidecar manifests and version history. Sidecars scatter state and are
easy to desynchronise; git-based versioning inside a course would couple courses to the repository.

## Decision

Each course has one `artifacts.json` registry (`src/artifacts/registry.ts`) holding every version: ID, stage,
path, logical key, version number and label, producer, parents, LF-normalised SHA-256, approval, whole-artifact
and section locks, review status, supersession, snapshot path and conflicts. Every version is also copied to
`versions/<label>/`. Restoring copies a snapshot forward as a new version; history is never rewound.

## Consequences

- Drift detection is a hash comparison against one file; provenance queries are simple.
- Snapshots cost disk space proportional to artifact size and version count (text artifacts are small).
- Writes to `artifacts.json` use atomic replace with retries.
