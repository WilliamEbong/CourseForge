# ADR 0013: Optional learner tracking relaxes the offline invariant per course

## Context

Organisations that deploy a course want to know which staff completed it, their score and when. v1 courses are
single offline HTML files: the Content-Security-Policy sets `connect-src 'none'`, `checkSingleFile` requires
it, and QA treats any network request as a critical failure. [ADR 0012](0012-phased-scope.md) deferred SCORM
and xAPI packaging.

## Decision

- Tracking is optional deployment configuration in `course.yaml` (`tracking.destination`: `none`, `lms`,
  `sheet`, `tracker`), never part of the course model. The default is `none`, and a `none` build is identical to
  a v1 build.
- For `sheet` and `tracker`, the CSP `connect-src` lists **exactly** the destination's origins (for Google Apps
  Script, `https://script.google.com` and its redirect host `https://script.googleusercontent.com`).
  `checkSingleFile` accepts `'none'` or exactly that list, and nothing else. QA answers requests to those origins
  with a stub response and records them. Any other request is still blocked and is still a critical finding.
- `lms` uses SCORM 1.2 through the `API` object that the LMS provides in a parent frame. It makes no network
  requests of its own, so the CSP is unchanged. `courseforge package --scorm` produces the SCORM zip, which
  supersedes the SCORM deferral in ADR 0012. xAPI remains deferred.
- Learners identify themselves on the results screen, after finishing, and never in a start dialog. This keeps
  the course's start and navigation contract unchanged.

## Consequences

- A tracked course is no longer fully offline. The only exception is the declared origin, and the build, QA
  and release gate all verify that.
- Scores are computed in the browser and the answer keys ship in the HTML, so a determined learner can forge a
  result. This is acceptable for completion tracking but not for high-stakes certification, and the user docs
  say so.
- The endpoint URL is a write-only capability and is embedded in the published HTML by design.
- Changing tracking settings invalidates only COURSE_BUILD and the stages after it.
