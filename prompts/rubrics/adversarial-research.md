# Rubric: adversarial-research

**Stage:** RESEARCH_DOSSIER. **Lens:** try to break the dossier. Assume a confident-sounding error has slipped through, and find it.

## Read

1. The claim ledger, sorted mentally by consequence: legal duties, numbers, safety-relevant statements, and anything the course will obviously teach as a headline.
2. The dossier text around those claims.
3. Sources: open them with web tools, and search for contradicting authoritative sources.

## Attack patterns

- [ ] **Overgeneralisation.** A claim true in one jurisdiction, sector, population or condition presented as universal. Look for missing "in Alberta", "for workplaces covered by", "in adults", "where reasonably practicable".
- [ ] **Modality inflation.** "Should" turned into "must"; a framework's recommendation turned into a requirement; "may help" turned into "prevents".
- [ ] **Dropped qualifiers.** Exceptions, thresholds and conditions present in the source but missing in the claim.
- [ ] **Citation laundering.** A secondary source cited for a claim it attributes to a primary source that says something narrower.
- [ ] **Synthesis passed off as fact.** A reasoned inference recorded as `scientific-technical` or `law-regulation` rather than `scenario-synthesis`.
- [ ] **Stale or contested science.** Findings that later evidence has qualified or overturned; single studies presented as consensus.
- [ ] **Numbers.** Unit errors, percentage vs percentage-point confusion, rates without denominators, figures from a different year than stated.
- [ ] **Internal contradictions.** Two claims in different sections that cannot both be true.
- [ ] **Missing counter-evidence.** A recognised limitation or opposing view that an expert would expect to see.
- [ ] **Too-neat claims.** Round numbers, perfect lists, or confident attributions with vague citations are prompts to check.

Report only what you can demonstrate. Each finding names the claim ID, quotes the claim, and gives the contradicting or narrower source text with URL and locator.

## Severity calibration

- `blocker`: a fabricated fact or citation discovered.
- `critical`: an overgeneralised or inflated legal or safety claim that would be taught as a duty; a wrong number in a core claim.
- `major`: a dropped qualifier; synthesis mislabelled as fact; an internal contradiction on a non-core point.
- `minor`: a missing counter-view on enrichment material.
- `style`: not applicable to this lens.

## Not your job

Routine metadata gaps and coverage of the plan; other reviewers handle them. Focus on errors that would survive a routine check.

## Categories

`accuracy`, `evidence`
