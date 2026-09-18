# Examples

## `chemical-risk/`: the lineage that motivated CourseForge

A complete, real production lineage for a workplace chemical-risk awareness course, produced by the author with
an earlier prompt-driven workflow:

| File | Stage |
|---|---|
| `00_research_brief.md` | RESEARCH_BRIEF |
| `01_research_dossier_first_pass.md`, `02_research_dossier_expanded.md` | RESEARCH_DOSSIER |
| `03_instructional_design_blueprint.md` | INSTRUCTIONAL_DESIGN |
| `04_storyboard.md` | STORYBOARD |
| `05_storyboard_humanized.md` | EDITORIAL |
| `06_interactive_course.html` | COURSE_BUILD (standalone interactive HTML) |
| `07_html_qa_report.md` | COURSE_QA |
| `prompts/` | Transformation prompts used for the design and storyboard stages, and an HTML-build reference prompt |
| `screenshots/` | Screenshots of the example course |

It is the author's own portfolio work, provided here as a **regression fixture and quality floor**, not as a
template. See [chemical-risk/NOTICE.md](chemical-risk/NOTICE.md) for authorship and content caveats.

## How CourseForge uses it

- **Ingestion fixture.** Every file is run through stage inference and the stage normalisers; tests assert the
  inferred stages and exact counts (for example the storyboard's blocks and items, and the HTML course's
  screens, interactions, references, glossary terms, acronyms, visuals and modules). Imported IDs such as
  `AB-OHS-4`, `LO4`, `T3-07` and `GA-15` must survive verbatim.
- **Requirements source.** Deterministic checks in the prompts (ID uniqueness, answer keys, objective coverage,
  citation resolution) became validators; judgement items became reviewer rubrics.
- **Known-defect catalogue.** The example contains defects CourseForge must catch: the humanised storyboard
  inverted "…not only the product classification" into "…the product classification alone" (the EDITORIAL
  polarity guard exists because of this), and the HTML course draws figures as CSS boxes rather than SVG, has alt
  text containing authoring instructions, puts `aria-live` on the whole screen container, and lacks visible focus
  styles and a focus trap in its drawer.
- **Existing-HTML improvement.** `06_interactive_course.html` is imported in `improve` mode, crawled in a real
  browser, reviewed, rebuilt through CourseForge components and compared in a regression report. The original
  file is never modified.

```sh
./courseforge ingest examples/chemical-risk/05_storyboard_humanized.md --course chem-demo --stage editorial --mode improve
./courseforge ingest examples/chemical-risk/06_interactive_course.html --course chem-html --stage course_build --mode improve
./courseforge improve --course chem-html
```

Tests: `tests/integration/ingest/chemical-risk.test.ts`, `tests/integration/improve/chemical-risk-improve.test.ts`,
`tests/e2e/existing/crawl.spec.ts`.
