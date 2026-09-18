/**
 * Schema barrel + the named catalogue that `scripts/gen-schemas.ts` turns into `schemas/*.schema.json`.
 * Agent-facing schemas are marked so the generator emits strict "wire" variants for Claude/Codex.
 */
import type { z } from 'zod';
import { BLOCK_KINDS, CLAIM_CATEGORIES, RISK_TIERS, STAGES, VISUAL_ARCHETYPES } from '../enums.js';
import * as content from './content.js';
import { classificationSchema } from './content.js';
import * as course from './course.js';
import * as model from './model.js';
import * as registry from './registry.js';
import * as reports from './reports.js';
import * as review from './review.js';

export * from './content.js';
export * from './course.js';
export * from './model.js';
export * from './registry.js';
export * from './reports.js';
export * from './review.js';

export const ImportStageClassificationSchema = classificationSchema([...STAGES]);
export const VisualArchetypeClassificationSchema = classificationSchema([...VISUAL_ARCHETYPES]);
export const ClaimCategoryClassificationSchema = classificationSchema([...CLAIM_CATEGORIES]);
export const RiskTierClassificationSchema = classificationSchema([...RISK_TIERS]);
export const BlockKindClassificationSchema = classificationSchema([...BLOCK_KINDS]);

export interface SchemaEntry {
  schema: z.ZodType;
  /** True when an agent returns this as structured output (emit strict wire schema). */
  agent: boolean;
  description: string;
}

/** Every named schema. The key is the file stem under `schemas/` and the value used in `outputSchema`. */
export const SCHEMAS = {
  // agent-facing outputs
  'concept-brief': { schema: content.ConceptBriefSchema, agent: true, description: 'CONCEPT stage output' },
  'research-brief': { schema: content.ResearchBriefSchema, agent: true, description: 'RESEARCH_BRIEF stage output' },
  'dossier-section': {
    schema: content.DossierSectionAgentSchema,
    agent: true,
    description: 'One research dossier section with sources and claims',
  },
  'instructional-design': { schema: content.InstructionalDesignSchema, agent: true, description: 'INSTRUCTIONAL_DESIGN stage output' },
  'storyboard-module': {
    schema: content.StoryboardModulePartSchema,
    agent: true,
    description: 'One storyboard module with its visuals and glossary',
  },
  'editorial-result': { schema: content.EditorialResultSchema, agent: true, description: 'Text-only editorial edits' },
  'visual-direction': { schema: content.VisualDirectionAgentSchema, agent: true, description: 'VISUAL_DIRECTION bounded choices' },
  'visual-spec': { schema: content.VisualSpecSchema, agent: true, description: 'One instructional visual specification' },
  'finding-set': { schema: review.FindingSetSchema, agent: true, description: 'Reviewer findings' },
  adjudication: { schema: review.AdjudicationAgentSchema, agent: true, description: 'AI adjudicator decisions' },
  'repair-result': { schema: review.RepairResultSchema, agent: true, description: 'Object replacements for JSON artifacts' },
  'html-repair-result': { schema: review.HtmlRepairResultSchema, agent: true, description: 'Find/replace edits on an HTML copy' },
  'classify-import-stage': { schema: ImportStageClassificationSchema, agent: true, description: 'Stage classifier' },
  'classify-visual-archetype': { schema: VisualArchetypeClassificationSchema, agent: true, description: 'Visual archetype classifier' },
  'classify-claim-category': { schema: ClaimCategoryClassificationSchema, agent: true, description: 'Claim category classifier' },
  'classify-risk-tier': { schema: RiskTierClassificationSchema, agent: true, description: 'Risk tier classifier' },
  'classify-block-kind': { schema: BlockKindClassificationSchema, agent: true, description: 'Block kind classifier' },
  // persisted artifacts
  'source-record': { schema: content.SourceRecordSchema, agent: false, description: 'research/sources.jsonl line' },
  'claim-record': { schema: content.ClaimRecordSchema, agent: false, description: 'research/claims.jsonl line' },
  'research-dossier': { schema: content.ResearchDossierSchema, agent: false, description: 'research/research-dossier.json' },
  storyboard: { schema: content.StoryboardSchema, agent: false, description: 'storyboard/storyboard.json' },
  'design-direction': { schema: content.DesignDirectionSchema, agent: false, description: 'Bounded visual direction' },
  'course-model': { schema: model.CourseModelSchema, agent: false, description: 'model/course.json' },
  'course-manifest': { schema: course.CourseManifestSchema, agent: false, description: 'course.yaml' },
  'course-state': { schema: course.CourseStateSchema, agent: false, description: 'state.json' },
  'artifact-registry': { schema: course.ArtifactRegistrySchema, agent: false, description: 'artifacts.json' },
  'run-event': { schema: course.RunEventSchema, agent: false, description: 'logs/run-events.jsonl line' },
  finding: { schema: review.FindingSchema, agent: false, description: 'Stored finding' },
  'repair-plan': { schema: review.RepairPlanSchema, agent: false, description: 'review/repair-plan.json' },
  'execution-plan': { schema: registry.ExecutionPlanSchema, agent: false, description: 'logs/execution-plans/*.json' },
  'routing-decision': { schema: registry.RoutingDecisionSchema, agent: false, description: 'logs/routing-decisions.jsonl line' },
  'stages-config': { schema: registry.StagesConfigSchema, agent: false, description: 'config/stages.json' },
  'tools-config': { schema: registry.ToolsConfigSchema, agent: false, description: 'config/tools.json' },
  'skills-config': { schema: registry.SkillsConfigSchema, agent: false, description: 'config/skills.json' },
  'reviewers-config': { schema: registry.ReviewersConfigSchema, agent: false, description: 'config/reviewers.json' },
  'routing-config': { schema: registry.RoutingConfigSchema, agent: false, description: 'config/routing.json' },
  'fallbacks-config': { schema: registry.FallbacksConfigSchema, agent: false, description: 'config/fallbacks.json' },
  'review-policy': { schema: registry.ReviewPolicySchema, agent: false, description: 'config/review-policy.json' },
  'build-report': { schema: reports.BuildReportSchema, agent: false, description: 'build/build-report.json' },
  'functional-report': { schema: reports.FunctionalReportSchema, agent: false, description: 'review/functional-tests.json' },
  'accessibility-report': { schema: reports.AccessibilityReportSchema, agent: false, description: 'review/accessibility-review.json' },
  'screenshot-manifest': { schema: reports.ScreenshotManifestSchema, agent: false, description: 'review/screenshots/manifest.json' },
  'intake-report': { schema: reports.IntakeReportSchema, agent: false, description: 'input/intake-report.json' },
  'release-manifest': { schema: reports.ReleaseManifestSchema, agent: false, description: 'release/release-manifest.json' },
  'environment-manifest': { schema: reports.EnvironmentManifestSchema, agent: false, description: '.courseforge/environment.json' },
} as const satisfies Record<string, SchemaEntry>;

export type SchemaName = keyof typeof SCHEMAS;

export function isSchemaName(name: string): name is SchemaName {
  return Object.hasOwn(SCHEMAS, name);
}
