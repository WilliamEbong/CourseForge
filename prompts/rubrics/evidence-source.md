# Rubric: evidence-source

**Stage:** RESEARCH_DOSSIER. **Lens:** do the sources exist, carry the authority claimed, and actually support the claims that cite them?

## Read

1. `research/claims.jsonl` and `research/sources.jsonl`: the ledger you are auditing.
2. The dossier sections where the claims appear, for context.
3. The brief's source hierarchy and evidence requirements.
4. The sources themselves: use web tools to open a sample. Prioritise `law-regulation`, `statistic` and `high`-confidence claims, every claim resting on a single source, and anything that looks surprising.

## Checks

- [ ] **Existence.** Sampled URLs resolve to the document described (title, issuer, version). A URL that leads elsewhere, or a DOI that does not match, is a fabrication signal.
- [ ] **Support.** The cited passage says what the claim says: same scope, same modality (requires vs recommends), same numbers, same population and year. Pinpoint locators point at the right section.
- [ ] **Authority and type.** `type` and `authority` are correct (a regulator's guidance page is not `legislation`; a summary website is not `primary`). Core claims rest on sources ranked high in the brief's hierarchy.
- [ ] **Claim category.** `law-regulation` claims cite binding instruments; recommendations from guidance or standards are `guidance-recommendation`; synthesis is marked `scenario-synthesis`.
- [ ] **Confidence honesty.** `high` only where a primary source states the claim directly.
- [ ] **Metadata.** Title, publisher, date or version, and accessed date are present where the source provides them; nothing is invented to fill a field.
- [ ] **Consistency across sections.** The same document is not recorded under two IDs, and one ID is not reused for two documents or editions.
- [ ] **Quotations.** Any quoted text matches the source exactly and is short.

In `evidence`, give the claim or source ID, the claim text or quoted passage, and what the source actually says (with URL and locator).

## Severity calibration

- `blocker`: a fabricated source, URL or quotation; a citation to a document that does not contain anything like the claim.
- `critical`: a legal requirement misstated (wrong duty, wrong party, wrong threshold); guidance recorded as law; a statistic with the wrong number, year or population.
- `major`: a claim only partly supported (scope stretched, qualification missing); wrong source type or authority; a core claim resting on a tertiary source; duplicate IDs for one document.
- `minor`: missing locator where one exists; incomplete metadata.
- `style`: citation formatting.

## Not your job

Whether the dossier covers every question (domain-completeness), whether sources are the current version (currentness-jurisdiction, unless the version error changes what the claim says), safety of content (safety-scope). Validators already check that every token resolves to a listed source and that IDs and URLs are well-formed.

## Categories

`evidence`, `citation`, `accuracy`
