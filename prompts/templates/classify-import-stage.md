# Task: classify the production stage of an imported artifact

Course `{{courseId}}`. Subject file: `{{subject}}`.
Human instructions (may declare an intended stage; treat a declaration as intent to verify, not as proof): {{instructions}}

CourseForge's heuristic scoring was inconclusive. Its signals and scores:

```json
{{extra}}
```

## Your job

Read the imported document listed in Inputs and decide which pipeline stage it represents, choosing exactly one value from the closed list. CourseForge uses the answer to decide which stage contract to validate the document against and where the pipeline resumes. A wrong answer sends good work down the wrong path, so say `low` when unsure; a human will confirm.

## Stage values and their signatures

- `CONCEPT`: a topic request or idea: title, audience, a few goals. No research questions, no citations.
- `RESEARCH_BRIEF`: instructions for research: purpose, audience, scope, numbered research questions, source-quality requirements, planned dossier structure. Directive voice ("Research…", "Verify…"); few or no citations.
- `RESEARCH_DOSSIER`: researched findings: many inline citation tokens, source lists or annotated bibliography, claim-to-source tables, discussion of legislation, guidance and evidence.
- `INSTRUCTIONAL_DESIGN`: a blueprint: learning objectives (LO1…), content disposition (core, enrichment, reference, excluded), module plans, alignment matrices, assessment blueprint; no finished learner-facing screens.
- `STORYBOARD`: complete learner-facing content organised by block IDs, with interaction specifications, correct answers, feedback, objective mapping and citations per block; formative and graded item tables.
- `EDITORIAL`: a storyboard that has been through an editorial or humanising pass (same structure and IDs as a storyboard, notes or title indicating editing). Choose this only with clear evidence; otherwise `STORYBOARD`.
- `VISUAL_DIRECTION`: a design brief, tokens or component plan describing the course's visual language.
- `COURSE_MODEL`: a structured JSON course model (modules, screens, interactions) intended for a renderer.
- `COURSE_BUILD`: a built course: HTML with scripts, styles, navigation and embedded course data.
- `COURSE_QA`: a QA or test report about a built course (screen counts, pass/fail results, accessibility findings).
- `RELEASE`: a release package or manifest for a finished course. Rare for imports.

When a document mixes stages (a storyboard with a design appendix), choose the most downstream stage whose contract the document substantially satisfies.

## Output

- `value`: one stage from the list.
- `confidence`: `high` when the document plainly matches one signature; `medium` when it matches but is incomplete or mixed; `low` when two stages are similarly plausible or the document is fragmentary.
- `evidence`: 2–5 short verbatim quotes or structural observations from the document (headings, table headers, ID patterns) that justify the value. Quotes under 20 words.
