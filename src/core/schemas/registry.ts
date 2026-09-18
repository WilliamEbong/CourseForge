/**
 * Registry configuration (`config/*.json`) and the execution-plan / routing-decision records the router emits.
 * All registries are validated at startup; unknown keys or enum values are errors (spec 05).
 */
import { z } from 'zod';
import {
  BackendNameSchema,
  BackendPreferenceSchema,
  FindingCategorySchema,
  GateModeInputSchema,
  GateModeSchema,
  HarnessFailureSchema,
  HarnessNameSchema,
  IntakeModeSchema,
  RendererSchema,
  RiskTierSchema,
  SeveritySchema,
  StageSchema,
  VisualArchetypeSchema,
  VisualInteractionSchema,
} from '../enums.js';

const Strict = z.strictObject;
const PathTemplate = z.string().min(1); // may contain `{course}`

export const WriteModeSchema = z.enum(['findings-only', 'structured', 'artifact-write']);
export type WriteMode = z.infer<typeof WriteModeSchema>;

/* ------------------------------------------------------------------ stages.json */

export const GeneratorDefSchema = Strict({
  role: z.string(),
  promptTemplate: z.string(),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  outputSchema: z.string(),
  /** `none`: one task; `per-section` / `per-module`: one task per planned unit, merged by code. */
  fanOut: z.enum(['none', 'per-section', 'per-module']),
  writeMode: WriteModeSchema,
  network: z.boolean(),
});
export type GeneratorDef = z.infer<typeof GeneratorDefSchema>;

export const StageDefSchema = Strict({
  kind: z.enum(['agent', 'deterministic']),
  description: z.string(),
  inputs: Strict({
    /** Each entry is a course-relative path, or a list of alternatives (first existing canonical wins). */
    required: z.array(z.union([z.string(), z.array(z.string()).min(1)])),
    optional: z.array(z.string()),
  }),
  outputs: z.array(z.string()).min(1),
  /** Logical key → course-relative path of the canonical output(s) this stage registers. */
  artifacts: z.record(z.string(), z.string()),
  generator: GeneratorDefSchema.nullable(),
  /** Deterministic compiler name (see `src/pipeline/compilers.ts`). */
  compiler: z.string().nullable(),
  validators: z.array(z.string()),
  reviewers: z.array(z.string()),
  /** finding category → reviewers to rerun after a repair touching that category. */
  rerunMap: z.partialRecord(FindingCategorySchema, z.array(z.string())),
  repairer: Strict({ role: z.string(), promptTemplate: z.string(), outputSchema: z.string() }).nullable(),
  gateDefault: GateModeSchema,
  limits: Strict({
    taskTimeoutSec: z.number().int().positive(),
    stageTimeoutSec: z.number().int().positive(),
    maxTurns: z.number().int().min(0),
    processRetries: z.number().int().min(0).max(5),
  }),
  writable: z.array(PathTemplate),
  readOnly: z.array(PathTemplate),
});
export type StageDef = z.infer<typeof StageDefSchema>;

export const StagesConfigSchema = Strict({
  $schema: z.string().optional(),
  version: z.literal(1),
  stages: z.record(StageSchema, StageDefSchema),
});
export type StagesConfig = z.infer<typeof StagesConfigSchema>;

/* ------------------------------------------------------------------- tools.json */

export const ToolDefSchema = Strict({
  kind: z.enum(['renderer', 'asset', 'qa', 'agent-tool', 'parser', 'bundler']),
  description: z.string(),
  capabilities: z.array(z.string()),
  required: z.boolean(),
  /** npm package that provides it (checked by doctor), or null for built-ins. */
  package: z.string().nullable(),
  /** Tool names passed to the agent harness when this is an agent tool (e.g. `Read`, `WebSearch`). */
  agentTools: z.array(z.string()),
});
export type ToolDef = z.infer<typeof ToolDefSchema>;
export const ToolsConfigSchema = Strict({
  $schema: z.string().optional(),
  version: z.literal(1),
  tools: z.record(z.string(), ToolDefSchema),
});
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

/* ------------------------------------------------------------------ skills.json */

