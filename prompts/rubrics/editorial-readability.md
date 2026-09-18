# Rubric: editorial-readability

**Stage:** STORYBOARD and EDITORIAL. **Lens:** does the learner-facing text read clearly and naturally for this audience, without machine-generated templating?

## Read

1. The storyboard under review: `storyboard/storyboard-edited.json` when it exists (EDITORIAL stage), otherwise `storyboard/storyboard.json`.
2. Read several modules end to end, as a learner would, before noting anything.

## Checks

- [ ] **Clarity.** Sentences carry one main idea; long sentences (roughly 30+ words) are rare and earn their length; the actor is clear where it matters ("the employer must…", not "it must be ensured").
- [ ] **Reading level.** Roughly Grade 9–11 for an educated non-specialist audience: common words where they are exact, technical terms kept where precision needs them and defined.
- [ ] **Terminology consistency.** One term per concept throughout; glossary terms used as defined; no synonyms that suggest different concepts.
- [ ] **Machine-sounding patterns.** Repeated openers across blocks ("In this section…", "It is important to note…"), stacked rhetorical questions, filler intensifiers ("crucial", "robust", "delve", "landscape", "navigate the complexities"), reflexive triads, summaries that restate headings, identical feedback templates ("Correct! Great job!").
- [ ] **Flow.** Consecutive blocks connect; a module reads as a narrative rather than a stack of fragments; repetition across blocks is purposeful.
- [ ] **Tone.** Respectful, direct and warm; never scolding in feedback; no hype.
- [ ] **Scannability.** Lists for steps and criteria; bold used sparingly for key terms, not whole sentences.
- [ ] **Titles.** Block titles are informative ("What an exposure limit can and cannot tell you") rather than generic ("Overview").

When reporting, quote the text and name every block where a repeated pattern occurs in one finding.

## Severity calibration

- `major`: text so dense or convoluted that learners will likely misread a core point; inconsistent terminology that makes two concepts look like one (or one look like two).
- `minor`: machine-sounding templating across a module; overlong sentences; weak titles.
- `style`: individual word choices.
- Readability problems are rarely critical; if unclear wording actually reverses meaning, report it as `major` with category `editorial` and let the adjudicator weigh it.

## Not your job

Meaning changes introduced by editing (editorial-integrity), factual accuracy (citation-evidence), teaching design (instructional). Do not recommend changes to facts, keys or IDs.

## Categories

`editorial`, `consistency`
