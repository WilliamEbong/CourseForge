# 13 — Security, Privacy, and License Policy

## Repository-local safety

CourseForge will invoke powerful local coding agents and shell commands. Its architecture must minimize accidental exposure or destructive behavior.

## Secrets

- Never commit credentials, API keys, OAuth tokens, browser profiles, `.env` secrets, or harness authentication files.
- Add appropriate ignore patterns from the first commit.
- Environment reports must not print raw secrets.
- If an agent needs environment-variable names, redact values.
- Do not read arbitrary credential files unless explicitly required and permitted.

## Global configuration

CourseForge must not depend on modifying `~/.claude`, `~/.codex`, global npm configuration, or unrelated user files.

Project-local instructions/configuration are canonical. Global user configuration may exist but should be treated as external, potentially conflicting context; environment/preflight should warn about material conflicts where detectable without modifying them.

## File safety

- Preserve imported originals.
- Use allowlisted writable directories for subagents where possible.
- Parallel agents must have disjoint ownership or isolated worktrees.
- Deletion/cleanup should be limited to CourseForge-generated cache/build paths.
- Never recursively delete a user-provided course folder without explicit user intent.

## Network use

Research stages may use the web through the active agent harness according to user/provider capabilities. Build/QA should not require arbitrary network access except package installation/update and optional reference checking.

Released single-file courses should not make hidden tracking/network requests. External source links are explicit learner actions.

## Third-party licensing

Before vendoring/copying upstream code, skills, prompts, icons, or examples:

1. inspect repository/package license;
2. determine whether redistribution/modification is permitted;
3. preserve required notices/attribution;
4. record source, version/commit, and license under `vendor/LICENSES/` or equivalent;
5. prefer normal package dependencies when that reduces redistribution complexity.

Do not assume GitHub visibility means permissive reuse.

## Example course content

The included chemical-risk example is provided as a development/reference fixture for this project. The final public repository should review whether all included source text/citations are appropriate to redistribute and whether a lighter fixture should replace any oversized portfolio artifact.

## Agent logs

Logs can contain user/course material. Keep them inside the project/course structure and document their contents. Provide a cleanup command for transient logs/cache without deleting approved artifacts.

## Generated content safety

CourseForge must preserve subject-specific safety boundaries. It should not convert awareness-level source material into hazardous operational instructions, professional authorization, medical/legal advice, or unsafe procedures merely to make a course more actionable.

High-stakes subjects should default to stronger human-review gates.

