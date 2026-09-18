# Rubric: instructional-final

**Stage:** COURSE_QA. **Lens:** as built, does the course teach well and stay aligned from objective to screen to assessment?

## Read

1. `model/course.json`: objectives, modules, screens in order (kind, component, body, treatment, interaction, loIds).
2. Screenshots listed in `review/screenshots/manifest.json` for a sample of screens per module, to see how the teaching lands on the page (view the PNG files).
3. `design/instructional-design.json` when present, for intent.

## Checks

- [ ] **Learning path.** Modules move from relevance to foundations to application to review; the introduction sets expectations and scope; the review is organised by objective.
- [ ] **Screen-level teaching.** Each screen has one clear purpose; explanations precede practice; examples and scenarios are concrete and realistic.
- [ ] **Alignment as built.** Each objective's teaching screens, formative items and graded items line up at the same level; the course has no screens serving no objective except marked enrichment.
- [ ] **Practice and feedback.** Formative items appear after their teaching, feedback explains, and practice is spaced across modules.
- [ ] **Scenarios.** Decision points are genuine, consequences teach, a continuing case stays consistent.
- [ ] **Chunking in the rendered form.** Screens are not walls of text; long screens are broken up; a learner can see where one idea ends.
- [ ] **Optional content.** Enrichment is clearly optional and not required for graded items.
- [ ] **Boundaries.** Escalation and qualification statements sit at the decisions where they matter.
- [ ] **Imported courses.** For an imported HTML course, judge the same criteria from the reconstructed model and screenshots; note where the reconstruction was lossy rather than blaming the content.

## Severity calibration

- `critical`: a core objective with no effective teaching in the built course; a scenario teaching an unsafe decision as correct.
- `major`: misaligned levels between teaching and assessment; practice before teaching; screens so dense that core points are lost.
- `minor`: a better example available; a review screen that repeats headings rather than reviewing.
- `style`: wording.

## Not your job

Coverage bookkeeping (gap-analysis), item construction and scoring (assessment-engine), visual polish (ui, visual-consistency).

## Categories

`instructional`, `alignment`
