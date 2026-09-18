# Security policy

CourseForge runs powerful local coding agents on your machine and processes documents you give it. This page
describes what it does to limit risk and how to report a problem.

## Supported versions

Only the latest release on the default branch receives fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting ("Report a vulnerability" on the repository's Security tab)
rather than a public issue. Include the version, platform, steps to reproduce and impact. Expect an
acknowledgement within a week.

## Secrets

- CourseForge never asks for, stores or prints API keys, OAuth tokens or passwords. Agent CLIs use their own
  sign-in; `doctor` checks sign-in status through the CLIs without reading credential files.
- `.gitignore` excludes `.env*`, local settings, `.courseforge/` (machine state) and raw agent logs
  (`courses/*/logs/tasks/`).
- Environment information shared outside the machine-local `.courseforge/` folder is redacted
  (`redactEnvironment` in `src/environment/doctor.ts`: versions and statuses only, no absolute paths, user names
  or environment values).
- The fixture recorder (`COURSEFORGE_RECORD`) scrubs home paths, email addresses and token shapes, and refuses to
  write a fixture if a secret-like pattern survives.
- A repository test (`tests/unit/repo/hygiene.test.ts`) fails on absolute user paths and common secret patterns
  (OpenAI/Anthropic-style keys, GitHub tokens, AWS access keys, private keys) in tracked source, docs and
  fixtures.

## Agent sandboxing model

Defence in depth, strongest layer last:

1. **Least-privilege tasks.** The router gives each task only the tools its stage allows. Reviewers and the
   adjudicator are read-only; network tools are granted only to research tasks.
2. **CLI permissions.** Claude Code runs with `--permission-mode dontAsk`, an explicit tool list and `Edit`
   allow rules for the task's writable paths only. Codex runs with sandbox `read-only`, or `workspace-write` for
   artifact-writing tasks, and approval policy `never`. `danger-full-access` and permission bypass modes are never
   used.
3. **Isolation from user configuration.** Global hooks, plugins, MCP servers and settings are excluded by flags
   (Claude Code: `--safe-mode`, `--setting-sources project`, `--strict-mcp-config`; Codex:
   `--ignore-user-config`, `--ignore-rules`). Codex's global `AGENTS.md` cannot be excluded (see
   [ADR 0010](docs/adr/0010-cli-isolation-flags-not-config-dirs.md)).
4. **Write audit (the hard guarantee).** Every agent step is wrapped by a hash walk of the course folder. Any
   file changed outside the task's writable paths is restored from its snapshot or removed, the event is logged,
   and the stage fails with `write_violation`. Repairs are applied by CourseForge code, per object ID, only for
   targets in the approved repair plan and never to locked content.
5. **Processes.** All subprocesses are spawned from one module with `shell: false` and prompts on stdin, so
   course content is never interpolated into a shell command.

Agents can still read files within the repository and, for research tasks, fetch web pages. Do not keep
unrelated secrets inside the repository folder.

## Imported and generated content

- Imported originals are stored read-only and hash-verified; the original file you pass is never modified.
- Imported HTML is parsed, not executed, during ingestion; it runs only inside the QA browser.
- Built courses have a hashed Content-Security-Policy with `connect-src 'none'`, no external resources and no
  tracking. External source links are ordinary links the learner chooses to open.
- Generated SVG is sanitised (scripts, event handlers, `foreignObject` and external references removed).

## Logs

Course logs (`courses/<id>/logs/`) can contain course material and agent output. They stay inside the course
folder. `courseforge clean` removes transient logs and caches without touching approved artifacts.