export const SkillDefSchema = Strict({
  path: z.string(),
  description: z.string(),
  stages: z.array(StageSchema),
  roles: z.array(z.string()),
  maxBytes: z.number().int().positive(),
});
export type SkillDef = z.infer<typeof SkillDefSchema>;
export const SkillsConfigSchema = Strict({
  $schema: z.string().optional(),
  version: z.literal(1),
  skills: z.record(z.string(), SkillDefSchema),
});
export type SkillsConfig = z.infer<typeof SkillsConfigSchema>;

/* --------------------------------------------------------------- reviewers.json */

export const ReviewerDefSchema = Strict({
  description: z.string(),
  /** Rubric file under `prompts/rubrics/`. */
  rubric: z.string(),
  promptTemplate: z.string(),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  categories: z.array(FindingCategorySchema).min(1),
  /** Course-relative inputs the reviewer needs (templates allowed). */
  inputs: z.array(z.string()),
  needsScreenshots: z.boolean(),
  network: z.boolean(),
  enabled: z.boolean(),
});
export type ReviewerDef = z.infer<typeof ReviewerDefSchema>;
export const ReviewersConfigSchema = Strict({
  $schema: z.string().optional(),
  version: z.literal(1),
  reviewers: z.record(z.string(), ReviewerDefSchema),
});
export type ReviewersConfig = z.infer<typeof ReviewersConfigSchema>;

/* ----------------------------------------------------------------- routing.json */

export const VisualRouteSchema = Strict({
  rule: z.string().regex(/^VIS-[A-Z0-9_]+-\d{3}$/),
  when: Strict({ archetype: VisualArchetypeSchema.nullable(), interaction: VisualInteractionSchema.nullable() }),
  primary: RendererSchema,
  fallbacks: z.array(RendererSchema),
});
export type VisualRoute = z.infer<typeof VisualRouteSchema>;

export const RoutingConfigSchema = Strict({
  $schema: z.string().optional(),
  version: z.literal(1),
  stageRoutes: z.record(StageSchema, Strict({ rule: z.string().regex(/^STG-[A-Z_]+-\d{3}$/) })),
  /** Ordered: the first matching rule wins; archetype-specific rules must precede generic ones. */
  visualRoutes: z.array(VisualRouteSchema).min(1),
  /** Icon vocabulary: semantic icon name → Lucide icon file name. */
  icons: z.record(z.string(), z.string()),
  /** Block kind → component type (component plan defaults). */
  components: z.record(z.string(), z.string()),
});
export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;

/* --------------------------------------------------------------- fallbacks.json */

export const FallbacksConfigSchema = Strict({
  $schema: z.string().optional(),
  version: z.literal(1),
  renderer: Strict({ maxSemanticRepairs: z.number().int().min(0).max(3), terminal: z.literal('text_equivalent') }),
  schemaRetries: z.number().int().min(0).max(3),
  process: Strict({ retries: z.number().int().min(0).max(5), backoffMs: z.array(z.number().int().min(0)) }),
  backend: Strict({
    enabled: z.boolean(),
    order: z.array(BackendNameSchema).min(1),
    triggers: z.array(HarnessFailureSchema),
    afterAttempts: z.number().int().min(1),
  }),
  concurrency: Strict({ reviewers: z.number().int().min(1).max(8), fanOut: z.number().int().min(1).max(8) }),
});
export type FallbacksConfig = z.infer<typeof FallbacksConfigSchema>;

/* ----------------------------------------------------------- review-policy.json */

export const ReviewPolicySchema = Strict({
  $schema: z.string().optional(),
  version: z.literal(1),
  maxRepairCycles: z.number().int().min(0).max(10),
  perStageMaxRepairCycles: z.partialRecord(StageSchema, z.number().int().min(0).max(10)),
  /** Severities at or above which a finding is actionable in a repair cycle. */
  repairSeverities: z.array(SeveritySchema),
  releaseBlockingSeverities: z.array(SeveritySchema),
  axeBlockingImpacts: z.array(z.enum(['minor', 'moderate', 'serious', 'critical'])),
  onCapReached: z.enum(['human', 'fail']),
  gateDefaults: z.partialRecord(StageSchema, GateModeInputSchema),
  riskFloors: z.record(RiskTierSchema, z.partialRecord(StageSchema, GateModeInputSchema)),
  /** Import mode → what the stage loop does. Documented in docs/user-guide/ingestion.md. */
  intakeModes: z.record(IntakeModeSchema, Strict({ generate: z.boolean(), review: z.boolean(), repair: z.boolean() })),
});
export type ReviewPolicy = z.infer<typeof ReviewPolicySchema>;

