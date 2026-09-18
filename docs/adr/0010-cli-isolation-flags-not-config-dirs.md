# ADR 0010: Isolate agent CLIs with flags, not config-directory redirection

## Context

A developer's global agent configuration (hooks, plugins, output styles, personal instructions, MCP servers) is
inherited by spawned CLIs and can change course prose or tool behaviour. Redirecting `CLAUDE_CONFIG_DIR` or
`CODEX_HOME` would isolate them but also hide the user's sign-in, and CourseForge must never modify global files.

## Decision

Isolate with command-line flags only:

- Claude Code: `--safe-mode` (no user CLAUDE.md, plugins, hooks, output styles or MCP), `--setting-sources
  project`, `--strict-mcp-config`, `--permission-mode dontAsk`, an explicit `--tools` list and `Edit(...)` allow
  rules for writable paths. Not `--bare`, which disables OAuth/keychain sign-in.
- Codex: `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, sandbox `read-only` or `workspace-write`,
  approval policy `never`.

Both receive a role preamble telling the agent to ignore unrelated user-level instructions. Flags are probed from
`--help` and passed only when present. `doctor` reports detected global configuration (`claude.globalconfig`,
`codex.globalconfig`) without reading its contents or changing it.

## Consequences

- Sign-in keeps working and nothing global is touched.
- **Codex isolation is partial.** `~/.codex/AGENTS.md` is always loaded by Codex, and no flag disables it in the
  tested version. The preamble (sent as `developer_instructions`) mitigates this but cannot guarantee it. This is
  documented as a limitation.
- The pipeline's write audit, not CLI permissions, remains the hard guarantee on file writes.
