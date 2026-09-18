# Laboratory Chemical Risk, Incident Investigation, and CAPA
## Interactive HTML Build QA Report

**Build:** `06_chemical_risk_capa_interactive_course.html`  
**Source storyboard:** `06_chemical_risk_capa_course_storyboard_humanized.md`  
**QA date:** 18 September 2026

## Structural verification

- Instructional/review content blocks implemented: **94**
- Formative self-assessments implemented: **24**
- Graded assessment items implemented: **15**
- Total navigable screens: **133**
- Original instructional visuals implemented: **20**
- Glossary terms implemented: **29**
- Acronyms implemented: **9**
- External reference records implemented: **38**
- Course modules/menu groups: **11**

## Functional verification

Automated Chromium testing verified:

- Every one of the 133 screens can be reached in sequence.
- No blank screens were found.
- No JavaScript page errors were produced during full-screen traversal.
- Desktop rendering completed successfully at 1440 × 1000.
- Mobile rendering completed successfully at 390 × 844.
- Responsive mobile course menu opens correctly.
- Glossary search/dialog opens and contains glossary and acronym entries.
- Reference search/dialog opens and contains all parsed reference records.
- Citation chips open source details and authoritative links where an external reference exists.

## Interaction verification

All **39** formative and graded interactions were exercised using their storyboard-defined correct answers:

- single-select / scenario judgment: pass
- multiple response: pass
- matching: pass
- categorization: pass
- sequencing with keyboard-operable up/down controls: pass
- graded scenario analysis/evaluation: pass

Results:

- Formative items passing correct-answer path: **24/24**
- Graded items passing correct-answer path: **15/15**
- Fully correct graded run: **15/15, 100%**
- JavaScript errors during interaction test: **0**

## Accessibility and UX features implemented

- Semantic buttons, radio buttons, checkboxes, selects, and forms
- Keyboard-operable sequencing; no drag-only task
- Skip-to-content link
- Visible focus-compatible native controls
- Text alternatives for all 20 instructional diagrams
- No instructional meaning dependent on colour alone
- Responsive navigation for desktop and mobile
- Reduced-motion media-query support
- Screen-reader status regions for answer feedback
- Source citations attached to the content or assessment they support
- Mobile access to glossary and references through the course menu

## Course behaviour

- Standalone single-file HTML: **yes**
- Embedded CSS: **yes**
- Embedded JavaScript: **yes**
- External JavaScript dependencies: **none**
- External CSS/font dependencies: **none**
- Progress persistence: local browser storage where available, with in-memory fallback if storage is unavailable
- Assessment reset: included
- Course-progress reset: included
- Glossary/reference search: included

## Known boundaries

- External reference links require an internet connection when the learner chooses to open them; the course itself does not require a network connection.
- This build does not yet contain SCORM/xAPI/LMS communication. It is the standalone portfolio/web version discussed in the design phase.
- Automated accessibility checks and browser interaction tests reduce implementation risk but do not replace a formal accessibility audit with assistive technologies and human users.
- Legal/regulatory source-currentness flags from the storyboard remain applicable and should be rechecked before future publication or operational deployment.
