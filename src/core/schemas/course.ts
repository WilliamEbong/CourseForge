/**
 * Course-level persistent state: `course.yaml`, `state.json`, `artifacts.json`.
 * These are internal (not agent-facing) schemas, so optional fields and defaults are allowed.
 */
import { z } from 'zod';
import {
  BackendPreferenceSchema,
  GateModeInputSchema,
  GateModeSchema,
  IntakeModeSchema,
  ProducerKindSchema,
  type RiskTier,
  RiskTierSchema,
  STAGES,
  type Stage,
  StageFailureSchema,
  StageSchema,
  StageStatusSchema,
} from '../enums.js';

const IsoDate = z.string().min(10);

/** Normalises stage keys such as `instructional_design` or `Storyboard` to canonical `INSTRUCTIONAL_DESIGN`. */
function normaliseStageKeys(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.toUpperCase().replace(/[\s-]+/g, '_');
    const alias: Record<string, Stage> = { RESEARCH: 'RESEARCH_DOSSIER', COURSE_BUILD: 'COURSE_BUILD' };
    out[alias[key] ?? key] = val;
  }
  return out;
}

/**
 * How much a person checks the work. `one_shot`: no pauses until one sign-off before release (risk floors do not
 * apply; findings that cannot be fixed are carried to the release gate). `recommended`: stage and policy defaults
 * plus risk floors. `every_step`: a human gate at every stage. `strict`: every step, and the course is treated as
 * high-stakes whatever its topic.
 */
export const REVIEW_LEVELS = ['one_shot', 'recommended', 'every_step', 'strict'] as const;
export const ReviewLevelSchema = z.enum(REVIEW_LEVELS);
export type ReviewLevel = z.infer<typeof ReviewLevelSchema>;

export const TRACKING_DESTINATIONS = ['none', 'lms', 'sheet', 'tracker'] as const;
export const TrackingDestinationSchema = z.enum(TRACKING_DESTINATIONS);
export type TrackingDestination = z.infer<typeof TrackingDestinationSchema>;
export const LEARNER_IDENTITIES = ['name', 'name_and_id', 'name_and_email'] as const;
export const LearnerIdentitySchema = z.enum(LEARNER_IDENTITIES);
export type LearnerIdentity = z.infer<typeof LearnerIdentitySchema>;

/** https, or http to a localhost tracker; no user:password@ part (it would disguise the real host). */
function validEndpoint(u: string): boolean {
  if (/\s/.test(u)) return false;
  try {
    const url = new URL(u);
    if (url.username !== '' || url.password !== '') return false;
    return url.protocol === 'https:' || (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

export const TrackingSchema = z.object({
  destination: TrackingDestinationSchema.default('none'),
  /** Web address results are sent to (`sheet`, `tracker`); must be https except for a localhost tracker. */
  endpoint: z
    .string()
    .refine(validEndpoint, {
      message: 'endpoint must be an https:// address (or http://localhost for testing)',
    })
    .nullable()
    .default(null),
  /** What learners type to identify themselves on the results screen (not used for `lms`). */
  identity: LearnerIdentitySchema.default('name'),
  /** Label for the staff ID box, e.g. "Employee number"; null uses the default wording. */
  id_label: z.string().min(1).max(40).nullable().default(null),
});
export type Tracking = z.infer<typeof TrackingSchema>;

export const CourseManifestSchema = z.object({
  course: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'course id must be kebab-case (a-z, 0-9, -)'),
    title: z.string().min(1),
    language: z.string().default('en'),
    target_duration_minutes: z.number().int().positive().nullable().default(null),
    audience: z.string().nullable().default(null),
    jurisdiction: z.string().nullable().default(null),
    risk_tier: RiskTierSchema.default('standard'),
    /** Lowering gates below the risk floor requires an explicit, recorded acknowledgement. */
    risk_override: z.enum(['acknowledged']).nullable().default(null),
  }),
  pipeline: z
    .object({
      start_stage: StageSchema.default('CONCEPT'),
      target_stage: StageSchema.default('RELEASE'),
      agent_backend: BackendPreferenceSchema.default('auto'),
      backend_fallback: z.boolean().default(false),
      max_repair_cycles: z.number().int().min(0).max(10).nullable().default(null),
      visual_family: z.string().nullable().default(null),
      review_level: ReviewLevelSchema.default('recommended'),
    })
    .default({
      start_stage: 'CONCEPT',
      target_stage: 'RELEASE',
      agent_backend: 'auto',
      backend_fallback: false,
      max_repair_cycles: null,
      visual_family: null,
      review_level: 'recommended',
    }),
  human_review: z.preprocess(normaliseStageKeys, z.partialRecord(StageSchema, GateModeInputSchema)).default({}),
  improvement: z
    .object({
      preserve_human_edits: z.boolean().default(true),
      default_import_mode: IntakeModeSchema.default('improve'),
    })
    .default({ preserve_human_edits: true, default_import_mode: 'improve' }),
  /** Optional learner completion/score tracking (deployment settings; never part of the course model). */
  tracking: TrackingSchema.default({ destination: 'none', endpoint: null, identity: 'name', id_label: null }),
  /** When the setup wizard (or `configure`) last ran; null means the course was never configured. */
  setup: z.object({ configured_at: IsoDate.nullable().default(null) }).default({ configured_at: null }),
});
export type CourseManifest = z.infer<typeof CourseManifestSchema>;

