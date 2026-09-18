/**
 * Closed vocabularies shared by every CourseForge module.
 *
 * Anything an agent is allowed to choose is expressed as one of these enums; deterministic code then maps
 * the enum to a concrete tool, renderer, reviewer or policy. Unknown values fail schema validation.
 */
import { z } from 'zod';

export const STAGES = [
  'CONCEPT',
  'RESEARCH_BRIEF',
  'RESEARCH_DOSSIER',
  'INSTRUCTIONAL_DESIGN',
  'STORYBOARD',
  'EDITORIAL',
  'VISUAL_DIRECTION',
  'COURSE_MODEL',
  'COURSE_BUILD',
  'COURSE_QA',
  'RELEASE',
] as const;
export const StageSchema = z.enum(STAGES);
export type Stage = z.infer<typeof StageSchema>;

/** Position of a stage in the canonical pipeline order (0-based). */
export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/** Short, filesystem-friendly code per stage (used in finding IDs and version labels). */
export const STAGE_CODES: Record<Stage, string> = {
  CONCEPT: 'CN',
  RESEARCH_BRIEF: 'RB',
  RESEARCH_DOSSIER: 'RD',
  INSTRUCTIONAL_DESIGN: 'ID',
  STORYBOARD: 'SB',
  EDITORIAL: 'ED',
  VISUAL_DIRECTION: 'VD',
  COURSE_MODEL: 'CM',
  COURSE_BUILD: 'BD',
  COURSE_QA: 'QA',
  RELEASE: 'RL',
};

export const STAGE_STATUSES = [
  'NOT_STARTED',
  'INGESTED',
  'VALIDATING',
  'GENERATING',
  'REVIEWING',
  'REPAIRING',
  'WAITING_FOR_HUMAN',
  'APPROVED',
  'LOCKED',
  'FAILED',
  'SUPERSEDED',
] as const;
export const StageStatusSchema = z.enum(STAGE_STATUSES);
export type StageStatus = z.infer<typeof StageStatusSchema>;

export const GATE_MODES = ['auto', 'hybrid', 'human'] as const;
export const GateModeSchema = z.enum(GATE_MODES);
export type GateMode = z.infer<typeof GateModeSchema>;
/** Ordering used to combine policy, course and risk-floor gates: the strictest wins. */
export const GATE_STRICTNESS: Record<GateMode, number> = { auto: 0, hybrid: 1, human: 2 };

/** Accepts the legacy vocabulary used in the bootstrap templates (`optional` / `required`). */
export const GateModeInputSchema = z.preprocess((v) => {
  if (v === 'optional') return 'auto';
  if (v === 'required') return 'human';
  return v;
}, GateModeSchema);

export const RISK_TIERS = ['standard', 'elevated', 'high_stakes'] as const;
export const RiskTierSchema = z.enum(RISK_TIERS);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const INTAKE_MODES = ['preserve', 'review-only', 'improve', 'rebuild'] as const;
export const IntakeModeSchema = z.enum(INTAKE_MODES);
export type IntakeMode = z.infer<typeof IntakeModeSchema>;

export const BACKENDS = ['claude', 'codex'] as const;
export const BackendNameSchema = z.enum(BACKENDS);
export type BackendName = z.infer<typeof BackendNameSchema>;
export const BackendPreferenceSchema = z.enum(['auto', 'claude', 'codex']);
export type BackendPreference = z.infer<typeof BackendPreferenceSchema>;
/** `fake` is the deterministic fixture harness used by tests and offline demos. */
export const HarnessNameSchema = z.enum(['claude', 'codex', 'fake']);
export type HarnessName = z.infer<typeof HarnessNameSchema>;

export const HARNESS_FAILURES = [
  'authentication_failed',
  'rate_limit',
  'overloaded',
  'billing_error',
  'invalid_request',
  'model_not_found',
  'server_error',
  'max_output_tokens',
  'timeout',
  'schema_invalid',
  'process_error',
  'unavailable',
  'unknown',
] as const;
export const HarnessFailureSchema = z.enum(HARNESS_FAILURES);
export type HarnessFailure = z.infer<typeof HarnessFailureSchema>;

export const STAGE_FAILURES = [
  ...HARNESS_FAILURES,
  'write_violation',
  'lock_violation',
  'validator_failed',
  'cycle_cap',
  'input_invalid',
  'renderer_failed',
  'qa_failed',
  'internal',
] as const;
export const StageFailureSchema = z.enum(STAGE_FAILURES);
export type StageFailure = z.infer<typeof StageFailureSchema>;

export const SEVERITIES = ['blocker', 'critical', 'major', 'minor', 'style'] as const;
export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;
/** Higher number = more severe. */
export const SEVERITY_RANK: Record<Severity, number> = { blocker: 4, critical: 3, major: 2, minor: 1, style: 0 };

