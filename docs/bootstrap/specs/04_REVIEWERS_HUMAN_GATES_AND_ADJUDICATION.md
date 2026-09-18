# 04 — Reviewers, Human Gates, and Adjudication

## Review philosophy

Do not ask the same generating agent to certify its own output. Each stage should use an ensemble of independent specialist reviewers with isolated context where practical.

Reviewers emit structured findings; they do not directly rewrite canonical artifacts.

## Finding schema

Minimum fields:

```json
{
  "findingId": "REV-0001",
  "stage": "STORYBOARD",
  "reviewer": "assessment-reviewer",
  "severity": "major",
  "category": "alignment",
  "artifactId": "ART-...",
  "location": "A12",
  "problem": "...",
  "evidence": ["LO4", "BLOCK-M4-B07"],
  "recommendedAction": "...",
  "confidence": "high"
}
```

Severity vocabulary:

- `blocker` — impossible/unsafe to proceed;
- `critical` — material factual, legal, safety, accessibility, or functional defect;
- `major` — meaningful quality/learning/integrity defect;
- `minor` — useful improvement, not release-blocking by default;
- `style` — editorial/aesthetic preference.

## Recommended reviewer panels

### Research
- evidence/source reviewer;
- domain completeness reviewer;
- currentness/jurisdiction reviewer when applicable;
- safety/scope reviewer;
- adversarial reviewer.

### Instructional design
- learning architecture reviewer;
- alignment reviewer;
- audience/cognitive-load reviewer;
- source-fidelity reviewer;
- assessment-strategy reviewer.

### Storyboard
- content completeness reviewer;
- instructional reviewer;
- assessment reviewer;
- citation/evidence reviewer;
- accessibility-planning reviewer;
- editorial/readability reviewer.

### Visual direction/build
- information-design reviewer;
- visual/UI reviewer;
- responsive reviewer;
- accessibility reviewer;
- content-integrity reviewer.

### Final course
- factual/currentness reviewer;
- gap-analysis reviewer;
- instructional reviewer;
- assessment-engine reviewer;
- functional/browser reviewer;
- accessibility reviewer;
- UI reviewer;
- UX reviewer;
- visual-consistency reviewer;
- release/adversarial reviewer.

## Adjudicator

A separate adjudicator receives all reviewer findings and:

1. deduplicates overlapping findings;
2. resolves contradictory reviewer advice;
3. rejects unsupported or preference-only recommendations where inappropriate;
4. checks recommendations against upstream evidence and human locks;
5. assigns final severity/priority;
6. groups repairs by affected artifact/block;
7. emits a deterministic repair plan.

The adjudicator does not casually change human-approved content. If a human lock conflicts with authoritative evidence, emit a conflict and follow configured policy rather than silently rewriting.

## Repair agent

The repair agent receives only:

- canonical artifact;
- approved repair plan;
- necessary upstream evidence;
- relevant stage contract.

It should avoid opportunistic unrelated rewrites.

After repair, deterministic validators and relevant reviewer/test subsets rerun.

## Human gate modes

Each major stage supports:

- `auto` — AI review/adjudication/repair and automatic approval if gates pass;
- `human` — stop after review report and require human action;
- `hybrid` — auto-fix clear issues, then present revised artifact and report for human approval.

Project configuration may define gates per stage.

Example:

```yaml
human_review:
  research: optional
  instructional_design: required
  storyboard: required
  editorial: optional
  visual_direction: optional
  course_build: optional
  course_qa: required
  release: required
```

## Human actions

A human should be able to:

- approve;
- reject;
- edit artifact outside CourseForge and re-ingest;
- replace artifact;
- add comments/instructions;
- lock specific sections/IDs;
- accept/reject individual findings;
- request another review cycle.

## Reviewer independence and parallelism

Run independent reviewers in parallel subagents where supported. Give each reviewer only the context it needs. Do not preload all skills into every reviewer.

The parent waits for all required findings before adjudication.

## Repair-cycle limits

Default maximum automated cycles per stage: 3. Configuration may vary by stage.

After repeated failure:

- emit unresolved findings;
- preserve all intermediate versions;
- either pause for human review or mark stage failed according to mode.

