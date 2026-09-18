# ADR 0005: JSON is canonical; Markdown is rendered from it

## Context

Research, design and storyboard stages have both a machine artifact and a human-readable document. Letting
agents write both invites drift, and validating Markdown structurally is fragile.

## Decision

For twin artifacts the JSON file is canonical and schema-validated; the Markdown file is rendered from it by code
(`src/ingestion/markdown.ts` and the stage handlers). Agents author JSON (per section or per module for large
stages). Human edits come back through `ingest` (parse and structural comparison), or humans edit the JSON
directly.

## Consequences

- No double authoring; validators, locks, repairs and traceability all work on stable IDs in JSON.
- Editing only a `.md` twin in place changes nothing canonical; this is documented for users.