/* ----------------------------------------------------- execution plan + decisions */

export const TaskSpecSchema = z.object({
  taskId: z.string(),
  role: z.string(),
  promptTemplate: z.string(),
  /** Fan-out key (module/section ID) or reviewer ID; null for single tasks. */
  subject: z.string().nullable(),
  rubric: z.string().nullable(),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  /** Resolved agent-harness tool names (e.g. Read, Grep, WebSearch). */
  agentTools: z.array(z.string()),
  inputPaths: z.array(z.string()),
  readOnlyPaths: z.array(z.string()),
  writablePaths: z.array(z.string()),
  outputSchema: z.string(),
  writeMode: WriteModeSchema,
  network: z.boolean(),
  timeoutSec: z.number().int().positive(),
  maxTurns: z.number().int().min(0),
});
export type TaskSpec = z.infer<typeof TaskSpecSchema>;

export const RoutingDecisionSchema = z.object({
  ts: z.string(),
  runId: z.string(),
  planId: z.string().nullable(),
  stage: StageSchema.nullable(),
  kind: z.enum(['stage', 'visual', 'backend', 'fallback', 'classification', 'gate', 'reviewer', 'skill', 'tool']),
  subject: z.string(),
  input: z.string(),
  selected: z.string(),
  rule: z.string(),
  fallback: z.boolean(),
  reason: z.string().nullable(),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

export const ExecutionPlanSchema = z.object({
  schemaVersion: z.literal(1),
  planId: z.string(),
  runId: z.string(),
  courseId: z.string(),
  stage: StageSchema,
  revision: z.number().int().min(1),
  supersedes: z.string().nullable(),
  createdAt: z.string(),
  transition: z.object({ fromStatus: z.string(), startStage: StageSchema, targetStage: StageSchema }),
  mode: z.union([IntakeModeSchema, z.literal('generate')]),
  backend: z.object({
    requested: BackendPreferenceSchema,
    selected: z.union([HarnessNameSchema, z.literal('none')]),
    version: z.string().nullable(),
    rule: z.string(),
  }),
  inputs: z.array(z.object({ artifactId: z.string().nullable(), path: z.string(), hash: z.string().nullable(), required: z.boolean() })),
  generator: TaskSpecSchema.nullable(),
  generatorFanOut: z.array(z.string()),
  compiler: z.string().nullable(),
  validators: z.array(z.string()),
  reviewers: z.array(TaskSpecSchema),
  reviewConcurrency: z.number().int().min(1),
  rerunMap: z.partialRecord(FindingCategorySchema, z.array(z.string())),
  adjudicator: TaskSpecSchema.nullable(),
  repairer: TaskSpecSchema.nullable(),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  visualRoutes: z.array(
    z.object({
      visualId: z.string(),
      archetype: VisualArchetypeSchema,
      renderer: RendererSchema,
      fallbacks: z.array(RendererSchema),
      rule: z.string(),
    }),
  ),
  fallbacks: FallbacksConfigSchema,
  humanGate: z.object({ mode: GateModeSchema, source: z.enum(['policy', 'stage-default', 'course', 'risk-floor', 'cli']) }),
  maxRepairCycles: z.number().int().min(0),
  onCapReached: z.enum(['human', 'fail']),
  repairSeverities: z.array(SeveritySchema),
  writablePaths: z.array(z.string()),
  readOnlyPaths: z.array(z.string()),
  expectedOutputs: z.array(z.string()),
  limits: StageDefSchema.shape.limits,
  decisions: z.array(RoutingDecisionSchema),
  registryHashes: z.record(z.string(), z.string()),
});
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
