/**
 * Provider-neutral agent harness contract. The pipeline only ever sees these types; everything that knows
 * about the `claude` or `codex` CLIs lives in `src/harness/{claude,codex}.ts`.
 */
import type { HarnessFailure, HarnessName, Stage } from '../core/enums.js';
import type { WriteMode } from '../core/schemas/registry.js';

export interface HarnessProbe {
  name: HarnessName;
  available: boolean;
  version: string | null;
  /** `unknown` when auth readiness cannot be determined without a model call. */
  authenticated: boolean | 'unknown';
  /** Supported CLI flags detected from `--help` (adapters only use flags present here). */
  flags: string[];
  detail: string;
}

export interface AgentTaskRequest {
  taskId: string;
  runId: string;
  planId: string | null;
  courseId: string;
  stage: Stage;
  role: string;
  promptTemplate: string;
  /** Fan-out key or reviewer ID (used by the fake harness to pick fixtures). */
  subject: string | null;
  /** Review/repair cycle this task belongs to (0 for generation). */
  cycle: number;
  /** Fully assembled prompt text (sent on stdin). */
  prompt: string;
  /** Short role/system preamble appended to the harness system prompt. */
  systemPreamble: string;
  /** Absolute working directory for the agent process (the repository root). */
  cwd: string;
  /** Absolute paths the agent may read. */
  readOnlyPaths: string[];
  /** Absolute paths the agent may write (empty for findings-only / structured tasks). */
  writablePaths: string[];
  /** Harness-level tool names (Read, Grep, Glob, Write, Edit, WebSearch, WebFetch). */
  agentTools: string[];
  /** Name of the output schema (key of SCHEMAS) and its strict wire JSON schema. */
  outputSchemaName: string;
  outputSchema: Record<string, unknown>;
  /** Absolute path to the wire schema file on disk (Codex needs a file). */
  outputSchemaPath: string;
  writeMode: WriteMode;
  network: boolean;
  timeoutSec: number;
  maxTurns: number;
  /** Directory where raw stdout/stderr logs are written (`logs/tasks`). */
  logDir: string;
}

export interface AgentUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface AgentTaskResult {
  ok: boolean;
  /** Parsed structured output (unvalidated JSON; the pipeline validates with zod). */
  output: unknown;
  failure: { class: HarnessFailure; message: string; retryable: boolean } | null;
  backend: HarnessName;
  backendVersion: string | null;
  model: string | null;
  usage: AgentUsage | null;
  durationMs: number;
  /** Tools the agent reported using, when the backend exposes it. */
  toolsUsed: string[] | null;
  promptHash: string;
  rawLogPath: string | null;
}

export interface AgentHarness {
  readonly name: HarnessName;
  probe(): Promise<HarnessProbe>;
  run(request: AgentTaskRequest): Promise<AgentTaskResult>;
}

/** Retryable failure classes (bounded backoff); others fail fast or trigger configured backend fallback. */
export const RETRYABLE_FAILURES: ReadonlySet<HarnessFailure> = new Set<HarnessFailure>([
  'rate_limit',
  'overloaded',
  'server_error',
  'timeout',
  'process_error',
]);
