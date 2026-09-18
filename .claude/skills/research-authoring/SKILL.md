---
name: research-authoring
description: Researching and writing one cited dossier section with a source and claim ledger (source hierarchy, currentness, jurisdiction, pinpoint citations, claim categories, safety boundary). Used by CourseForge RESEARCH_DOSSIER tasks and their repairs.
disable-model-invocation: true
---

# Research authoring

## Search strategy

1. **Start at the authority.** For law, go to the official consolidated-legislation site of the jurisdiction. For regulator guidance, the regulator's own domain. For standards, the standards body's catalogue entry (the text is often paywalled; describe only what official summaries or the catalogue say). For science, a systematic review or an authoritative body before individual studies.
2. **Use secondary sources as maps.** A good secondary summary tells you which provision or study to open. Cite the primary source you then read, not the summary, unless the summary is itself the authoritative interpretation (for example a regulator's explanatory guide).
3. **Read what you cite.** Open the page; find the passage; note the section, clause, page or table. A claim you cannot locate in the source is not cited to it.
4. **Look for disagreement.** Search for later amendments, newer editions, and credible sources that qualify the claim.

## Currentness

- Legislation: record the consolidation date or "current to" date and check for amendments in force or pending.
- Standards and guidance: record the edition or version; confirm it has not been superseded. If legislation incorporates an older edition, say so; that edition is the legally relevant one.
- Statistics: record the year of the data (not only publication year) and the population.
- Record `accessed` as the date you read the source.

## Jurisdiction

State where each legal claim applies. Distinguish levels (federal, provincial, state, EU, member state) and who each binds (supplier, employer, worker, clinician). Never let a rule from one jurisdiction stand as universal. For jurisdiction-neutral science, `jurisdiction` is `null`.

## Kinds of authority, kept visible

| Claim category | Typical source | Allowed verbs in prose |
|---|---|---|
| `law-regulation` | statute, regulation, code | requires, prohibits, permits, must |
| `guidance-recommendation` | regulator guidance, voluntary standards, professional bodies | recommends, advises, specifies (for adopters), should |
| `scientific-technical` | peer-reviewed evidence, technical references | shows, indicates, is associated with |
| `statistic` | datasets, surveillance reports | reported, estimated (with year and population) |
| `version-currentness` | the issuing body's own pages | is in force since, was replaced by |
| `definition` | legislation definitions, standards, glossaries | is defined as |
| `scenario-synthesis` | your reasoning across cited sources | suggests, taken together |

A voluntary standard becomes law only where legislation incorporates it; cite the incorporating provision if you say so.

## Citation mechanics

- Inline tokens right after the supported sentence: `[SRC-ID]`, `[SRC-ID s.21]`, `[SRC-A ss.16-20; SRC-B]`.
- Locators: `s.` section, `ss.` sections, `p.` page, `para.`, `Table`, `Fig.`, `§`. Use the source's own numbering.
- Source IDs are stable mnemonic slugs from issuer and document (`AB-OHS-CODE`, `CCOHS-SDS`, `ISO-45001-2018`). The same document always gets the same ID across sections; different documents or editions never share one.
- When several sources support a combined statement, cite all of them.
- Short quotations only when exact wording matters (a legal test such as "reasonably practicable"); otherwise paraphrase faithfully.

## Claims ledger

A claim is the smallest proposition a course might teach and a reviewer could verify. Split compound sentences. Fold the qualification into the claim or its `qualifications` field. Confidence: `high` when a primary source states it directly, `medium` for sound secondary support or careful synthesis, `low` when contested or thin. Low-confidence claims are useful: they tell designers to teach with a caveat or not at all.

## Never

- Invent a source, URL, DOI, locator, date, statistic or quotation. Record a gap instead.
- Build URLs from patterns you expect to exist.
- Restate guidance as law, or emerging evidence as consensus.
- Reproduce hazardous operational content (quantities, conditions, procedures, dosing, control bypass). Summarise the concept, cite, and state the escalation boundary.

## Section shape

`###` subsection per research question → direct answer first, then mechanism, conditions and exceptions, then responsibilities → "Limitations and open questions" at the end, listing what could not be confirmed and any conflicts between sources with how you weighed them.
