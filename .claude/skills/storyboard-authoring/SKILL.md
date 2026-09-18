---
name: storyboard-authoring
description: Writing complete, learner-facing storyboard modules as structured blocks with citations, objective mapping, accessibility notes and visual specs. Used by CourseForge STORYBOARD authoring and repairs.
disable-model-invocation: true
---

# Storyboard authoring

## The storyboard is the course

Everything a learner reads is written here. The renderer adds structure and styling but never content. So the test for every block is: if this were built exactly as written, would a learner be taught well and accurately?

## Block craft

- **One purpose per block.** A concept, an example, a comparison, a scenario step, a synthesis, an item. If you need a second heading inside a body, you need a second block.
- **Length by comprehension.** Most teaching blocks land around 40–120 words. Split when a learner would lose the thread; merge when a split breaks an explanation. Never delete a qualification to fit.
- **Lead with the point.** First sentence says what the learner should take away; the rest explains why and when.
- **Explain, then name.** Describe the idea in plain words, then give the technical term, then use it consistently.
- **Concrete over abstract.** Follow each principle with an example from the learners' own work context.
- **Visible boundaries.** Where a decision needs a specialist, say so at that point: what to notice, whom to involve, why.
- **Honest modality.** "Must" only for legal duties backed by `law-regulation` claims; "should" or "is recommended" for guidance; "can" or "may" for options and evidence that suggests.

## Module shape that teaches

1. Topic title and a relevance statement (why this matters to these learners).
2. The concept or process explanation, often with a figure.
3. A worked example, comparison or scenario step.
4. Practical implications: decision points and escalation boundaries.
5. A short synthesis in plain words (not a restated heading list).
6. Formative practice: 2–4 items, or one substantial scenario.

The introduction states why the subject matters, what learners will and will not be able to do, the objectives, and the continuing case if there is one; it never teaches platform navigation. The review is organised by objective and states what the learner should now be able to do. The graded module holds only the assessment and its framing.

## Repeated analysis pattern (use when it genuinely fits)

For comparing methods, controls or technologies: what it is; how it works at the audience's level; when it is used; what it supports; strengths; limitations and uncertainty; dependencies and risks; suitability relative to alternatives; conditions needing specialist judgement. Do not force it on material where it distorts the subject.

## Citations and traceability

- Each block's `claimIds` list the claims its factual sentences rest on; `citations` carry the matching source IDs with pinpoint locators from the dossier.
- Combined statements cite every claim needed.
- Items cite the evidence for the correct answer.
- Illustrative scenarios are clearly hypothetical and cite the principles they apply, not invented facts.
- Never add a fact from memory. If essential information is missing from the dossier, write around it, and note the gap in `treatment` so reviewers see it.

## The `treatment` field

Written for reviewers and the renderer: why the block is here, which misconception it addresses, how an interaction behaves (when feedback appears, what a reveal shows), and any conflict between the design and the evidence you resolved in favour of the evidence.

## The `accessibility` field

State how non-text meaning is available: "Figure M2-V01 meaning is fully described in the long text equivalent and in the numbered list in the body", "Sequencing uses move-up and move-down buttons; order is announced after each move". Essential content never lives only here.

## Forbidden in learner-facing fields

Placeholders (TBD, TODO, [insert], lorem ipsum, "content to follow"), developer notes, platform names and navigation instructions ("click Next"), "as shown above" references to layout, requests for stock images, and instructions to a designer.

## Glossary and acronyms

Define each term where it is first taught, and add a glossary entry with the same meaning. Expand each acronym at first use in the course and record that block. Parallel modules may define the same term: use the shared ID convention (`GL-` + term slug, `AC-` + acronym) so entries merge.

## Self-check before returning

- Every block has finished learner text; no placeholders.
- Every factual block has claims and citations.
- Every item is fully keyed per its mode, with option feedback and a cited rationale.
- Every visual has real content and a genuine text equivalent.
- Every term is defined before use; every acronym expanded.
- Qualifications, jurisdiction and safety boundaries from the evidence survive.
