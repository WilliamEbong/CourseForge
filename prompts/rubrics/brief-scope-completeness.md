# Rubric: brief-scope-completeness

**Stage:** RESEARCH_BRIEF. **Lens:** will research carried out exactly as planned cover everything the course needs, and nothing it should not?

## Read

1. The concept brief (`input/concept.json`): audience, goals, exclusions, assumptions.
2. The research brief (`research/research-brief.json`).

## Checks

- [ ] **Goal coverage.** Every concept learning goal traces to at least one `core` research question. List any goal with no question.
- [ ] **Definitions.** Every term the course will depend on has a definitional question (or is explicitly covered by one).
- [ ] **Responsibilities.** Where duties are split between parties (supplier, employer, supervisor, worker; clinician, patient; controller, processor), a question asks who is responsible for what.
- [ ] **Limits and misconceptions.** At least one question targets limitations, failure modes or common misconceptions; courses without these teach false confidence.
- [ ] **Questions are answerable.** Each question can be answered from sources in a focused session. Flag topic labels posing as questions and questions so broad they would produce a survey.
- [ ] **Priority is honest.** `core` questions are the ones the course cannot be taught responsibly without; enrichment is not marked core and vice versa.
- [ ] **Dossier plan.** Every core question is assigned to a section; no section is an orphan with no questions; sections do not overlap so much that parallel researchers will duplicate work; `notes` say what each section owns and what belongs to neighbours.
- [ ] **Section sizing.** 6–14 sections is typical; a section covering five unrelated questions will be researched shallowly.
- [ ] **Scope consistency.** Scope and exclusions match the concept. Anything widened or narrowed is justified in `purpose`.
- [ ] **Audience depth.** The brief asks for enough technical precision to support accurate plain-language teaching later.

## Severity calibration

- `critical`: a concept learning goal with no core question at all; a core topic excluded without reason.
- `major`: a missing definitional or responsibility question the course clearly needs; a core question not assigned to any section; heavy overlap that will produce contradictory parallel sections.
- `minor`: a question that should be split or rephrased; imprecise section notes.
- `style`: ordering or naming of sections.

## Not your job

Source hierarchy and currentness (brief-evidence-strategy); safety boundaries and exclusions of hazardous content (brief-safety). The required-sections validator already checks that every field is present and IDs are well-formed.

## Categories

`scope`, `completeness`
