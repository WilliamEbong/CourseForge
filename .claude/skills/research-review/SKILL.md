---
name: research-review
description: Reviewing research briefs and dossiers for coverage, source quality, currentness, jurisdiction and safety. Used by CourseForge RESEARCH_BRIEF and RESEARCH_DOSSIER reviewers.
disable-model-invocation: true
---

# Research review

## How to review evidence efficiently

You cannot re-verify everything. Sample by consequence:

1. Claims in category `law-regulation` and `statistic`.
2. Claims marked `high` confidence that rest on a single source.
3. Claims the course will obviously teach as headlines (definitions of core terms, key duties).
4. Anything surprising, very round, or suspiciously neat.
5. Sources with missing version, date or locator.

For each sampled claim: open the source, find the locator, and compare wording for scope, modality, numbers, population, date and jurisdiction.

## Red flags

- **Fabrication signals:** a URL that resolves to a different document or a generic landing page; a DOI that does not match the title; section numbers that do not exist; quotations you cannot find; publication dates that do not match the issuer's page.
- **Modality inflation:** "should" becoming "must"; a framework or standard described as mandatory without the incorporating law.
- **Scope stretch:** a rule for one sector, substance list, population or jurisdiction stated generally.
- **Qualifier loss:** "where reasonably practicable", "listed substances", "in adults", "except" missing.
- **Laundered citations:** a secondary source cited for a claim it attributes to a primary source that says something narrower.
- **Stale versions:** repealed provisions, superseded editions, old statistics presented as current.
- **Synthesis as fact:** inferences recorded as scientific or legal facts.
- **ID drift:** the same document under two IDs, or one ID for two editions.

## Coverage review

Map every brief question to the dossier text that answers it. "Mentioned" is not "answered": an answer states the fact, its mechanism or conditions, and its limits. Check the seams between sections, where parallel researchers each assume the other covered a topic. Check that every key term has a sourced definition, and that limitations and misconceptions are researched, not just the happy path.

## Brief review

- Every concept goal traces to a core question; every core question to a section.
- The source hierarchy suits the subject and constrains weaker source types.
- Currentness and jurisdiction requirements are explicit.
- Safety boundaries are specific to the subject and name what must not be produced.

## Writing good research findings

- Location: the claim ID, source ID, section ID or question ID.
- Evidence: quote the dossier text (short), then what the source actually says, with URL and locator.
- Recommended action: the specific correction ("change 'must' to 'is recommended to' and recategorise as guidance-recommendation; cite AB-OHS-CODE s.7 only if the duty is statutory").
- Severity: fabrication is a blocker; a wrong legal duty, wrong number or guidance-as-law is critical; missing qualifiers and weak sourcing on core points are major.

## What validators already do

Code checks that every inline token resolves to a source record, that IDs are unique and well-formed, and that URLs are syntactically valid. Code cannot tell whether a source supports a claim, is current, or exists at that URL. That is the reviewer's job.
