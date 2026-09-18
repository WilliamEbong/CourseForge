# Installation

## Requirements

| Requirement | Notes |
|---|---|
| Node.js ≥ 22.12 | 24 LTS recommended (`.nvmrc` / `.node-version` say `24`). `.npmrc` sets `engine-strict` |
| npm ≥ 10 | Ships with Node |
| Git | For cloning; `doctor` treats it as advisory afterwards |
| Disk | About 1 GB: dependencies plus Playwright Chromium (shared per-user cache, outside the repo) |
| RAM | 2 GB free or more recommended; QA uses one Chromium instance |
| Optional | Claude Code (`claude`) and/or Codex CLI (`codex`), installed and signed in, for live generation |

Supported platforms: Windows 10/11 (PowerShell 5.1 or 7, Git Bash), macOS, Linux.

## Setup

```powershell
.\setup.ps1              # Windows
```

```sh
./setup.sh               # macOS, Linux, Git Bash
```

The wrappers only check for Node.js. If it is missing or older than 22.12 they print the install command
(`winget install OpenJS.NodeJS.LTS`, `brew install node@24`, or `fnm install 24`) and exit 2. They never install
system software, change `PATH`, or touch global configuration. `setup.ps1` also runs `Unblock-File` on the
repository's own `.ps1`/`.cmd` wrappers, which carry Mark-of-the-Web after a ZIP download.

Then `scripts/bootstrap.mjs` (dependency-free, runs before `node_modules` exists) performs these steps, each
fingerprinted in `.courseforge/state.json` so reruns skip unchanged work:

| Step | What happens |
|---|---|
| environment | Records platform, Node/npm versions, RAM, cloud-sync folder advisory |
| dependencies | `npm ci --no-audit --no-fund`, skipped when the lockfile hash is unchanged; retried on `EPERM`/`EBUSY`/`ENOTEMPTY` |
| browser | Installs Playwright Chromium into the shared browser cache unless already present |
| build | `tsc -p tsconfig.build.json` into `dist/`, skipped when sources are unchanged |
| doctor --repair | Runs the doctor catalogue and fixes repository-local issues |
| smoke fixture | Builds a small course, renders diagrams, launches Chromium, drives an interaction, runs axe, takes a screenshot |

`READY` is printed (exit 0) only if the browser, doctor and smoke steps succeed; otherwise `NOT READY` with
numbered next actions (exit 3).

Flags (pass after the script name, for example `.\setup.ps1 --no-smoke`):

| Flag | Effect |
|---|---|
| `--no-smoke` | Skip the smoke fixture |
| `--offline` | Skip network steps (install and browser download) |
| `--ci` | Plain output for CI logs |
| `--json` | Machine-readable summary on stdout |

`npm run setup` runs the same bootstrap. `courseforge setup [--no-smoke]` runs `doctor --repair` and the smoke
fixture from an already installed checkout.

## Running the CLI

No global install is needed:

```sh
./courseforge <command>            # macOS / Linux / Git Bash
.\courseforge <command>            # Windows (courseforge.cmd)
npm run courseforge -- <command>
node bin/courseforge.mjs <command>
```

`bin/courseforge.mjs` runs the compiled CLI from `dist/`, or the TypeScript sources through `tsx` in a
development checkout that has not been built.

## Checking the environment

```sh
./courseforge doctor              # human-readable report
./courseforge doctor --json       # machine-readable manifest
./courseforge doctor --repair     # fix repository-local problems
./courseforge doctor --only node.version,pw.chromium
```

Checks: `os.platform`, `os.ram`, `os.disk`, `node.version`, `npm.version`, `git.present`, `git.longpaths`
(Windows, repairable locally), `git.autocrlf`, `path.cloudsync`, `path.length`, `deps.lock`, `deps.packages`,
`pw.chromium`, `build.dist`, `config.valid`, `schemas.drift`, `project.instructions`, `claude.cli`,
`claude.auth`, `claude.globalconfig`, `codex.cli`, `codex.auth`, `codex.globalconfig`, `fs.writable`. Each is
classified `ready`, `repairable` or `manual`. Agent sign-in is checked without a model call and without reading
credential files. `--repair` only changes things inside the repository (dependencies, browser cache, `dist/`,
schemas, repository-local git config).

## Signing in to an agent backend

```sh
claude            # run once and sign in, then exit
codex login
./courseforge doctor --only claude.auth,codex.auth
```

CourseForge uses whichever is available (Claude first by default) unless a course or run pins one. See
[configuration.md](configuration.md#course-yaml).

## Uninstalling

Delete the repository folder. The only files outside it are the shared Playwright browser cache
(`%LOCALAPPDATA%\ms-playwright` on Windows, `~/Library/Caches/ms-playwright` on macOS, `~/.cache/ms-playwright`
on Linux), which other Playwright projects may share.