export const FINDING_CATEGORIES = [
  'accuracy',
  'currentness',
  'evidence',
  'citation',
  'completeness',
  'scope',
  'safety',
  'alignment',
  'instructional',
  'cognitive-load',
  'assessment',
  'scenario',
  'accessibility',
  'editorial',
  'consistency',
  'visual',
  'ui',
  'ux',
  'functional',
  'performance',
  'traceability',
  'structure',
  'other',
] as const;
export const FindingCategorySchema = z.enum(FINDING_CATEGORIES);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export const ConfidenceSchema = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** The 20 instructional visual archetypes of spec 08, plus the two Mermaid-native structures of spec 05. */
export const VISUAL_ARCHETYPES = [
  'PROCESS',
  'LIFECYCLE',
  'TIMELINE',
  'HIERARCHY',
  'DECISION_TREE',
  'COMPARISON',
  'BEFORE_AFTER',
  'LAYERED_SYSTEM',
  'RESPONSIBILITY_MAP',
  'FEEDBACK_LOOP',
  'CAUSE_EFFECT',
  'CONTINUUM',
  'MATRIX',
  'LABELED_OBJECT',
  'EVIDENCE_MAP',
  'FUNNEL',
  'RELATIONSHIP_NETWORK',
  'QUANTITATIVE_CHART',
  'SCENARIO_MAP',
  'SYSTEM_ARCHITECTURE',
  'SEQUENCE',
  'STATE_DIAGRAM',
] as const;
export const VisualArchetypeSchema = z.enum(VISUAL_ARCHETYPES);
export type VisualArchetype = z.infer<typeof VisualArchetypeSchema>;

export const RENDERERS = ['mermaid', 'cf_svg', 'svgjs', 'vega_lite', 'd3', 'lucide', 'text_equivalent'] as const;
export const RendererSchema = z.enum(RENDERERS);
export type Renderer = z.infer<typeof RendererSchema>;

export const VISUAL_INTERACTIONS = ['none', 'reveal', 'interactive-data'] as const;
export const VisualInteractionSchema = z.enum(VISUAL_INTERACTIONS);
export type VisualInteraction = z.infer<typeof VisualInteractionSchema>;

export const INTERACTION_MODES = ['single', 'multiple', 'matching', 'categorization', 'sequencing', 'reveal'] as const;
export const InteractionModeSchema = z.enum(INTERACTION_MODES);
export type InteractionMode = z.infer<typeof InteractionModeSchema>;

export const BLOCK_KINDS = [
  'section-title',
  'topic-title',
  'content',
  'concept',
  'technical-depth',
  'example',
  'comparison',
  'process',
  'evidence',
  'warning',
  'misconception',
  'scenario',
  'review',
  'summary',
  'formative',
  'graded',
] as const;
export const BlockKindSchema = z.enum(BLOCK_KINDS);
export type BlockKind = z.infer<typeof BlockKindSchema>;

export const COMPONENT_TYPES = [
  'module-landing',
  'content',
  'concept',
  'technical-depth',
  'evidence-callout',
  'warning-callout',
  'misconception',
  'comparison',
  'process',
  'scenario',
  'review',
  'question',
  'assessment-question',
  'results',
] as const;
export const ComponentTypeSchema = z.enum(COMPONENT_TYPES);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

export const VISUAL_FAMILIES = [
  'scientific-clinical',
  'technical-industrial',
  'corporate-professional',
  'editorial-humanities',
  'modern-technology',
  'environmental-natural',
] as const;
export const VisualFamilySchema = z.enum(VISUAL_FAMILIES);
export type VisualFamily = z.infer<typeof VisualFamilySchema>;

export const CLAIM_CATEGORIES = [
  'law-regulation',
  'scientific-technical',
  'statistic',
  'version-currentness',
  'guidance-recommendation',
  'definition',
  'scenario-synthesis',
] as const;
export const ClaimCategorySchema = z.enum(CLAIM_CATEGORIES);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

export const SOURCE_TYPES = [
  'legislation',
  'regulation',
  'standard',
  'government-guidance',
  'professional-guidance',
  'peer-reviewed',
  'textbook',
  'organization',
  'dataset',
  'news',
  'internal',
  'other',
] as const;
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export const BloomLevelSchema = z.enum(BLOOM_LEVELS);

export const DIFFICULTIES = ['foundational', 'applied', 'integrative'] as const;
export const DifficultySchema = z.enum(DIFFICULTIES);

export const PRODUCER_KINDS = ['human', 'claude', 'codex', 'fake', 'imported', 'courseforge'] as const;
export const ProducerKindSchema = z.enum(PRODUCER_KINDS);
export type ProducerKind = z.infer<typeof ProducerKindSchema>;

export const SOURCE_FORMATS = ['md', 'txt', 'html', 'json', 'docx', 'pdf'] as const;
export const SourceFormatSchema = z.enum(SOURCE_FORMATS);
export type SourceFormat = z.infer<typeof SourceFormatSchema>;

/** Process exit codes for the CLI (documented in docs/user-guide/cli.md). */
export const EXIT = {
  OK: 0,
  INTERNAL: 1,
  USAGE: 2,
  ENVIRONMENT: 3,
  BLOCKED: 4,
  COURSE_LOCKED: 5,
  WAITING_FOR_HUMAN: 10,
  STAGE_FAILED: 11,
} as const;
export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
