---
name: alignment-review
description: Checking objective-content-practice-assessment alignment and evidence support in course designs and built courses. Used by CourseForge alignment and final instructional reviewers.
disable-model-invocation: true
---

# Alignment review

Alignment means four things line up for every objective: the evidence that makes it teachable, the content that teaches it, the practice that rehearses it, and the assessment that measures it, all at the same cognitive level.

## Build the alignment chain

For each objective, write down (mentally or in notes):

1. **Evidence:** the claim IDs that contain what a learner needs. Do they cover the whole objective, or only part?
2. **Teaching:** the modules and specific content points or screens that teach it. Listing the objective in `loIds` is not teaching; look for the actual explanation.
3. **Practice:** the formative items or activities, and their level.
4. **Assessment:** the graded items or method, and their level.

A break anywhere in the chain is a finding.

## Level matching

| Objective verb (typical level) | Teaching needs | Practice and assessment that fit |
|---|---|---|
| identify, recognise (remember/understand) | clear definitions and examples | classification, single choice with realistic examples |
| explain, describe (understand) | mechanism and reasons | choose the best explanation; reveal with model answer (practice only) |
| distinguish, compare, classify (analyse) | explicit contrasts, worked comparisons | categorisation, matching, scenario items that hinge on the distinction |
| interpret (analyse) | worked interpretation of real-looking information | items presenting a label, report or data extract to interpret |
| select, determine, apply (apply) | decision criteria, worked examples | scenario items with plausible alternative choices |
| evaluate, justify (evaluate) | criteria and trade-offs, limits of evidence | scenarios requiring the best-supported choice and its reason |
| sequence (apply) | the process and why its order matters | sequencing with a genuinely required order |
| escalate, document (apply) | boundaries, triggers, who to involve | scenarios where escalation or documentation is the correct action |

Recall items for analyse or evaluate objectives are misaligned even if the content is right.

## Common misalignments

- **Orphan objective:** listed but never actually taught.
- **Unassessed objective:** fewer than two graded items, or items below the objective's level.
- **Untaught assessment:** an item needs a fact, distinction or procedure not taught before it.
- **Level drift:** teaching at "understand", assessing at "evaluate" (unfair) or the reverse (invalid).
- **Evidence mismatch:** the objective promises more than the claims support.
- **Compound objectives:** "identify and evaluate and document" cannot be assessed cleanly; split or focus.
- **Weighting:** the most important objectives get the fewest items.
- **Practice gap:** first contact with a decision type happens in the graded assessment.

## Writing alignment findings

Location is the objective ID (or item ID for an untaught item). Evidence lists the chain: objective statement, the claims, the teaching content point or screen, and the item stem, showing where it breaks. Recommend the smallest fix: add a teaching point to a named module, retarget an item's level, split an objective.

## What code already checks

Code confirms every objective appears in a module and in the alignment table, every module objective exists, IDs resolve, and each objective has at least two graded items. It cannot judge whether teaching is real, levels match, or evidence is sufficient.
