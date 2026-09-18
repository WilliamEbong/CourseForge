/**
 * Review, adjudication and repair contracts (spec 04).
 *
 * Reviewers return `FindingSet` (agent-facing, strict). CourseForge assigns IDs and provenance to produce
 * `Finding` records. Adjudication is split: deterministic pre-adjudication in code, then an optional AI
 * adjudicator (`AdjudicationAgent`). The repair plan is always built by code.
 */
import { z } from 'zod';
import { ConfidenceSchema, FindingCategorySchema, SeveritySchema, StageSchema } from '../enums.js';

const S = z.strictObject;

/** What a reviewer agent returns for one finding. */
export const FindingAgentSchema = S({
  severity: SeveritySchema,
  category: FindingCategorySchema,
  /** Stable ID of the affected block/item/section/visual/source, a CSS selector for HTML, or `global`. */
  location: z.string().min(1),
  problem: z.string().min(1),
  /** IDs or short quotes that justify the finding (LO IDs, source IDs, block IDs, test names). */
  evidence: z.array(z.string()),
  recommendedAction: z.string(),
  confidence: ConfidenceSchema,
});
export type FindingAgent = z.infer<typeof FindingAgentSchema>;

export const FindingSetSchema = S({
  /** One-paragraph summary of the review, for the consolidated report. */
  summary: z.string(),
  findings: z.array(FindingAgentSchema),
});
export type FindingSet = z.infer<typeof FindingSetSchema>;

export const FindingStatusSchema = z.enum(['open', 'accepted', 'rejected', 'fixed', 'waived', 'deferred']);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

/** A finding as stored by CourseForge (`review/findings/...`). */
export const FindingSchema = z.object({
  findingId: z.string(),
  stage: StageSchema,
  reviewer: z.string(),
  source: z.enum(['reviewer', 'validator', 'qa', 'human']),
  cycle: z.number().int().min(0),
  artifactId: z.string().nullable().default(null),
  severity: SeveritySchema,
  category: FindingCategorySchema,
  location: z.string(),
  problem: z.string(),
  evidence: z.array(z.string()).default([]),
  recommendedAction: z.string().default(''),
  confidence: ConfidenceSchema.default('medium'),
  status: FindingStatusSchema.default('open'),
  mergedFrom: z.array(z.string()).default([]),
  /** Validator / QA check identifier when source is not a reviewer. */
  checkId: z.string().nullable().default(null),
});
export type Finding = z.infer<typeof FindingSchema>;

/** AI adjudicator output (only consulted for semantic decisions deterministic code cannot make). */
export const AdjudicationAgentSchema = S({
  decisions: z.array(
    S({
      findingId: z.string(),
      verdict: z.enum(['accept', 'reject', 'defer-to-human']),
      finalSeverity: SeveritySchema,
      rationale: z.string(),
      /** Concrete, scoped instruction for the repair agent; null when rejected/deferred. */
      repairInstruction: z.string().nullable(),
    }),
  ),
  conflicts: z.array(S({ findingIds: z.array(z.string()), description: z.string(), resolution: z.string() })),
});
export type AdjudicationAgent = z.infer<typeof AdjudicationAgentSchema>;

export const RepairActionSchema = z.object({
  actionId: z.string(),
  /** The stable ID (block/item/section/visual) or selector the repair may touch. */
  targetId: z.string(),
  findingIds: z.array(z.string()).min(1),
  severity: SeveritySchema,
  category: FindingCategorySchema,
  instruction: z.string(),
});
export type RepairAction = z.infer<typeof RepairActionSchema>;

export const RepairPlanSchema = z.object({
  schemaVersion: z.literal(1),
  stage: StageSchema,
  cycle: z.number().int().min(0),
  artifactId: z.string().nullable(),
  /** `model` = replace objects by ID in a JSON artifact; `html-direct` = find/replace edits on an HTML copy. */
  target: z.enum(['model', 'html-direct', 'tooling-defect']),
  actions: z.array(RepairActionSchema),
  lockConflicts: z.array(z.object({ findingId: z.string(), targetId: z.string() })),
  deferred: z.array(z.string()),
  rejected: z.array(z.string()),
  /** Findings that remain open but are not repairable in this cycle (e.g. tooling defects). */
  unrepairable: z.array(z.string()).default([]),
});
export type RepairPlan = z.infer<typeof RepairPlanSchema>;

/** Repair agent output for JSON-canonical artifacts: whole-object replacements keyed by stable ID. */
export const RepairResultSchema = S({
  replacements: z.array(
    S({
      targetId: z.string(),
      /** The complete replacement object serialised as JSON; validated against the artifact's item schema. */
      objectJson: z.string(),
      actionIds: z.array(z.string()),
    }),
  ),
  notes: z.string(),
});
export type RepairResult = z.infer<typeof RepairResultSchema>;

/** Repair agent output for imported HTML with no reconstructable model: exact find/replace edits. */
export const HtmlRepairResultSchema = S({
  edits: z.array(S({ actionId: z.string(), find: z.string(), replace: z.string() })),
  notes: z.string(),
});
export type HtmlRepairResult = z.infer<typeof HtmlRepairResultSchema>;
