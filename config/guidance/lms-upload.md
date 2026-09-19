# Put "{{title}}" into your organisation's training system

Your organisation's training system is sometimes called an LMS (learning management system). Common ones are
Moodle, Cornerstone, TalentLMS, Docebo, SAP SuccessFactors and Totara. It already knows who your staff are. It
records who completed the course, their score and the date, and shows this in its own reports. You do not need
a Google account or any extra setup.

To add a course, these systems accept a special zip file, called a **SCORM package**. CourseForge makes it for
you.

## Step 1: get the package

When the course is released, CourseForge saves the package at:

`{{scormFile}}`

If the course was released before you chose this option, rebuild it first:

```
courseforge run --course {{courseId}} --from build
```

You can also make the package at any time after the course is built:

```
courseforge package --course {{courseId}} --scorm
```

Do not unzip the file. The training system needs the zip exactly as it is.

## Step 2: upload it

Every training system looks a little different, but the steps are nearly always these:

1. Sign in to the training system with an account that can add courses. If you are not sure you have one, ask
   the person who looks after the training system. Send them this file and the zip, and they can do the rest.
2. Find the place to add a course. It is usually called **Add course**, **Create course**, **Upload content**
   or **Content library**.
3. When asked what kind of content it is, choose **SCORM package** (or **SCORM 1.2**).
4. Choose the zip file from Step 1 and upload it.
5. Give the course a name, for example `{{title}}`, and save.
6. Assign the course to the staff who should take it, the same way you assign any other course.

Before you assign it to everyone, open the course once yourself (many systems have a **Preview** or **Launch**
button). Finish it and check that the training system shows it as completed.

## What the training system records

- **Status**: *incomplete* when someone starts, then *passed* or *failed* when they finish the assessment. A
  course with no assessment is marked *completed*.
- **Score**: the percentage of assessment questions answered correctly.
- **Pass mark**: the passing score set in the course is included in the package, so the training system uses
  the same pass mark.
- **Date**: the training system records when each person finished.

Learners are not asked for their name, because the training system already knows who they are.

## If something goes wrong

- **The course opens, but the results screen says the training system could not be reached.** The training
  system did not provide the connection CourseForge expects. Ask the training system's administrator whether it
  supports **SCORM 1.2**. Most do; some newer systems also need an option such as *"Allow SCORM 1.2"* switched
  on.
- **The upload is rejected.** Check that you uploaded the zip file itself, not a folder or the unzipped
  contents.

## Good to know

- **Scores are worked out on the learner's computer.** This is fine for keeping a record of training, but a
  determined, technical person could fake a result. Do not use it for high-stakes exams.
- **After you change the course**, rebuild it and upload the new package in the training system (usually
  **Replace content** or **Upload new version**). Check your system's help for whether learners keep their
  earlier results.
