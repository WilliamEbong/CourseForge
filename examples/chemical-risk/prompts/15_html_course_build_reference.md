# Reference Prompt 15 — Complete Interactive HTML Build

This reference captures the implementation expectations used to produce the included example HTML. CourseForge should ultimately replace a giant prompt like this with structured stage contracts, a course model, reusable components, deterministic routing, and automated QA.

## Source order

1. Research dossier is factual/evidentiary source of truth.
2. Approved instructional-design blueprint controls audience, scope, sequence, objectives, and assessment alignment.
3. Final/humanized storyboard controls learner-facing content, stable block IDs, scenarios, interactions, feedback, assessments, citations, accessibility requirements, visuals, and flow.
4. Implementation specification controls technical behavior.

## Output

Build a complete self-contained HTML course, not a prototype. It must include all HTML/CSS/JavaScript/content/interactions/diagrams/scoring/glossary/references/citations/accessibility/navigation/progress state required by the storyboard and require no external runtime dependency for core course operation.

## Key requirements

- preserve every substantive storyboard block and its ID;
- implement all formative and graded interactions, answer logic, feedback, rationales, and scoring;
- implement responsive desktop/tablet/mobile navigation;
- implement keyboard accessibility and non-drag alternatives;
- implement original structured instructional visuals with text equivalents;
- preserve citations near supported claims and include the full reference library;
- provide glossary/acronym access;
- support local progress/reset where practical;
- preserve qualification/safety boundaries;
- keep source code maintainable and traceable;
- run structural, interaction, runtime, responsive, accessibility, and content-integrity QA;
- fix failures and retest;
- produce the final HTML and a QA report.

CourseForge should produce a more sophisticated, componentized, validated version of this behavior programmatically.

