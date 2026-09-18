# Task: research dossier section `{{subject}}`

Course `{{courseId}}`, "{{courseTitle}}". Stage `{{stage}}`, cycle {{cycle}}. Audience: {{audience}}. Jurisdiction: {{jurisdiction}}. Risk tier `{{riskTier}}`. Language `{{language}}`.

Human instructions: {{instructions}}
Locked IDs: {{locks}}

The planned section, its research questions and the brief's notes for it:

```json
{{extra}}
```

## What to do

1. Read the research brief (source hierarchy, jurisdictions, safety boundaries, evidence and currentness requirements) before searching.
2. Research only this section's questions. Other sections are researched in parallel; do not drift into their topics beyond a one-line cross-reference.
3. Use the web tools. Go to primary and authoritative sources first, in the brief's hierarchy order: the consolidated legislation itself, the regulator's own guidance page, the standards body's own catalogue entry, the original study. Use secondary summaries to locate primary sources, or when no primary source exists, and then say so.
4. Open and read every source you cite. A search snippet is not a reading.
5. Write the section, then build the source and claim ledger from what you wrote.

## Hard rules

- Never fabricate a source, URL, DOI, section number, date, quotation or statistic. If you cannot confirm something, leave it out or state the uncertainty. A gap is acceptable; an invented citation is a blocker.
- Record URLs exactly as fetched. Never construct a URL from a pattern you expect to exist.
- Keep the kind of authority visible in the prose: a statute *requires*, guidance *recommends*, a standard *specifies for those who adopt it*, a study *found*. Never restate guidance or a voluntary standard as a legal requirement.
- Preserve qualifications: exceptions, thresholds, "reasonably practicable", jurisdictional limits, effective dates, the population and year behind a statistic.
- If sources conflict, report both positions with their citations and say which is more authoritative and why. Do not average them.
- Safety boundary: explain concepts, responsibilities, decision points and when to escalate. Do not write operational instructions for hazardous work (quantities, reaction conditions, step-by-step procedures, dosing, ways around controls), even when a source contains them.

## Output field guidance

- `sectionId` must equal `{{subject}}`. `title` is the planned title unless it proved inaccurate.
- `markdown`: the section body, with a `###` subheading per question. Put an inline citation token immediately after the sentence it supports: `[SRC-ID]`, `[SRC-ID s.21]`, `[SRC-A s.21; SRC-B]`. Every substantive sentence carries a token. End with a short "Limitations and open questions" subsection listing what you could not confirm.
- `sources`: every source cited in the markdown and no others.
  - `id`: a stable mnemonic slug built from issuer + document (+ part or year when needed for uniqueness), e.g. `AB-OHS-CODE`, `CCOHS-SDS`, `ISO-45001-2018`, `NIOSH-HIER-CONTROLS`. Parallel sections may cite the same document, so derive the slug from the document itself: the same document must always get the same ID, and different documents or editions must never share one. Use capitals, digits and hyphens.
  - `type`: closed list. `authority`: `primary` (the law, the standard, the original study or dataset), `secondary` (official interpretation or guidance about a primary source, systematic reviews), `tertiary` (general summaries, encyclopaedic pages).
  - `date`: publication or consolidation date; `version`: edition, consolidation or version label; `accessed`: today's date as `YYYY-MM-DD`; `jurisdiction`: where the source has force or applies; `currentnessNotes`: amendments pending, superseded editions, "consolidated to …"; `licenseNotes`: only when quotation or reuse restrictions matter (standards texts, figures). Use `null` for unknown values; never guess.
- `claims`: one record per atomic proposition a course might teach. `id` is a section-local key (`c1`, `c2`, …); CourseForge mints permanent claim IDs on merge.
  - `text`: the proposition in neutral words, specific enough to be checked.
  - `category`: `law-regulation` (what a legal instrument requires or permits), `guidance-recommendation` (what guidance or a voluntary standard recommends), `scientific-technical`, `statistic`, `version-currentness` (which edition or version applies, dates in force), `definition`, `scenario-synthesis` (your reasoned synthesis across sources; still cite what it synthesises).
  - `citations`: `{sourceId, locator}` with pinpoint locators (`s.21`, `ss.16-20`, `p.12`, `Table 3`) whenever the source has them; `null` locator only when it genuinely has none.
  - `sectionId`: `{{subject}}`. `jurisdiction`: where the claim holds, or `null` if universal.
  - `confidence`: `high` only when a primary source states it directly; `medium` for well-supported secondary statements or careful synthesis; `low` for contested or thinly supported points (and say why in `qualifications`).
  - `qualifications`: exceptions, limits and conditions, or `null`.

CourseForge verifies that every token resolves to a listed source, that IDs are well-formed and unique, and URL syntax. It cannot verify that a source says what you claim. That is your responsibility, and independent reviewers will re-open your sources.
