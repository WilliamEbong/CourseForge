# Chemical-Risk Example Artifact Lineage

These files are real artifacts from the workflow that motivated CourseForge.

```text
00 research brief
→ 01 first research dossier
→ 02 expanded research dossier
→ 03 instructional-design blueprint
→ 04 complete storyboard
→ 05 editorial/humanized storyboard
→ 06 standalone interactive HTML
→ 07 HTML QA report
```

`prompts/` contains the transformation prompts used for the instructional-design and storyboard stages, plus a reference HTML-build prompt.

## How CourseForge should use these files

- as concrete examples of artifact relationships;
- as ingestion/regression fixtures;
- as a source of requirements around citations, assessments, traceability, and completeness;
- as a test for existing-HTML review/improvement.

## Do not copy their visual implementation as the default

The HTML course is a useful proof of concept, not the desired CourseForge quality ceiling. The finished system should generate substantially stronger visual design, graphics, component consistency, accessibility, traceability, and QA.

