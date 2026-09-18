# Troubleshooting

Start with:

```sh
./courseforge doctor            # add --json for details, --repair to fix repository-local issues
./courseforge status --course <id>
```

Set `COURSEFORGE_DEBUG=1` for stack traces. Every run writes `courses/<id>/logs/run-events.jsonl`; failed agent
tasks keep raw output in `logs/tasks/`.

## Setup

| Symptom | Cause | Fix |
|---|---|---|
| `CourseForge needs Node.js 22.12 or newer` | Node missing or old | Install Node 24 LTS (`winget install OpenJS.NodeJS.LTS`, `brew install node@24`, `fnm install 24`), open a new terminal, rerun setup |
| "running scripts is disabled on this system" | PowerShell execution policy | `Set-ExecutionPolicy -Scope Process Bypass` then `.\setup.ps1` (this session only) |
| Scripts blocked after downloading a ZIP | Mark-of-the-Web | `setup.ps1` unblocks its own wrappers; for others: `Get-ChildItem -Recurse -Include *.ps1,*.cmd \| Unblock-File` |
| `npm ci` fails with `EPERM`, `EBUSY` or `ENOTEMPTY` | Files locked by a sync client, antivirus or an open editor/terminal | Close tools using `node_modules`, pause OneDrive/Dropbox/iCloud sync, rerun. Better: keep the repo outside synced folders |
| `pw.chromium` repairable | Playwright Chromium not downloaded | `npx playwright install chromium`; Linux also needs system libraries: `npx playwright install --with-deps chromium` (needs sudo) |
| Chromium download blocked by a proxy | Corporate network | Set `HTTPS_PROXY` for the setup run, or install Chromium manually; a system Chrome/Edge is detected as a warning-level fallback |
| `build.dist` repairable | Sources changed since the last build | `npm run build` or `courseforge doctor --repair` |
| `git.longpaths` warning (Windows) | Deep paths in `node_modules` | `courseforge doctor --repair` sets `core.longpaths` for this repository only |
| `path.length` advisory | Repo path longer than 120 characters on Windows | Clone to a shorter path, e.g. `C:\src\CourseForge` |

## Cloud-synced folders

`doctor` reports `path.cloudsync` when the repository is inside OneDrive, Dropbox, iCloud Drive or Google
Drive. Sync clients lock files while uploading, which causes intermittent `EPERM`/`EBUSY` errors and uploads
thousands of dependency files. CourseForge retries atomic writes with backoff and keeps browsers and temp
clones outside the repository, but the reliable fix is to pause sync for the folder or clone elsewhere.

## Resources

| Symptom | Fix |
|---|---|
| Doctor `os.ram` advisory, slow or crashing QA | Close other browsers and heavy apps. QA uses one Chromium with two pages; reviewer pools spawn up to 3 agent processes. Use `COURSEFORGE_QA_PROFILE=smoke` while iterating |
| Low disk advisory | Free space; Chromium plus dependencies need about 1 GB |

## Agent backends

| Symptom | Fix |
|---|---|
| `No agent backend available` / failure class `unavailable` | Install Claude Code or Codex CLI and sign in, or use `--harness fake` with fixtures |
| `claude.auth` not signed in | Run `claude` once interactively and sign in. The desktop app's sign-in may not apply to the CLI |
| `codex.auth` not signed in | `codex login` |
| `authentication_failed`, `billing_error` | Sign in again; check plan or credit; `backend_fallback: true` plus `fallbacks.json#backend.enabled` allows switching backend |
| `rate_limit`, `overloaded` | Retried automatically (2 retries with backoff); rerun `continue` later |
| `schema_invalid` after retry | The model returned output that did not match the schema twice; see `logs/tasks/`, then `continue` |
| `timeout` | Raise `limits.taskTimeoutSec` for the stage in `config/stages.json` |
| Course prose shows a personal style or unrelated instructions (Codex) | Codex always loads `~/.codex/AGENTS.md`; CourseForge cannot disable it. Temporarily move that file or use Claude Code for course generation |
| Personal Claude hooks/plugins/CLAUDE.md seem to apply | They should not (`--safe-mode`, `--setting-sources project`). Check `claude --version` and `doctor`'s `claude.globalconfig`; an older CLI may lack a flag |

## Runs

| Symptom | Fix |
|---|---|
| Exit 5, "Course is locked by pid …" | Another run is active. If that process is gone on this machine the lock is stolen automatically; from another machine, delete `courses/<id>/.lock` after confirming nothing runs |
| Exit 10 | A gate is waiting: `status`, then `gate approve` / `gate reject` and `continue` |
| Exit 11, `write_violation` | An agent wrote outside its allowed paths; the change was rolled back. See `audit.violation` in `run-events.jsonl` |
| Exit 11, `input_invalid` | A required input of the stage is missing; run the earlier stage or import it |
| Exit 4 | Release gate blocked; read `release/release-decision.json` |
| Exit 2 on ingest ("Could not confidently infer the production stage") | Add `--stage <stage>` or `--conservative` |
| Unexpected `SUPERSEDED` stages | An upstream stage changed; `continue` regenerates them |

## Resetting safely

```sh
./courseforge clean --course <id> --dry-run      # see what would be removed (generated files only)
./courseforge clean --course <id> --build
./courseforge versions list --course <id>
./courseforge versions restore --course <id> --label <label>
```

`clean` never removes sources, originals, versions or approved artifacts. To discard a course entirely, delete
its folder yourself.
