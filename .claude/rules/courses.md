---
paths:
  - "courses/**"
---

# Rules for course folders

- **Never edit `input/originals/`.** These are the preserved bytes of imported work; their hashes are re-verified at every run and by the release gate.
- **Never edit `versions/`.** Version snapshots are history; restore with `courseforge versions restore|select`, which copies forward as a new version.
- **Never edit locked artifacts or locked IDs** (see `artifacts.json`). Unlock through a human gate (`courseforge gate unlock`) first, and only when the user asks.
- **Change content through CourseForge.** Use `run`, `continue`, `improve`, or edit a copy and re-ingest with `courseforge ingest --replace`. Hand edits to canonical artifacts are detected as drift, recorded as `human-edited` versions and invalidate downstream stages; do this only when the user explicitly wants to edit by hand.
- **JSON is canonical.** For twin artifacts (`*.json` + `*.md`), the Markdown is rendered from the JSON; editing the Markdown alone changes nothing canonical.
- **Do not edit generated outputs** (`model/`, `build/`, `release/`, `review/` reports, `logs/`); regenerate them with the corresponding command.
- **Never delete a course folder** or run `clean` without explicit user intent.
