# Agent harness

The harness layer (`src/harness/`) is the only code that knows how to call Claude Code or Codex. The pipeline
sees one interface and one result shape.

## Contract (`src/harness/types.ts`)

```ts
interface AgentHarness {
  readonly name: 'claude' | 'codex' | 'fake';
  probe(): Promise<HarnessProbe>;          // available, version, authenticated (true|false|'unknown'), flags[], detail
  run(request: AgentTaskRequest): Promise<AgentTaskResult>;
}
```

`AgentTaskRequest` carries task identity (`taskId, runId, courseId, stage, role, promptTemplate, subject,
cycle`), the assembled `prompt` (sent on stdin) and `systemPreamble`, `cwd`, `readOnlyPaths`, `writablePaths`,
`agentTools`, the output schema (name, strict wire JSON Schema, and a file path for Codex), `writeMode`,
`network`, `timeoutSec`, `maxTurns` and `logDir`.

`AgentTaskResult` is `{ok, output, failure {class, message, retryable}, backend, backendVersion, model, usage
{inputTokens, outputTokens, costUsd}, durationMs, toolsUsed, promptHash, rawLogPath}`. Raw stdout/stderr go to
`courses/<id>/logs/tasks/`.

Failure classes: `authentication_failed`, `rate_limit`, `overloaded`, `billing_error`, `invalid_request`,
`model_not_found`, `server_error`, `max_output_tokens`, `timeout`, `schema_invalid`, `process_error`,
`unavailable`, `unknown`. `rate_limit`, `overloaded`, `server_error`, `timeout` and `process_error` are retried
with backoff (`fallbacks.json#process`: 2 retries, 2 s then 8 s). A schema-invalid answer gets one retry with the
validation errors appended to the prompt. Exit codes are never trusted on their own.

Parallelism is CourseForge's: fan-out and reviewer pools spawn separate processes (cap 3 each). Native
subagents are not used in headless runs.

## Prompt assembly (`src/harness/prompt.ts`)

Provider-neutral: role header + `prompts/templates/<template>.md` (only `{{variable}}` substitution; an unknown
variable is an error) + routed skill bodies (`.claude/skills/<id>/SKILL.md`, frontmatter stripped) + the
reviewer rubric + an input manifest (paths only; the agent reads files itself) + the output contract. The system
preamble tells the agent it is a CourseForge `<role>`, to follow only the task prompt, and to ignore unrelated
global or user-level instructions, memories, plugins and output styles.

## Claude Code adapter (`src/harness/claude.ts`)

```text
claude -p --output-format stream-json --verbose
  --safe-mode --setting-sources project --strict-mcp-config
  --permission-mode dontAsk
  --tools <Read,Grep,Glob[,Write,Edit][,WebSearch,WebFetch]>
  [--settings '{"permissions":{"allow":["Edit(//abs/writable)","Edit(//abs/writable/**)", "WebSearch", …]}}']
  [--add-dir <dirs outside cwd>]
  --json-schema '<inline wire schema>'
  --append-system-prompt '<role preamble>'
  --max-turns <n ≥ 2> --no-session-persistence
```

- Isolation is by flags only. `--safe-mode` disables user CLAUDE.md, plugins, hooks, output styles and MCP;
  `--setting-sources project` limits settings to the repository; `--strict-mcp-config` ignores MCP servers not
  passed explicitly. `CLAUDE_CONFIG_DIR` is not redirected (it would break sign-in) and `--bare` is not used (it
  disables OAuth/keychain auth).
- Write and Edit tools are removed unless the task is `artifact-write`; network tools only when `network` is set.
- Flags are probed from `claude --help`; a flag not present is not passed (`--max-turns` is accepted although
  hidden from help).
- Output parsing reads the stream-json `result` event (`structured_output`, `is_error`, `subtype`, usage and
  cost), tolerates noise lines, and maps API errors (429, 529, billing, not signed in, model not found, max
  turns) to failure classes.
- On Windows the native `claude.exe` behind the npm shim is resolved and spawned directly.

## Codex adapter (`src/harness/codex.ts`)

```text
codex exec --json --ignore-user-config --ignore-rules --skip-git-repo-check --ephemeral
  -C <repo> -s read-only|workspace-write
  -c approval_policy="never" -c web_search="disabled|live"
  [-c sandbox_workspace_write.network_access=true]
  -c developer_instructions="<role preamble>"
  [--add-dir <writable dirs outside the repo>]
  --output-schema <schema file> -o <logs/tasks/<task>.last.json> -
```

- The prompt is read from stdin (`-`). The final message is read from the `-o` file; a missing file is a hard
  failure. JSONL events supply usage and error details.
- `--ignore-user-config` skips `~/.codex/config.toml`; `--ignore-rules` skips execpolicy rules.
- **Limitation:** the user-global `~/.codex/AGENTS.md` cannot be disabled by any flag in the tested Codex
  version; it is always loaded as user instructions. The role preamble is injected as `developer_instructions`
  and tells the agent to ignore unrelated user-level instructions. Isolation is therefore partial; `doctor`
  reports `codex.globalconfig` when such files exist. See [ADR 0010](../adr/0010-cli-isolation-flags-not-config-dirs.md).
- Sandbox: `read-only` unless the task is `artifact-write`, then `workspace-write`. The OS sandbox allows the
  whole repository; the pipeline's write audit confines writes to the task's paths. Never
  `danger-full-access`, never an approval bypass.

## Fake harness (`src/harness/fake.ts`)

Selected with `--harness fake` or `COURSEFORGE_HARNESS=fake`. Fixtures come from `COURSEFORGE_FIXTURES` (or the
`fixturesDir` option); lookup, first hit wins:

```text
<dir>/<promptTemplate>/<subject>.c<cycle>.json
<dir>/<promptTemplate>/<subject>.json
<dir>/<promptTemplate>/default.c<cycle>.json
<dir>/<promptTemplate>/default.json
```

The envelope is `{output, failure?: {class, message}, delayMs?, files?: {"<path>": "<content>"}}`. `files` are
written where told (so tests can simulate an agent writing outside its scope). A missing fixture fails with
`invalid_request` and lists the expected paths. `COURSEFORGE_FAKE_MODE` = `fail`, `fail:<class>`,
`invalid-json`, `timeout` or `slow:<ms>` injects failures. The harness records `calls[]` with timings for
concurrency tests. Fixtures are keyed by template, subject and cycle, not by prompt text, so prompt wording can
change without invalidating them.

## Recording (`src/harness/record.ts`)

`COURSEFORGE_RECORD=<dir>` wraps a real adapter and writes each call's result as a fake-harness envelope at
`<dir>/<template>/<subject>.c<cycle>.json`. Home-directory paths (raw, JSON-escaped and forward-slash forms),
email addresses and known token shapes are scrubbed. If a secret-like pattern survives scrubbing the fixture is
not written and a warning is emitted.

## Backend probing

`probeAll()` probes both real CLIs once per process (`--version`, `--help` flag scan, auth status where the CLI
exposes it without a model call). Selection rules are in [routing.md](routing.md#backend-selection).

## Tests

`tests/unit/harness/`: `command.test.ts` (argv construction, flag gating), `parse-claude.test.ts`,
`parse-codex.test.ts` (recorded outputs in `tests/fixtures/harness-raw/`), `errors.test.ts`, `detect.test.ts`,
`fake.test.ts` (fixture lookup, modes, recorder scrubbing), `prompt.test.ts`, `live.test.ts` (opt-in,
`COURSEFORGE_LIVE=1`).
