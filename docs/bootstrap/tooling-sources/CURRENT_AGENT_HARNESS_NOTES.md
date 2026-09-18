# Current Agent-Harness Notes (verified 2026-09-18)

These notes exist so the builder knows which current capabilities motivated the compatibility architecture. Re-check current official documentation during implementation because agent CLIs change quickly.

## Claude Code

Official docs indicate project-scoped support for:

- `CLAUDE.md`;
- `.claude/settings.json`;
- `.claude/rules/`;
- `.claude/skills/`;
- `.claude/agents/` subagents;
- project `.mcp.json`;
- isolated subagents and parallel work patterns;
- project-local plugins/skills and session plugin loading.

Useful official docs:

- https://code.claude.com/docs/
- https://code.claude.com/docs/fr/claude-directory
- https://code.claude.com/docs/id/features-overview

The builder must re-check the English/current equivalent pages and current CLI flags rather than hard-code translated-document details from this note.

## Codex

Official OpenAI documentation currently describes:

- project-scoped `AGENTS.md` instruction discovery;
- `codex exec` non-interactive execution;
- `--json` JSONL event output;
- `--output-schema` structured final outputs;
- current subagent workflows and parallel delegation.

Useful official docs:

- https://developers.openai.com/docs/agent-configuration/agents-md
- https://developers.openai.com/docs/non-interactive-mode
- https://developers.openai.com/docs/agent-configuration/subagents
- https://openai.com/index/harness-engineering/

Again, implementation must verify current CLI behavior before pinning an adapter.