/**
 * The tracking settings a build should use, or null when the course is untracked. A web destination without an
 * endpoint yet ("setup unfinished") builds as untracked.
 */
export function effectiveTracking(manifest: Pick<CourseManifest, 'tracking'>): Tracking | null {
  const t = manifest.tracking;
  if (t.destination === 'none') return null;
  if (t.destination !== 'lms' && !t.endpoint) return null;
  return t;
}

/** The risk tier the pipeline applies: `strict` review treats every course as high-stakes. */
export function effectiveRiskTier(manifest: Pick<CourseManifest, 'course' | 'pipeline'>): RiskTier {
  return manifest.pipeline.review_level === 'strict' ? 'high_stakes' : manifest.course.risk_tier;
}

/** Google Apps Script web apps answer from a second host (the Content service redirects to googleusercontent). */
const APPS_SCRIPT_REPLY_ORIGIN = 'https://script.googleusercontent.com';

/**
 * The only origins a tracked course may contact (its CSP `connect-src`); empty means fully offline. Used by the
 * renderer, the single-file check and QA, so all three agree.
 */
export function trackingOrigins(tracking: Tracking | null): string[] {
  if (!tracking?.endpoint || (tracking.destination !== 'sheet' && tracking.destination !== 'tracker')) return [];
  const origin = new URL(tracking.endpoint).origin;
  return tracking.destination === 'sheet' && origin !== APPS_SCRIPT_REPLY_ORIGIN ? [origin, APPS_SCRIPT_REPLY_ORIGIN] : [origin];
}

/** True when a web destination was chosen but its address has not been supplied yet. */
export function trackingUnfinished(manifest: Pick<CourseManifest, 'tracking'>): boolean {
  return (manifest.tracking.destination === 'sheet' || manifest.tracking.destination === 'tracker') && !manifest.tracking.endpoint;
}

export const GateStateSchema = z.object({
  mode: GateModeSchema,
  status: z.enum(['pending', 'approved', 'rejected']),
  reason: z.enum(['policy', 'high_stakes', 'cycle_cap', 'lock_conflict', 'low_confidence', 'upstream_changed', 'validator_failed']),
  openedAt: IsoDate,
  decidedAt: IsoDate.nullable().default(null),
  decidedBy: z.string().nullable().default(null),
  reportPath: z.string().nullable().default(null),
  instructions: z.string().nullable().default(null),
  comments: z.array(z.object({ at: IsoDate, by: z.string(), text: z.string(), targetId: z.string().nullable().default(null) })).default([]),
  findingDecisions: z.record(z.string(), z.enum(['accepted', 'rejected'])).default({}),
});
export type GateState = z.infer<typeof GateStateSchema>;

