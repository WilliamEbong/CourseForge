/**
 * Course-folder persistence: course.yaml, state.json, event log. The pipeline is the only writer of state.
 */
import { join } from 'node:path';
import { STAGES, type Stage, type StageStatus } from '../core/enums.js';
import { CfError } from '../core/errors.js';
import { exists, readJson, readYaml, writeJson, writeYaml } from '../core/fsx.js';
import { appendJsonl } from '../core/log.js';
import { COURSE_FILES, courseDir } from '../core/paths.js';
import {
  type CourseManifest,
  CourseManifestSchema,
  type CourseState,
  CourseStateSchema,
  emptyStageStates,
  type RoutingDecision,
  type StageState,
} from '../core/schemas/index.js';
import { nextStatus, type Trigger } from './transitions.js';

export function coursePath(courseId: string, rel: string): string {
  return join(courseDir(courseId), rel);
}

export function courseExists(courseId: string): boolean {
  return exists(join(courseDir(courseId), COURSE_FILES.manifest));
}

export function requireCourse(courseId: string): string {
  if (!courseExists(courseId))
    throw new CfError('NO_COURSE', `Course "${courseId}" not found under ${courseDir(courseId)}`, { exitCode: 2 });
  return courseDir(courseId);
}

export function loadManifest(dir: string): CourseManifest {
  return readYaml(join(dir, COURSE_FILES.manifest), CourseManifestSchema);
}

export function saveManifest(dir: string, manifest: CourseManifest): void {
  writeYaml(join(dir, COURSE_FILES.manifest), manifest);
}

export function initialState(courseId: string, current: Stage, target: Stage, now: string): CourseState {
  return {
    schemaVersion: 1,
    courseId,
    currentStage: current,
    targetStage: target,
    activeRunId: null,
    canonicalArtifacts: {},
    stages: emptyStageStates(),
    updatedAt: now,
  };
}

export function loadState(dir: string): CourseState {
  const p = join(dir, COURSE_FILES.state);
  const state = readJson(p, CourseStateSchema);
  // tolerate registries that gained stages
  for (const s of STAGES) if (!state.stages[s]) state.stages[s] = emptyStageStates()[s];
  return state;
}

export function saveState(dir: string, state: CourseState, now: string): void {
  state.updatedAt = now;
  writeJson(join(dir, COURSE_FILES.state), state);
}

/** Applies a state-machine transition to a stage and records it in the event log. */
export function transitionStage(
  dir: string,
  state: CourseState,
  stage: Stage,
  trigger: Trigger,
  now: string,
  runId: string | null,
): StageStatus {
  const st = state.stages[stage];
  const from = st.status;
  const to = nextStatus(from, trigger);
  st.status = to;
  st.updatedAt = now;
  if (runId) st.lastRunId = runId;
  logEvent(dir, { ts: now, runId, stage, event: 'stage.status', step: null, status: to, detail: { from, trigger } });
  return to;
}

export function patchStage(state: CourseState, stage: Stage, patch: Partial<StageState>): void {
  Object.assign(state.stages[stage], patch);
}

export interface EventInput {
  ts: string;
  runId: string | null;
  stage: Stage | null;
  event: string;
  step?: string | null;
  status?: string | null;
  durationMs?: number | null;
  detail?: Record<string, unknown> | null;
}

export function logEvent(dir: string, e: EventInput): void {
  appendJsonl(join(dir, COURSE_FILES.runEvents), {
    ts: e.ts,
    runId: e.runId,
    stage: e.stage,
    event: e.event,
    step: e.step ?? null,
    status: e.status ?? null,
    durationMs: e.durationMs ?? null,
    detail: e.detail ?? null,
  });
}

export function logDecisions(dir: string, decisions: readonly RoutingDecision[]): void {
  for (const d of decisions) appendJsonl(join(dir, COURSE_FILES.routingDecisions), d);
}
