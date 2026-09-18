# Task: write the complete storyboard for module `{{subject}}`

Course `{{courseId}}`, "{{courseTitle}}". Stage `{{stage}}`, cycle {{cycle}}. Audience: {{audience}}. Language `{{language}}`. Jurisdiction: {{jurisdiction}}. Risk tier `{{riskTier}}`.

Human instructions: {{instructions}}
Locked IDs (reproduce these objects exactly as they exist): {{locks}}

This module's plan from the approved instructional design, plus course-level context prepared by CourseForge:

```json
{{extra}}
```

## Source-of-truth order

1. The research dossier and claim ledger are the factual authority.
2. The instructional design controls audience, scope, sequence, objectives and assessment alignment.
3. These instructions control the storyboard format.

If the design conflicts with the evidence, follow the more precise evidence, and mention the conflict in the `treatment` of the affected block so reviewers see it. Never resolve a factual conflict by guessing.

## What "complete" means

Write every word the learner will read: explanations, examples, scenario text, question stems, options, feedback and rationales. No outlines, no "content to be written", no "TBD", no "[insert]", no "see above", no instructions addressed to a developer inside learner-facing fields. CourseForge rejects placeholders.

Write one module only: `{{subject}}`. Other modules are written in parallel; do not repeat their teaching, but you may refer back to earlier modules by title.

## Blocks

- IDs: `{{subject}}-B01`, `{{subject}}-B02`, … in reading order for teaching blocks; `{{subject}}-F01`, `{{subject}}-F02`, … for formative items. In the graded module (role `graded`), items are `GA-01`, `GA-02`, … and any introduction or results-framing block uses `{{subject}}-B01`. IDs never change once written.
- Usual module shape: topic title with a relevance statement → concept or process explanation → example, comparison or worked scenario → practical implications, decision points and escalation boundaries → short synthesis → 2–4 formative items or one substantial scenario activity. Adapt to the plan.
- `kind` from the closed list; `subtype` refines it in plain words (`terminology`, `continuing case`, `specialist boundary`, `optional deeper reading`) or `null`.
- `body`: learner-facing Markdown-lite (paragraphs, **bold**, *emphasis*, lists, links). One clear purpose per block; usually 40–120 words, longer only when splitting would break an explanation. Define every term and acronym on first use in the course. Never drop a qualification to shorten a block.
- `treatment`: how the block teaches and behaves (why it is here, how an interaction reveals feedback, what the scenario is exercising). For reviewers and the renderer, not learners.
- `optional: true` only for enrichment content the plan marked as such; graded and core content is never optional.
- `loIds`: the objectives the block serves. `claimIds`: the claim-ledger IDs (`CLM-…`) the block's factual statements rest on. `citations`: `{sourceId, locator}` for those claims, pinpoint locators where the dossier has them. Keep citations in the structured fields; do not type bracket tokens into `body`.
- `accessibility`: the accessible alternative or note for anything not purely textual (how a visual's meaning is available in text, how an interaction is operated by keyboard). Essential content never lives only here.
- `difficulty`: `foundational`, `applied` or `integrative` for formative and graded items; `null` otherwise.

## Interactions (formative and graded blocks)

Every item is fully keyed. CourseForge checks key consistency per mode:

- `single`: 3–5 `options` (keys `A`, `B`, …); `correctKeys` exactly one key; `targets`, `mapping`, `order` empty.
- `multiple`: 4–6 options; `correctKeys` all correct keys (at least two, not all of them); stem says "Select all that apply".
- `matching`: `options` are the prompts, `targets` the answers (keys `T1`, `T2`, …); `mapping` pairs every option key to one target key.
- `categorization`: `options` are the items to sort, `targets` the categories; `mapping` assigns every item to one category; each category receives at least one item.
- `sequencing`: `options` are the steps (keys `S1`, `S2`, …); `order` lists every option key in the correct order.
- `reveal` (formative only, never graded): a reflection prompt in `stem`, the model answer in `rationale`; options and keys empty; `feedbackCorrect` is a one-line closing prompt and `feedbackIncorrect` is an empty string.

Quality rules: stems are complete and unambiguous on their own; graded items make sense in random order and do not depend on other items; no "all of the above" or "none of the above"; no trick wording or double negatives; distractors are plausible because they reflect real misconceptions from the plan, and are similar in length and grammar to the key. Provide `optionFeedback` for every incorrect option explaining the specific error. `feedbackCorrect` and `feedbackIncorrect` teach (why, not just "Correct!"). `rationale` explains the key with reference to the evidence; the block's `citations` must support the correct answer. Items test the objective at its intended level: use scenarios and interpretation for apply/analyse/evaluate objectives. Graded items must not copy formative items word for word. All interactions must be operable by keyboard and screen reader: no drag-only, hover-only, colour-only or timed mechanics.

## Visuals

Propose a visual only where it teaches something prose alone does poorly (a process, a structure, a comparison, a decision path). For each, set the block's `visualId` and add a VisualSpec to `visuals`:

- `id`: `{{subject}}-V01`, `{{subject}}-V02`, …; `title`; `purpose`: the instructional job, e.g. "shows that controls act at different points between hazard and exposure".
- `archetype`: the semantic structure from the closed list of 22 (the instructional-graphics skill explains which fits when).
- `content`: the real content. Fill the fields the archetype uses: `items` (id, label ≤ 40 characters, optional `detail`, `group`, `value`), `links` between item IDs, `groups`, `columns`/`rows` for matrix and comparison tables, `axes` and `chartType` for quantitative charts only. Leave unused arrays empty and unused values `null`. Labels are learner-facing text, not descriptions of what to draw.
- `sourceIds`: sources for the content shown. `interaction`: `none` unless a reveal genuinely helps. `rendererOverride` and `mermaid`: `null`.
- `textEquivalent`: `short` (one sentence naming what the figure shows) and `long` (the full meaning in prose or a list, so someone who never sees the figure learns the same thing). Never an instruction such as "Create a diagram of…" or "Alt text: …"; code rejects those.

## Glossary and acronyms

Add a glossary entry for each term this module introduces: `id` `GL-` plus a lowercase hyphenated slug of the term (`GL-safety-data-sheet`) so parallel modules converge on the same ID for the same term; plain-language `definition`; `sourceIds` for formal definitions. Acronyms: `id` `AC-` plus the acronym (`AC-SDS`), `expansion`, `firstUseBlockId` = the block in this module where it is first expanded.

## Safety and scope

Keep the design's qualification and safety boundaries. Explain concepts, responsibilities and when to stop and escalate; never turn awareness content into hazardous, clinical, engineering or legal operating instructions. Do not present the course as certification or official regulator training.

## Code verifies

Unique, well-formed IDs; no placeholders; answer-key consistency per mode; every objective assessed at least twice across the course; claim and source IDs resolve; visual text equivalents present and not authoring instructions; no drag-only interactions. Reviewers judge teaching quality, item quality, fidelity to the evidence and accessibility.