export const StageStateSchema = z.object({
  status: StageStatusSchema.default('NOT_STARTED'),
  mode: z.union([IntakeModeSchema, z.literal('generate')]).default('generate'),
  planId: z.string().nullable().default(null),
  cyclesUsed: z.number().int().min(0).default(0),
  /** Step keys such as `validate`, `generate`, `review#0`, `repair#0` completed in the current run. */
  completedSteps: z.array(z.string()).default([]),
  gate: GateStateSchema.nullable().default(null),
  stale: z.object({ because: z.string(), at: IsoDate }).nullable().default(null),
  failure: z.object({ kind: StageFailureSchema, message: z.string(), at: IsoDate }).nullable().default(null),
  lastRunId: z.string().nullable().default(null),
  updatedAt: IsoDate.nullable().default(null),
});
export type StageState = z.infer<typeof StageStateSchema>;

export function emptyStageStates(): Record<Stage, StageState> {
  const out = {} as Record<Stage, StageState>;
  for (const s of STAGES) out[s] = StageStateSchema.parse({});
  return out;
}

export const CourseStateSchema = z.object({
  schemaVersion: z.literal(1),
  courseId: z.string(),
  currentStage: StageSchema,
  targetStage: StageSchema,
  activeRunId: z.string().nullable().default(null),
  /** logical artifact key (e.g. `storyboard`) → canonical ArtifactId */
  canonicalArtifacts: z.record(z.string(), z.string()).default({}),
  stages: z.record(StageSchema, StageStateSchema),
  updatedAt: IsoDate,
});
export type CourseState = z.infer<typeof CourseStateSchema>;

export const ArtifactIdSchema = z.string().regex(/^ART-\d{4,}$/);

export const ArtifactRecordSchema = z.object({
  artifactId: ArtifactIdSchema,
  stage: StageSchema,
  /** Path relative to the course directory, forward slashes. */
  path: z.string(),
  /** Stable logical key shared by all versions of the same artifact (e.g. `storyboard`, `sources`). */
  logicalKey: z.string(),
  version: z.number().int().min(1),
  /** Semantic version label, e.g. `storyboard-v2-human-approved`. */
  label: z.string(),
  producer: z.object({
    kind: ProducerKindSchema,
    backendVersion: z.string().nullable().default(null),
    taskId: z.string().nullable().default(null),
    runId: z.string().nullable().default(null),
  }),
  parents: z.array(ArtifactIdSchema).default([]),
  schemaVersion: z.string().nullable().default(null),
  /** `sha256:<hex>` over LF-normalised bytes for text files, raw bytes otherwise. */
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  bytes: z.number().int().min(0),
  createdAt: IsoDate,
  modifiedAt: IsoDate,
  humanModified: z.boolean().default(false),
  approval: z.enum(['none', 'approved', 'rejected']).default('none'),
  locked: z.boolean().default(false),
  /** Section-level locks: stable IDs within the artifact and the hash of their canonical content. */
  lockedIds: z.array(z.object({ id: z.string(), hash: z.string() })).default([]),
  reviewStatus: z.enum(['unreviewed', 'in_review', 'passed', 'failed', 'waived']).default('unreviewed'),
  supersededBy: ArtifactIdSchema.nullable().default(null),
  /** Snapshot copy under `versions/` (relative to course dir). */
  snapshotPath: z.string().nullable().default(null),
  notes: z.array(z.string()).default([]),
  conflicts: z.array(z.object({ kind: z.string(), detail: z.string(), findingId: z.string().nullable().default(null) })).default([]),
});
export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>;

export const ArtifactRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  nextSeq: z.number().int().min(1),
  artifacts: z.record(ArtifactIdSchema, ArtifactRecordSchema),
});
export type ArtifactRegistry = z.infer<typeof ArtifactRegistrySchema>;

/** One line of `logs/run-events.jsonl`. */
export const RunEventSchema = z.object({
  ts: IsoDate,
  runId: z.string().nullable(),
  stage: StageSchema.nullable(),
  event: z.string(),
  step: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
  durationMs: z.number().nullable().default(null),
  detail: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type RunEvent = z.infer<typeof RunEventSchema>;
