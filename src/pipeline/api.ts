/**
 * Public operations of CourseForge. The CLI (src/cli) is a thin shell over these functions; tests call them
 * directly. Every function is course-folder scoped and returns plain data (the CLI decides how to print it).
 *
 * Implementations live in the pipeline modules; this file is the stable surface.
 */
import type { BackendPreference, GateMode, HarnessName, IntakeMode, Stage, StageStatus } from '../core/enums.js';
import type { Finding, GateState, IntakeReport } from '../core/schemas/index.js';

export interface HarnessOptions {
  /** Backend preference for this invocation (overrides course.yaml). */
  backend?: BackendPreference;
  /** Force a specific harness implementation (e.g. `fake` for offline demos/tests). Also settable via COURSEFORGE_HARNESS. */
  harness?: HarnessName;
}

export interface RunOutcome {
  courseId: string;
  runId: string | null;
  /** completed = target reached; waiting = paused at a human gate; failed = stage failed; blocked = release gate blocked. */
  status: 'completed' | 'waiting' | 'failed' | 'blocked';
  stoppedAt: Stage | null;
  stages: { stage: Stage; status: StageStatus }[];
  message: string;
  exitCode: number;
}

export interface NewCourseOptions extends HarnessOptions {
  title: string;
  id?: string;
  notesFile?: string;
  audience?: string;
  durationMinutes?: number;
  jurisdiction?: string;
  language?: string;
  /** When set, immediately run from CONCEPT to this stage. */
  runTo?: Stage;
  gate?: GateMode;
}

export interface IngestOptions extends HarnessOptions {
  file: string;
  courseId?: string;
  title?: string;
  stage?: Stage;
  mode?: IntakeMode;
  /** Replace the current canonical artifact of that stage with this file (human edit / replacement). */
  replace?: boolean;
  /** Use review-only when stage inference confidence is low instead of pausing. */
  conservative?: boolean;
}

export interface RunOptions extends HarnessOptions {
  courseId: string;
  from?: Stage;
  to?: Stage;
  gate?: GateMode;
  /** Re-run stages even if already LOCKED (creates new versions; never overwrites human-locked content). */
  force?: boolean;
}

export interface StatusReport {
  courseId: string;
  title: string;
  riskTier: string;
  currentStage: Stage;
  targetStage: Stage;
  activeRunId: string | null;
  stages: {
    stage: Stage;
    status: StageStatus;
    mode: string;
    cyclesUsed: number;
    gate: GateState | null;
    canonical: string[];
    openFindings: number;
    failure: string | null;
  }[];
  nextAction: string;
}

export type GateAction = 'approve' | 'reject' | 'comment' | 'lock' | 'unlock' | 'rereview';

export interface GateOptions {
  courseId: string;
  stage: Stage;
  action: GateAction;
  by?: string;
  text?: string;
  ids?: string[];
  abort?: boolean;
  instructions?: string;
}

export interface FindingsOptions {
  courseId: string;
  action: 'list' | 'accept' | 'reject';
  stage?: Stage;
  ids?: string[];
  by?: string;
}

export interface VersionsOptions {
  courseId: string;
  action: 'list' | 'restore' | 'select';
  label?: string;
  artifactId?: string;
}

export interface TraceOptions {
  courseId: string;
  id?: string;
  direction?: 'up' | 'down';
  depth?: number;
  impactIds?: string[];
}

export interface CleanOptions {
  courseId?: string;
  build?: boolean;
  cache?: boolean;
  dryRun?: boolean;
}

export interface CourseSummary {
  courseId: string;
  title: string;
  currentStage: Stage;
  status: StageStatus;
}

export interface PipelineApi {
  newCourse(opts: NewCourseOptions): Promise<{ courseId: string; courseDir: string; outcome: RunOutcome | null }>;
  ingest(opts: IngestOptions): Promise<{ courseId: string; report: IntakeReport }>;
  run(opts: RunOptions): Promise<RunOutcome>;
  continueRun(opts: { courseId: string } & HarnessOptions): Promise<RunOutcome>;
  review(opts: { courseId: string; stage?: Stage } & HarnessOptions): Promise<RunOutcome>;
  improve(opts: { courseId: string; input?: string; to?: Stage } & HarnessOptions): Promise<RunOutcome>;
  status(opts: { courseId: string }): Promise<StatusReport>;
  gate(opts: GateOptions): Promise<GateState | null>;
  findings(opts: FindingsOptions): Promise<Finding[]>;
  versions(opts: VersionsOptions): Promise<unknown>;
  trace(opts: TraceOptions): Promise<unknown>;
  packageCourse(opts: { courseId: string; out?: string }): Promise<{ path: string; bytes: number }>;
  clean(opts: CleanOptions): Promise<{ removed: string[] }>;
  listCourses(): Promise<CourseSummary[]>;
  /** Setup smoke fixture: build one screen, render one diagram, drive one interaction, run axe, screenshot. */
  smoke(opts: { outDir?: string }): Promise<{ ok: boolean; steps: { name: string; ok: boolean; detail: string }[] }>;
}

/**
 * Resolved at runtime so the CLI can be built and tested before/independently of the pipeline internals.
 * `src/pipeline/impl.ts` exports `pipelineApi: PipelineApi`.
 */
export async function loadPipelineApi(progress?: (line: string) => void): Promise<PipelineApi> {
  const mod = (await import('./impl.js')) as { pipelineApi: PipelineApi; setProgressWriter(fn: ((line: string) => void) | null): void };
  mod.setProgressWriter(progress ?? null);
  return mod.pipelineApi;
}
