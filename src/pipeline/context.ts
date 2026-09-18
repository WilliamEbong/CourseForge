/**
 * Per-invocation run context shared by the stage loop, compilers and agent runner.
 */
import { join } from 'node:path';
import type { BackendPreference, GateMode, HarnessName, Stage } from '../core/enums.js';
import { newRunId } from '../core/ids.js';
import { repoRoot } from '../core/paths.js';
import type { CourseManifest, CourseState } from '../core/schemas/index.js';
import type { AgentHarness, HarnessProbe } from '../harness/types.js';
import type { Registries } from '../routing/registries.js';

export interface RunContext {
  courseId: string;
  /** Absolute course directory. */
  dir: string;
  repo: string;
  manifest: CourseManifest;
  state: CourseState;
  registries: Registries;
  harness: AgentHarness;
  harnessName: HarnessName;
  probes: Partial<Record<'claude' | 'codex', HarnessProbe>>;
  runId: string;
  backendPref: BackendPreference;
  cliGate: GateMode | undefined;
  now: () => string;
  /** Stage currently executing (for logging). */
  stage: Stage | null;
  /** Human-readable progress sink (CLI prints; tests collect). */
  progress: (msg: string) => void;
}

export function systemClock(): () => string {
  return () => new Date().toISOString();
}

export function makeRunId(now: string): string {
  return newRunId(new Date(now));
}

export function abs(ctx: Pick<RunContext, 'dir'>, rel: string): string {
  return join(ctx.dir, rel);
}

export function defaultRepo(): string {
  return repoRoot();
}
