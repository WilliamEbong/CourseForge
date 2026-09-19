# Send results for "{{title}}" to a Google Sheet

When a learner finishes the course and presses **Record my result**, one row is added to a Google Sheet that you
own. The row holds their name, score, whether they passed, and the date and time. A second tab, **Summary**, shows
how many people finished each course, how many passed, and the average score.

You need a free Google account. The setup takes about five minutes and you only do it once; later courses can
reuse the same sheet.

## Part 1: create the sheet

1. Go to <https://sheets.google.com> and sign in with the Google account that should own the results.
2. Click **Blank spreadsheet** (the big **+** tile).
3. Click **Untitled spreadsheet** at the top left and type a name, for example `Course results`. Press Enter.

## Part 2: add the CourseForge connection

1. In the spreadsheet menu, click **Extensions**, then **Apps Script**. A new browser tab opens with a code editor.
2. Click inside the editor, press **Ctrl+A** (Mac: **Cmd+A**) to select everything in it, and press **Delete**.
3. On your computer, open this file with Notepad (Mac: TextEdit):
   `{{scriptFile}}`
4. In Notepad, press **Ctrl+A**, then **Ctrl+C** to copy everything.
5. Go back to the Apps Script tab, click inside the empty editor and press **Ctrl+V** to paste.
6. Click the **Save** icon (a floppy disk) above the editor, or press **Ctrl+S**.
7. At the top left, click **Untitled project** and name it `CourseForge results`. Click **Rename**.

## Part 3: switch the connection on

1. Click the blue **Deploy** button at the top right, then **New deployment**.
2. Next to **Select type**, click the gear icon and choose **Web app**.
3. Fill in the form:
   - **Description**: `CourseForge results`
   - **Execute as**: **Me** (your email address)
   - **Who has access**: **Anyone**
4. Click **Deploy**.
5. Google asks you to authorise the connection. Click **Authorize access** and choose your account.
6. You may see a warning, **Google hasn't verified this app**. The connection is the script you just pasted, and it
   can only write to this one spreadsheet, so it is safe to continue. Click **Advanced**, then
   **Go to CourseForge results (unsafe)**, then **Allow**.
7. You now see **Web app** with a **URL** ending in `/exec`. Click **Copy** under it.

> If **Anyone** is not offered under **Who has access**, your organisation's Google administrator has switched it
> off. Ask them to allow it for this spreadsheet, or use a personal Google account instead.

## Part 4: give the address to CourseForge

1. Open the terminal where you use CourseForge and run:

   ```
   courseforge configure --course {{courseId}}
   ```

2. Press **Enter** to keep each answer, until you are asked for the web address of your Google Sheet connection.
   Paste the address you copied (right-click, then **Paste**) and press **Enter**.
3. CourseForge sends a test result. In your spreadsheet, a **Results** tab appears with a row named
   **CourseForge setup test**. That row is only a test; you can delete it.
4. If the course has already been built, CourseForge says it must be rebuilt. Rebuild it with:

   ```
   courseforge run --course {{courseId}} --from build
   ```

   If the course has not been built yet, there is nothing more to do: the connection is included when it is.

The finished course is saved at `{{releaseFile}}`. Share that file with your learners in the usual way, for
example on your intranet or in a shared drive.

## Good to know

- **Who can see the results?** Only people you share the spreadsheet with. The course can add rows but cannot
  read the sheet.
- **The web address is written inside the course file.** Anyone who has the course file could add rows to your
  sheet. Share the course only with the people who should take it.
- **Scores are worked out on the learner's computer.** This is fine for keeping a record of training, but a
  determined, technical person could fake a result. Do not use it for high-stakes exams.
- **Each attempt is a new row.** If someone retakes the assessment, you see both attempts. The **Summary** tab
  counts each person once and uses their best score.
- **If you change the script later**, click **Deploy**, then **Manage deployments**, then the pencil icon. Under
  **Version**, choose **New version** and click **Deploy**. The address stays the same.
