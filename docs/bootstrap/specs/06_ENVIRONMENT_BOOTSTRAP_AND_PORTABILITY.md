# 06 — Environment Bootstrap and Portability

## Goal

A GitHub user should be able to clone CourseForge, run one setup command, authenticate an available agent harness if necessary, and receive a verified local installation.

CourseForge must not assume that the user's global Claude/Codex skills, plugins, MCP servers, npm packages, or user instruction files are present or correct.

## Supported development baseline

Prefer a Node/TypeScript implementation to keep the core toolchain unified. Target Node.js 22.12+ (or a later minimum if dependency validation at build time proves necessary). Use npm and a committed lockfile for the baseline installation path.

Avoid requiring Python, Docker, Rust, Java, a database server, or proprietary desktop software for normal v1 operation.

## Setup entrypoints

Provide:

```text
setup.ps1       # Windows PowerShell
setup.sh        # macOS/Linux shell
```

Both should call the same underlying Node bootstrap logic wherever possible so platform scripts remain thin.

Also expose:

```text
npm run setup
npm run doctor
```

## Preflight checks

Before any pipeline work, deterministic code checks and writes an environment manifest containing at least:

- OS/platform and architecture;
- Node and npm availability/version;
- Git availability/version;
- Claude Code availability/version/auth readiness if detectable;
- Codex availability/version/auth readiness if detectable;
- local `node_modules`/lockfile integrity;
- Playwright package and Chromium browser availability;
- Mermaid/Mermaid CLI;
- SVG.js;
- D3;
- Vega/Vega-Lite;
- Lucide;
- Storybook development environment;
- axe-core;
- local CourseForge skills/plugins/adapters;
- required schemas/configuration validity;
- writable course/work directories;
- system status and repairability.

Example path:

```text
.courseforge/environment.json
```

## Doctor

`courseforge doctor` must:

1. inspect;
2. compare against required/pinned configuration;
3. classify problems as ready/repairable/manual prerequisite failure;
4. optionally repair repo-local issues;
5. rerun checks;
6. print concise results;
7. write machine-readable results.

Examples of automatic repair:

- missing/inconsistent `node_modules` → `npm ci`;
- missing Playwright Chromium → install Chromium;
- generated configuration absent → regenerate from checked-in defaults;
- corrupted local vendor cache → restore/fetch pinned source if policy permits;
- stale generated schemas → rebuild.

CourseForge must not silently rewrite users' global `~/.claude`, `~/.codex`, npm global configuration, or unrelated PATH entries.

## Prerequisite handling

If Git/Node/agent CLI is missing, setup should:

- detect it clearly;
- provide a safe supported installation path;
- automate installation only where the platform package manager and permissions allow;
- tolerate OS UAC/admin/browser authentication steps that require human interaction;
- resume verification afterward.

Authentication is a legitimate manual boundary. Do not store user credentials in the repository.

## Dependency policy

- Pin exact npm dependency versions through `package-lock.json`.
- Use repo-local dependencies.
- Do not require global npm installs for Mermaid, Playwright, Storybook, etc.
- Prefer `npx` against local packages or direct programmatic imports.
- Record third-party versions in a generated environment/build report.
- Separate development-only dependencies from released course output.

## Smoke verification

Setup is not considered successful just because packages install.

Run a tiny fixture that proves:

```text
fixture storyboard
→ build one HTML screen
→ render one structured diagram
→ launch Chromium
→ exercise one interaction
→ run axe
→ capture screenshot
→ verify expected artifact
```

Then print `READY` only if the smoke pipeline succeeds.

## Portability

Core runtime configuration belongs in the repository and is committed. Personal overrides belong in ignored local files.

A freshly cloned repository plus supported prerequisites should be sufficient. The public README must document:

- prerequisites;
- clone/setup commands;
- supported agent backends;
- how to run doctor;
- how to create/import a course;
- how to run the example fixture;
- troubleshooting.

