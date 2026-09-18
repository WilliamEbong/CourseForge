# Task: instructional design for "{{courseTitle}}"

Course `{{courseId}}`, stage `{{stage}}`, cycle {{cycle}}. Audience: {{audience}}. Language `{{language}}`. Jurisdiction: {{jurisdiction}}. Risk tier `{{riskTier}}`. Target duration {{durationMinutes}} minutes.

Human instructions: {{instructions}}
Locked IDs (reproduce their content exactly): {{locks}}

## Purpose

Turn the research dossier into a learning architecture: what learners must be able to do, in what order they learn it, how they practise it and how it is assessed. Do not write learner-facing screens or assessment items yet; the storyboard stage does that, one module at a time, from your plan.

Source-of-truth order: the dossier and its claim ledger are the factual authority; the concept and brief define audience and scope; these instructions define the design format.

## Read first

1. The research dossier (all sections) and `claims.jsonl`, so every design decision can cite claim IDs.
2. `sources.jsonl`, to see which sources are law, guidance, standards or evidence.
3. The concept brief's audience, exclusions and high-stakes assumptions.

## Design steps

1. **Performance need.** What will learners recognise, explain, compare, decide, document or escalate at work afterwards? What will the course explicitly not qualify them to do?
2. **Disposition.** Place every substantive dossier topic in `dispositions` as `core`, `enrichment` (optional depth), `reference` (glossary or reference library only) or `excluded`. The reason must be specific: "duplicates RS-04", "operational procedure outside the awareness boundary", "evidence too weak to teach". Nothing researched may silently disappear.
3. **Objectives.** Write 4–6 terminal objectives, IDs `LO1`…`LO6`. Each `statement` begins with one observable verb that is also the `verb` field: explain, distinguish, identify, interpret, compare, classify, select, evaluate, justify, sequence, document, escalate, apply, determine. Never know, understand, learn, appreciate, be aware of, be familiar with. `bloomLevel` matches the verb as used. Every objective lists the `claimIds` and `sourceIds` that make it teachable; an objective with no supporting claims is not allowed. Do not imply certification-level competence.
4. **Sequence and modules.** IDs `M1`, `M2`, … Typical flow: relevance → prerequisite vocabulary → mental model or process overview → components and options → limits, risks and evidence quality → applied decisions and scenarios → review. Adapt when the subject needs a different logic and say why in the module `purpose`. Plan an introduction module, topic modules, a review module and a final graded module; the storyboard relies on this shape.
5. **Module plans.** For each module: `purpose`; `loIds`; `contentSequence` as ordered, specific teaching points (each naming the claims it rests on, e.g. "Hazard vs risk: task conditions change risk, not intrinsic hazard (CLM-0012, CLM-0015)"); `misconceptions` learners are likely to bring; `examples` that are neutral and realistic, never invented incidents or statistics presented as real; `formativePractice` describing 2–4 practice activities or one substantial scenario, each tied to an objective; `durationMinutes`; `sourceIds`.
6. **Alignment.** One `alignment` row per objective: the modules that teach it, the formative method, the graded method, and the `cognitiveLevel` the graded items must reach. Graded methods must match the level: a "distinguish" or "evaluate" objective needs scenario or interpretation items, not definition recall.
7. **Assessment strategy.** `formativePerModule` (usually 2–4), `gradedItemCount` (usually 12–15, and at least 2 per objective), `passingPercent` (a design suggestion, typically 70–80), and `notes` on item mix, difficulty spread and anything to avoid.
8. **Scenario strategy.** One continuing case or a set of short cases, what decisions they exercise, and how they stay neutral (no real organisations, outcomes or numbers presented as fact).
9. **Glossary plan.** Terms and plain-language definitions the storyboard must define on first use, drawn from definition claims.
10. **Evidence gaps.** What the dossier does not support well enough, its impact on teaching, and the action (research more, teach with a caveat, exclude, ask a human).

## Cognitive load and audience

- One idea or decision per chunk; introduce a term before relying on it; define acronyms on first use.
- Progressive disclosure: essential explanation first, optional depth marked as enrichment.
- Name where a diagram, comparison, timeline or decision tree would carry the idea better than prose, and where retrieval practice and spaced review occur.
- Plain language at roughly Grade 9–11 for the learner-facing layer, without losing the precision of the claims.

## Duration

The sum of module durations should be within about 15% of `durationMinutes` (the course target). If the content cannot be taught responsibly in that time, keep the essential content, set the realistic duration, and record the conflict in `evidenceGaps` with action "confirm duration with a human".

## Code verifies

Objective count 4–6 and verb allow/deny lists; every objective appears in at least one module and in `alignment`; every module objective exists; claim and source IDs resolve; dispositions use the closed values. Reviewers judge whether the architecture teaches well, the alignment is honest and the evidence is faithfully used.
