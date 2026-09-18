---
name: research-planning
description: Scoping a course concept and planning its research (risk tier, assumptions, research questions, source hierarchy, dossier sections). Used by CourseForge CONCEPT and RESEARCH_BRIEF tasks.
disable-model-invocation: true
---

# Research planning

## Scoping a concept

A concept is a request, not a specification. Good scoping makes three things explicit: who the learners are and what they will do afterwards; what the course will not do; and what you had to assume.

- **Audience by task, not demographics.** "Laboratory coordinators who order and store chemicals but are not chemists" tells a designer what to explain; "adults 25–55" does not.
- **Outcome-shaped goals.** Goals describe what learners do with the knowledge (recognise, decide, escalate, document). Topic lists hide scope creep.
- **Assumptions are first-class.** Anything you infer (jurisdiction, depth, duration, audience seniority) is recorded as an assumption. Mark it high-stakes when a wrong guess could make the course legally wrong, unsafe or clinically misleading. High-stakes assumptions deliberately trigger a human gate.
- **Exclusions protect learners.** State operational, hazardous or professional-authorisation content as out of scope early; it is much harder to remove later.

## Risk tiers

| Tier | Typical subjects | Consequence of a teaching error |
|---|---|---|
| `high_stakes` | health, clinical, safety, hazardous materials, law and compliance, finance, security | injury, legal exposure, clinical harm, financial loss |
| `elevated` | professional practice with material consequences | rework, reputational or project harm |
| `standard` | general knowledge, soft skills | low |

Classify by what learners could do with the content, not by how the request labels it. An "awareness" course on chemical handling is still high stakes. When in doubt, choose the higher tier.

## Writing research questions

- Ask questions that a source can answer: "What must employers do when X, and what exceptions apply?" rather than "X regulations".
- Cover four kinds: **definitions** (every key term), **duties and responsibilities** (who must do what, especially where duties are split between parties or levels of government), **mechanisms and methods** (how things work, options and their limits), and **limitations and misconceptions** (what people get wrong, where evidence is weak).
- Add a **currentness** question wherever the answer changes over time (consolidated law, standard editions, guidance versions, statistics).
- Mark `core` only what the course cannot be taught responsibly without.

## Source hierarchy by subject type

- **Regulated practice:** legislation and regulation (the consolidated text) → the regulator's guidance → standards (clearly marked as voluntary unless incorporated by law) → professional bodies → peer-reviewed and textbooks → organisational material for description only.
- **Science and health:** systematic reviews and authoritative bodies → primary peer-reviewed studies → textbooks → professional guidance; news only to date events.
- **Technology and practice:** official specifications and documentation → standards → peer-reviewed → practitioner guidance; vendor material only to describe what exists, never for effectiveness claims.

Each rank's rationale should say what that type may and may not support.

## Designing the dossier plan for parallel research

Each dossier section is researched by a separate agent that cannot see the others. Therefore:

- Give each section a clear boundary and say in `notes` which neighbouring section owns adjacent material.
- Assign every core question to at least one section; avoid assigning the same question to several sections unless each covers a different jurisdiction or aspect, stated explicitly.
- Size sections to one focused session: typically 2–5 closely related questions.
- Put cross-cutting distinctions in every relevant section's notes ("keep law vs guidance explicit"; "record the consolidation date").
- A typical course needs 6–14 sections: context and definitions, legal and responsibility framework, core mechanisms or methods, each major method or control family, limitations and failure modes, implementation and escalation, currentness.

## Safety boundaries that work

Write boundaries as things the dossier must not produce, specific to the subject: no quantities or concentrations for hazardous processes; no step-by-step procedures for regulated tasks; no dosing; no instructions for bypassing controls; no individual legal or clinical advice. Pair each with what is allowed: concepts, duties, decision criteria, and when to escalate to which specialist.
