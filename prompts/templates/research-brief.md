# Task: write the research brief for "{{courseTitle}}"

Course `{{courseId}}`, stage `{{stage}}`, cycle {{cycle}}. Audience: {{audience}}. Language `{{language}}`. Jurisdiction: {{jurisdiction}}. Risk tier `{{riskTier}}`. Target duration {{durationMinutes}} minutes.

Human instructions: {{instructions}}
Locked IDs (reproduce their content exactly): {{locks}}

## Purpose

The brief is the contract for the research dossier. Researchers will work one planned section at a time, in parallel, without seeing each other's output. The brief must therefore be specific enough that each section can be researched in isolation and the results fit together without gaps or overlap.

Read the concept brief first. Carry its audience, scope, exclusions, jurisdiction and high-stakes assumptions forward. Do not quietly widen or narrow them; if you must, say so in `purpose`.

## Field guidance

- `purpose`: why the research is needed and which course decisions it must support.
- `audience`: the eventual learners and the depth the dossier must support. The dossier is more technical than the course and must keep regulatory and technical precision; say so.
- `scope` and `exclusions`: concrete topic statements. Exclusions include everything the concept put out of scope and anything unsafe to operationalise.
- `researchQuestions`: IDs `RQ-01`, `RQ-02`, … Write answerable questions ("What does the regulation require of employers regarding X, and what exceptions apply?"), not topic labels. Mark `core` when the course cannot be taught responsibly without the answer, otherwise `supporting`. Include:
  - definitional questions for every term the course will rely on;
  - "who is responsible for what" questions when duties are split between parties;
  - at least one question on limitations, misconceptions or common failure modes;
  - a currentness question for any law, standard or guidance that is revised over time.
- `sourceHierarchy`: ranked list using the closed `sourceType` values; rank 1 is most authoritative for this subject. For legal or regulatory subjects: legislation and regulation, then government guidance, then standards, then professional guidance, then peer-reviewed and textbooks. For scientific subjects: peer-reviewed evidence and authoritative bodies lead. Each `rationale` says when that type may and may not be relied on ("organisation or vendor material only to describe what exists, never for effectiveness claims"; "news only for dating events, never for requirements").
- `jurisdictions`: every jurisdiction whose rules the dossier must cover, primary first. Leave empty only for genuinely jurisdiction-neutral subjects.
- `safetyBoundaries`: specific statements of what the dossier must not turn into instructions (quantities, procedures, dosing, exploit steps, clinical protocols, individual legal advice). For high-stakes subjects the default ceiling is awareness level: concepts, responsibilities, decision points, escalation.
- `dossierPlan`: sections `RS-01`, `RS-02`, … Each has a title, the `questionIds` it answers, and `notes` telling the researcher what to cover, which distinctions to keep visible (law vs guidance vs standard vs synthesis), and which neighbouring section owns adjacent material. Every core question belongs to at least one section. Aim for 6–14 sections, each researchable in one focused session.
- `evidenceRequirements`: checkable rules, e.g. "every regulatory claim cites the consolidated provision with a section locator", "statistics cite the report or dataset with year and population", "no claim rests only on a tertiary source".
- `currentnessRequirements`: which facts are time-sensitive (consolidated legislation, standard editions, guidance versions, statistics, product categories) and what must be recorded (version, consolidation or effective date, accessed date).

## Quality bar

- Every concept learning goal traces to at least one core question; a reviewer will check this.
- Make no factual claims in the brief that you have not verified; the brief plans research, it does not do it.
- If the concept left a high-stakes gap (such as no jurisdiction), plan research for the most likely case and state that assumption explicitly in `purpose` or the relevant section `notes`.
