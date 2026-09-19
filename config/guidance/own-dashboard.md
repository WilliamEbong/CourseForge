# Run your own results dashboard for "{{title}}"

With this option, results go to a small results server that CourseForge runs on a computer your organisation
controls. When a learner finishes the course and presses **Record my result**, their name, score, pass or fail,
and the date are saved on that computer. You see them on a password-protected web page, and you can download
them as a spreadsheet.

You do not need a Google account or a training system. What you do need is a computer that stays switched on
and that learners' computers can reach. For anything beyond a quick test, you also need someone from IT for
about an hour.

## Part 1: try it on your own computer (10 minutes, no IT needed)

This shows you how it works before involving anyone else. Results only arrive from courses opened on this same
computer.

1. Choose a password for the dashboard.
2. Open the terminal where you use CourseForge and start the dashboard. On Windows (PowerShell):

   ```
   $env:COURSEFORGE_TRACKER_PASSWORD = "choose-a-password"
   courseforge tracker
   ```

   On a Mac or Linux:

   ```
   COURSEFORGE_TRACKER_PASSWORD="choose-a-password" courseforge tracker
   ```

3. Leave that window open. It shows two addresses:
   - the **dashboard**, `http://localhost:8787/`
   - where **courses send results**, `http://localhost:8787/api/events`
4. Open a **second** terminal window and run:

   ```
   courseforge configure --course {{courseId}}
   ```

   Press **Enter** to keep your answers until you are asked for the address of your results dashboard. Paste
   `http://localhost:8787/api/events` and press **Enter**. CourseForge sends a test result.
5. Open <http://localhost:8787/> in your browser. When asked, type any user name and your password. A row
   marked **(setup test)** is there.
6. Rebuild the course (`courseforge run --course {{courseId}} --from build`), open `{{releaseFile}}`, finish
   it, and press **Record my result**. Refresh the dashboard to see your result.

To stop the dashboard, click its terminal window and press **Ctrl+C**. The results stay saved and are there
again the next time you start it.

## Part 2: set it up for real (for your IT person)

Please pass this section to whoever looks after your servers. These are the requirements; how to meet them
depends on your setup.

1. **A host that stays on.** Run `courseforge tracker --host 0.0.0.0 --port 8787` as a service (for example a
   systemd unit, a Windows service or a container) with `COURSEFORGE_TRACKER_PASSWORD` set in its environment.
   Results are appended to `.courseforge/tracker/results.jsonl` inside the CourseForge folder; use
   `--data <dir>` to put them elsewhere, and include that directory in backups.
2. **HTTPS in front of it.** The server speaks plain HTTP. Put it behind a reverse proxy that terminates HTTPS
   (nginx, Caddy, IIS, a cloud load balancer) with a certificate for a name such as `results.example.org`.
   Courses reject plain `http://` addresses other than `localhost`, and browsers block a course served over
   HTTPS from sending to an HTTP address.
3. **Reachability.** Learners' browsers must be able to reach `https://<name>/api/events`. The dashboard (`/`)
   and the downloads (`/api/events`, `/api/events.csv`) need only be reachable by the people who read results;
   they are protected by the password (HTTP Basic, so only ever over HTTPS).
4. **Limits.** The server accepts results up to 8 KB, validates their shape, and accepts at most 60 results
   per minute from one address. If many learners share one address (for example behind a corporate proxy),
   configure your proxy to pass the real client address or to rate-limit itself.
5. **The course's address.** Once it works, run `courseforge configure --course {{courseId}}` and enter
   `https://<name>/api/events`, then rebuild the course.

## Good to know

- **Who can see the results?** Only people who know the dashboard password.
- **Anyone with the course file can send results**, but cannot read any. Share the course only with the people
  who should take it.
- **Scores are worked out on the learner's computer.** This is fine for keeping a record of training, but a
  determined, technical person could fake a result. Do not use it for high-stakes exams.
- **Each attempt is kept.** The dashboard counts each person once per course and uses their best score. The
  spreadsheet download has every attempt.
