# Task: apply the approved repair plan for stage `{{stage}}`

Course `{{courseId}}`, "{{courseTitle}}". Cycle {{cycle}}. Audience: {{audience}}. Language `{{language}}`. Jurisdiction: {{jurisdiction}}. Risk tier `{{riskTier}}`.

Human instructions: {{instructions}}
Locked IDs, which you must never modify or return: {{locks}}

The approved repair actions (each has `actionId`, `targetId`, `findingIds`, `severity`, `category`, `instruction`):

```json
{{extra}}
```

## Your role

You make exactly the changes the approved actions describe, nothing more. The plan was produced by review and adjudication; you do not re-review the artifact, and you do not improve things the plan did not mention, however tempting.

## Procedure

1. Read the canonical artifact listed in Inputs and locate each `targetId`.
2. Read the upstream evidence each instruction relies on (claims, sources, design) before changing factual content. If an instruction asks for a fact, citation or locator, take it from the evidence; never invent one.
3. For each target, produce the complete replacement object with the instructed change applied and everything else byte-for-byte the same in meaning: same `id`, same keys, same field order, same values in fields the instruction does not touch.
4. Check your replacement against the constraints below before returning.

## Output field guidance

- `replacements`: one entry per target object.
  - `targetId`: the ID of the object being replaced, exactly as in the plan.
  - `objectJson`: the whole replacement object serialised as a JSON string, in the same shape the artifact file uses for that object (for example a full storyboard block including its `interaction`; a full VisualSpec; a full learning objective; a full module plan; a full research-question or dossier-plan entry). It must parse as JSON and validate against that item's schema; do not wrap it in Markdown fences or add commentary.
  - `actionIds`: every action this replacement satisfies. Several actions on the same target go into one replacement.
  - Whole-document repairs: when the context says `wholeDocumentReplacementAllowed: true` and a target is a field
    or section rather than an object with an `id` (for example `jurisdictions` or `sourceHierarchy`), return ONE
    replacement with `targetId` `global` whose `objectJson` is the complete artifact with every approved action
    applied and nothing else changed; list all the action IDs it satisfies.
- `notes`: one line per action, stating what you changed. If an action could not be carried out as written (the instruction contradicts the evidence, the target does not exist, or it would require touching a locked ID or another target), do not improvise: skip it and explain here.

## Constraints (checked by code)

- Only targets named in the plan may appear; any other object, and any locked ID, causes the whole repair to be rejected and rolled back.
- IDs are preserved. Do not renumber blocks, options or items; do not change an object's `id`.
- After repair, validators rerun: answer keys must stay consistent per interaction mode, citations and claim IDs must resolve, visuals must keep a genuine text equivalent, no placeholders may appear.
- Preserve qualifications, negations, modality ("must" vs "should") and safety boundaries in every sentence you touch.
- When fixing an assessment item, keep the options, keys, per-option feedback and rationale mutually consistent; if you change which option is correct, update all of them.
