/**
 * Public operations of CourseForge. The CLI (src/cli) is a thin shell over these functions; tests call them
 * directly. Every function is course-folder scoped and returns plain data (the CLI decides how to print it).
 *
 * Implementations live in the pipeline modules; this file is the stable surface.
 */
import type { BackendPreference, GateMode, HarnessName, IntakeMode, Stage, StageStatus } from '../core/enums.js';
import type { Finding, GateState, GuidanceConfig, IntakeReport, ReviewLevel, Tracking } from '../core/schemas/index.js';

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

/**
 * How much the author wants to approve personally: a review level (`course.yaml` `pipeline.review_level`), or
 * `custom` to keep hand-written `human_review` gates.
 */
export type ReviewChoice = ReviewLevel | 'custom';

/** Everything the setup wizard asks. Applied to `course.yaml` by `newCourse`/`ingest` (new courses) or `configure`. */
export interface SetupAnswers {
  language: string;
  audience: string | null;
  review: ReviewChoice;
  tracking: Tracking;
}

export interface SetupInfo {
  courseId: string;
  title: string;
  /** False when the course does not exist yet (answers are the defaults). */
  exists: boolean;
  /** True once the wizard or `configure` has run for this course. */
  configured: boolean;
  answers: SetupAnswers;
  guidance: GuidanceConfig;
}

export interface ConfigureResult {
  courseId: string;
  /** Absolute path of course.yaml. */
  manifestPath: string;
  /** Absolute paths of step-by-step instruction files written for the author. */
  guides: string[];
  /** True when the tracking a build would use changed. */
  trackingChanged: boolean;
  /** Stages that must be re-run because of the change. */
  invalidated: Stage[];
  /** A web destination was chosen but its address is still missing. */
  unfinished: boolean;
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
  /** Setup wizard answers; when absent the defaults apply and the course counts as not yet configured. */
  setup?: SetupAnswers;
  /** The request in the author's own words (replaces the audience/duration/notes summary). */
  request?: string;
}

export interface MakeOptions extends HarnessOptions {
  /** What the course should be about, in the author's words (may be empty when documents are given). */
  prompt?: string;
  /** Documents, folders of documents, or one HTML/JSON course file to finish. */
  paths: string[];
  title?: string;
  id?: string;
  /** Continue an existing course to release instead of creating one. */
  courseId?: string;
  setup?: SetupAnswers;
}

export interface MakeResult {
  courseId: string;
  /** What `make` was given. */
  input: 'prompt' | 'documents' | 'course' | 'existing';
  created: boolean;
  outcome: RunOutcome;
  guides: string[];
  /** The documents were longer than the source-material limit and were shortened. */
  truncated?: boolean;
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
  /** Setup wizard answers, applied only when the import creates a new course. */
  setup?: SetupAnswers;
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
  /** Plain-language setup reminders (course never configured, tracking setup unfinished). */
  notices: string[];
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
  /** `guides`: instruction files written for the author by the setup answers (absolute paths). */
  newCourse(opts: NewCourseOptions): Promise<{ courseId: string; courseDir: string; outcome: RunOutcome | null; guides: string[] }>;
  ingest(opts: IngestOptions): Promise<{ courseId: string; report: IntakeReport; guides: string[] }>;
  /** Which course an `ingest` of this file would target, and whether it would create it. No side effects. */
  ingestTarget(opts: { file: string; courseId?: string; title?: string }): Promise<{ courseId: string; title: string; isNew: boolean }>;
  /** Current setup answers (defaults for a course that does not exist yet, or when no ID is given) plus the guidance. */
  setupInfo(opts: { courseId?: string; title?: string }): Promise<SetupInfo>;
  /** Saves setup answers to course.yaml, writes instruction files, and invalidates the build if tracking changed. */
  configure(opts: { courseId: string; answers: SetupAnswers }): Promise<ConfigureResult>;
  /** Makes a course from a prompt, documents or a half-finished course and runs it towards release. */
  make(opts: MakeOptions): Promise<MakeResult>;
  run(opts: RunOptions): Promise<RunOutcome>;
  continueRun(opts: { courseId: string } & HarnessOptions): Promise<RunOutcome>;
  review(opts: { courseId: string; stage?: Stage } & HarnessOptions): Promise<RunOutcome>;
  improve(opts: { courseId: string; input?: string; to?: Stage } & HarnessOptions): Promise<RunOutcome>;
  status(opts: { courseId: string }): Promise<StatusReport>;
  gate(opts: GateOptions): Promise<GateState | null>;
  findings(opts: FindingsOptions): Promise<Finding[]>;
  versions(opts: VersionsOptions): Promise<unknown>;
  trace(opts: TraceOptions): Promise<unknown>;
  /** Zips the course folder, or with `scorm` builds the SCORM 1.2 package of the (released, else built) course. */
  packageCourse(opts: { courseId: string; out?: string; scorm?: boolean }): Promise<{ path: string; bytes: number }>;
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
