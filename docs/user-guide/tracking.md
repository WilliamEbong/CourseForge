# Tracking learner results

CourseForge can record who completed a course, their score, whether they passed and when they finished. This is
optional and off by default. You choose it in the setup questions, which run when a course is created or when
you run `courseforge configure --course <id>`.

## Where results can go

| Choice in the setup questions | What happens | What you need to do |
|---|---|---|
| No, don't keep records | Nothing is sent anywhere. The course works fully offline. | Nothing |
| Yes, my organisation has a training system (LMS) | The course reports its status (passed, failed or completed) and score to your training system (Moodle, Cornerstone, TalentLMS and so on) through SCORM 1.2. Learners are not asked for their name. | Upload `courses/<id>/release/course-scorm.zip` to the training system (instructions in `courses/<id>/tracking/lms-upload.md`). `courseforge package --course <id> --scorm` makes the package at any time. |
| Yes, send results to a Google Sheet | When learners finish, they type their name (and a staff number or email if you chose that) and press **Record my result**. One row is added to your Google Sheet. | About five minutes of one-time setup. CourseForge writes click-by-click instructions to `courses/<id>/tracking/google-sheet-setup.md`. |
| Yes, on our own results dashboard | The same as the Google Sheet option, but results go to `courseforge tracker`, a small results server with a password-protected page and a spreadsheet (CSV) download. | Try it on your own computer in ten minutes; for real use, someone from IT runs it behind HTTPS. Instructions: `courses/<id>/tracking/own-dashboard.md`. |

## What learners see

On the results screen (or, in a course with no graded questions, the last screen), once they have finished, a
box titled **Record your result** asks for the details you chose and has a **Record my result** button. If the
internet connection fails, the result is kept and they can press the button again; it is also retried the next
time the course is opened. A learner who retakes the assessment can record the new result, which becomes a
new row.

## Settings in `course.yaml`

```yaml
tracking:
  destination: none      # none | lms | sheet | tracker
  endpoint: null         # web address results are sent to
  identity: name         # name | name_and_id | name_and_email
  id_label: null         # label for the staff-number box
setup:
  configured_at: null    # when the setup questions were last answered
```

Changing `tracking` with `configure` marks the build, testing and release steps as out of date, and the next
`courseforge run` rebuilds the course. If you edit `course.yaml` by hand, rebuild yourself with
`courseforge run --course <id> --from build --force`. A web destination without an address yet is treated as
"not finished": the course builds without tracking and `courseforge status` reminds you.

## The results dashboard

```
courseforge tracker [--port 8787] [--host 127.0.0.1] [--data <dir>]
```

This starts the results server and dashboard. Set the dashboard password in the `COURSEFORGE_TRACKER_PASSWORD`
environment variable first. Courses send results to `http://<host>:<port>/api/events`. The dashboard is at
`http://<host>:<port>/` (any user name, your password), and it shows, per course, how many people finished and
passed, the pass rate and the average best score, followed by every result. Results are saved in
`.courseforge/tracker/results.jsonl` unless you give `--data`. How it works:
[Setup and tracking](../architecture/tracking.md).

## Limits

- **Scores are worked out on the learner's computer**, and the answers are inside the course file. This is fine
  for keeping a record of training, but a determined, technical person could fake a result. Do not use it for
  high-stakes certification.
- **A tracked course is no longer completely offline**: it may contact the one address you configured, and
  nothing else. CourseForge's build and testing steps check this
  ([ADR 0013](../adr/0013-optional-tracking.md)).
- **The address is inside the course file.** It lets anyone who has the file add results, but not read them.
