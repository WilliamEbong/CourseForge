/**
 * Course content artifacts produced by stages CONCEPT … VISUAL_DIRECTION.
 *
 * Schemas named `*Agent*` / used as agent outputs follow the strict-output subset shared by Claude
 * `--json-schema` and Codex `--output-schema`: every object is strict, every property is required and
 * optional values are expressed as `nullable`. Numeric/length constraints are validated by zod after the
 * agent returns (they are stripped from the wire schema, see `src/core/wire-schema.ts`).
 */
import { z } from 'zod';
import {
  BlockKindSchema,
  BloomLevelSchema,
  ClaimCategorySchema,
  ConfidenceSchema,
  DifficultySchema,
  InteractionModeSchema,
  RendererSchema,
  RiskTierSchema,
  SourceTypeSchema,
  VisualArchetypeSchema,
  VisualFamilySchema,
  VisualInteractionSchema,
} from '../enums.js';

const S = z.strictObject;
const Id = z.string().min(1).max(60);

/* ------------------------------------------------------------------ CONCEPT */

export const ConceptBriefSchema = S({
  title: z.string(),
  summary: z.string(),
  audience: z.string(),
  prerequisites: z.array(z.string()),
  targetDurationMinutes: z.number().int().min(5).max(2400),
  language: z.string(),
  jurisdiction: z.string().nullable(),
  riskTier: RiskTierSchema,
  riskRationale: z.string(),
  domains: z.array(z.string()),
  learningGoals: z.array(z.string()),
  assumptions: z.array(S({ text: z.string(), highStakes: z.boolean() })),
  gaps: z.array(z.string()),
  outOfScope: z.array(z.string()),
});
export type ConceptBrief = z.infer<typeof ConceptBriefSchema>;

/* ----------------------------------------------------------- RESEARCH_BRIEF */

export const ResearchBriefSchema = S({
  title: z.string(),
  purpose: z.string(),
  audience: z.string(),
  scope: z.array(z.string()),
  exclusions: z.array(z.string()),
  researchQuestions: z.array(S({ id: Id, question: z.string(), priority: z.enum(['core', 'supporting']) })).min(1),
  sourceHierarchy: z.array(S({ rank: z.number().int().min(1), sourceType: SourceTypeSchema, rationale: z.string() })),
  jurisdictions: z.array(z.string()),
  safetyBoundaries: z.array(z.string()),
  dossierPlan: z.array(S({ sectionId: Id, title: z.string(), questionIds: z.array(Id), notes: z.string() })).min(1),
  evidenceRequirements: z.array(z.string()),
  currentnessRequirements: z.array(z.string()),
});
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;

/* --------------------------------------------------------- RESEARCH_DOSSIER */

export const CitationSchema = S({
  sourceId: Id,
  /** Pinpoint locator such as `s.21`, `ss.404-407`, `p.12`, `§4.6`. */
  locator: z.string().nullable(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const SourceRecordSchema = S({
  id: Id,
  title: z.string(),
  author: z.string().nullable(),
  publisher: z.string().nullable(),
  type: SourceTypeSchema,
  url: z.string().nullable(),
  doi: z.string().nullable(),
  date: z.string().nullable(),
  version: z.string().nullable(),
  accessed: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  authority: z.enum(['primary', 'secondary', 'tertiary']),
  currentnessNotes: z.string().nullable(),
  licenseNotes: z.string().nullable(),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;

export const ClaimRecordSchema = S({
  id: Id,
  text: z.string(),
  category: ClaimCategorySchema,
  citations: z.array(CitationSchema),
  sectionId: Id.nullable(),
  jurisdiction: z.string().nullable(),
  confidence: ConfidenceSchema,
  qualifications: z.string().nullable(),
});
export type ClaimRecord = z.infer<typeof ClaimRecordSchema>;

/** Agent output for one dossier section (research fans out per planned section). */
export const DossierSectionAgentSchema = S({
  sectionId: Id,
  title: z.string(),
  /** Markdown body. Citations are inline bracket tokens: `[SRC-ID]`, `[SRC-A s.21; SRC-B]`. */
  markdown: z.string(),
  sources: z.array(SourceRecordSchema),
  /** `id` here is a section-local key; CourseForge mints stable `CLM-nnnn` IDs on merge. */
  claims: z.array(ClaimRecordSchema),
});
export type DossierSectionAgent = z.infer<typeof DossierSectionAgentSchema>;

export const ResearchDossierSchema = z.object({
  schemaVersion: z.literal('1'),
  title: z.string(),
  version: z.number().int().min(1),
  sections: z.array(z.object({ sectionId: Id, title: z.string(), markdown: z.string(), claimIds: z.array(Id), sourceIds: z.array(Id) })),
});
export type ResearchDossier = z.infer<typeof ResearchDossierSchema>;

/* ----------------------------------------------------- INSTRUCTIONAL_DESIGN */

export const LearningObjectiveSchema = S({
  id: Id,
  statement: z.string(),
  verb: z.string(),
  bloomLevel: BloomLevelSchema,
  claimIds: z.array(Id),
  sourceIds: z.array(Id),
});
export type LearningObjective = z.infer<typeof LearningObjectiveSchema>;

export const InstructionalDesignSchema = S({
  title: z.string(),
  audience: z.string(),
  prerequisites: z.array(z.string()),
  scopeBoundaries: z.array(z.string()),
  durationMinutes: z.number().int().min(5),
  objectives: z.array(LearningObjectiveSchema).min(1),
  dispositions: z.array(
    S({
      topic: z.string(),
      disposition: z.enum(['core', 'enrichment', 'reference', 'excluded']),
      reason: z.string(),
      sourceIds: z.array(Id),
    }),
  ),
  modules: z
    .array(
      S({
        id: Id,
        title: z.string(),
        purpose: z.string(),
        loIds: z.array(Id),
        contentSequence: z.array(z.string()),
        misconceptions: z.array(z.string()),
        examples: z.array(z.string()),
        formativePractice: z.array(z.string()),
        durationMinutes: z.number().int().min(1),
        sourceIds: z.array(Id),
      }),
    )
    .min(1),
  alignment: z.array(
    S({
      loId: Id,
      moduleIds: z.array(Id),
      formativeMethod: z.string(),
      gradedMethod: z.string(),
      cognitiveLevel: BloomLevelSchema,
    }),
  ),
  assessmentStrategy: S({
    formativePerModule: z.number().int().min(0),
    gradedItemCount: z.number().int().min(0),
    passingPercent: z.number().int().min(0).max(100),
    notes: z.string(),
  }),
  scenarioStrategy: z.string(),
  glossaryPlan: z.array(S({ term: z.string(), definition: z.string() })),
  evidenceGaps: z.array(S({ description: z.string(), impact: z.string(), action: z.string() })),
});
export type InstructionalDesign = z.infer<typeof InstructionalDesignSchema>;

/* --------------------------------------------------------------- STORYBOARD */

export const InteractionSchema = S({
  mode: InteractionModeSchema,
  stem: z.string(),
  /** Choices (single/multiple), prompts (matching), items to sort (categorization), steps (sequencing). */
  options: z.array(S({ key: Id, text: z.string() })),
  /** Match targets (matching) or categories (categorization); empty otherwise. */
  targets: z.array(S({ key: Id, text: z.string() })),
  /** single: exactly one key; multiple: all correct keys; empty for other modes. */
  correctKeys: z.array(Id),
  /** matching / categorization: option key → target key. */
  mapping: z.array(S({ key: Id, target: Id })),
  /** sequencing: option keys in correct order. */
  order: z.array(Id),
  feedbackCorrect: z.string(),
  feedbackIncorrect: z.string(),
  /** Optional per-option feedback (distractor rationales). */
  optionFeedback: z.array(S({ key: Id, text: z.string() })),
  rationale: z.string(),
});
export type Interaction = z.infer<typeof InteractionSchema>;

export const BlockSchema = S({
  id: Id,
  kind: BlockKindSchema,
  /** Open vocabulary refinement, e.g. `terminology`, `continuing case`, `optional deeper reading`. */
  subtype: z.string().nullable(),
  title: z.string(),
  optional: z.boolean(),
  /** Complete learner-facing content, Markdown-lite (paragraphs, **bold**, *em*, lists, links). */
  body: z.string(),
  /** Learning treatment / interaction behaviour notes for implementers and reviewers. */
  treatment: z.string(),
  loIds: z.array(Id),
  citations: z.array(CitationSchema),
  claimIds: z.array(Id),
  visualId: Id.nullable(),
  /** Accessibility alternative / notes (never the only place essential content lives). */
  accessibility: z.string(),
  interaction: InteractionSchema.nullable(),
  difficulty: DifficultySchema.nullable(),
});
export type Block = z.infer<typeof BlockSchema>;

export const VisualContentSchema = S({
  items: z.array(S({ id: Id, label: z.string(), detail: z.string().nullable(), group: Id.nullable(), value: z.number().nullable() })),
  links: z.array(S({ from: Id, to: Id, label: z.string().nullable() })),
  groups: z.array(S({ id: Id, label: z.string() })),
  columns: z.array(z.string()),
  rows: z.array(S({ label: z.string(), cells: z.array(z.string()) })),
  axes: S({ x: z.string().nullable(), y: z.string().nullable() }),
  chartType: z.enum(['bar', 'stacked-bar', 'line', 'area', 'point']).nullable(),
});
export type VisualContent = z.infer<typeof VisualContentSchema>;

export const VisualSpecSchema = S({
  id: Id,
  title: z.string(),
  /** The instructional job this visual does (not decoration). */
  purpose: z.string(),
  archetype: VisualArchetypeSchema,
  content: VisualContentSchema,
  sourceIds: z.array(Id),
  textEquivalent: S({ short: z.string().min(3), long: z.string().min(10) }),
  interaction: VisualInteractionSchema,
  rendererOverride: RendererSchema.nullable(),
  /** Explicit Mermaid source; when null CourseForge generates it from `content`. */
  mermaid: z.string().nullable(),
});
export type VisualSpec = z.infer<typeof VisualSpecSchema>;

export const GlossaryEntrySchema = S({ id: Id, term: z.string(), definition: z.string(), sourceIds: z.array(Id) });
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;
export const AcronymSchema = S({ id: Id, acronym: z.string(), expansion: z.string(), firstUseBlockId: Id.nullable() });
export type Acronym = z.infer<typeof AcronymSchema>;

export const StoryboardModuleSchema = S({
  id: Id,
  title: z.string(),
  summary: z.string(),
  loIds: z.array(Id),
  /** `graded` marks the final summative assessment module. */
  role: z.enum(['intro', 'topic', 'review', 'graded']),
  blocks: z.array(BlockSchema).min(1),
});
export type StoryboardModule = z.infer<typeof StoryboardModuleSchema>;

/** Agent output for one storyboard module (storyboard fans out per module). */
export const StoryboardModulePartSchema = S({
  module: StoryboardModuleSchema,
  visuals: z.array(VisualSpecSchema),
  glossary: z.array(GlossaryEntrySchema),
  acronyms: z.array(AcronymSchema),
});
export type StoryboardModulePart = z.infer<typeof StoryboardModulePartSchema>;

export const ReferenceSchema = SourceRecordSchema;
export type Reference = SourceRecord;

/** Canonical storyboard (`storyboard/storyboard.json`, `storyboard/storyboard-edited.json`). */
export const StoryboardSchema = z.object({
  schemaVersion: z.literal('1'),
  courseId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  language: z.string().default('en'),
  estimatedMinutes: z.number().int().nullable().default(null),
  objectives: z.array(z.object({ id: Id, text: z.string() })),
  modules: z.array(StoryboardModuleSchema).min(1),
  glossary: z.array(GlossaryEntrySchema).default([]),
  acronyms: z.array(AcronymSchema).default([]),
  references: z.array(ReferenceSchema).default([]),
  visuals: z.array(VisualSpecSchema).default([]),
  assessment: z.object({ passingPercent: z.number().int().min(0).max(100) }).default({ passingPercent: 80 }),
  /** Free-form notes carried from imports (e.g. appendices that do not map to structure). */
  notes: z.array(z.string()).default([]),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

/* ---------------------------------------------------------------- EDITORIAL */

export const EDITABLE_FIELDS = [
  'title',
  'body',
  'treatment',
  'stem',
  'feedbackCorrect',
  'feedbackIncorrect',
  'rationale',
  'optionText',
  'optionFeedback',
  'targetText',
] as const;

export const EditorialResultSchema = S({
  edits: z.array(
    S({
      blockId: Id,
      field: z.enum(EDITABLE_FIELDS),
      /** For option/target fields, the key being edited; null otherwise. */
      key: Id.nullable(),
      text: z.string(),
      reason: z.string(),
    }),
  ),
  notes: z.string(),
});
export type EditorialResult = z.infer<typeof EditorialResultSchema>;

/* --------------------------------------------------------- VISUAL_DIRECTION */

export const DesignDirectionSchema = S({
  family: VisualFamilySchema,
  /** Accent hue in degrees; must be a multiple of 15. */
  accentHue: z.number().int().min(0).max(345).multipleOf(15),
  density: z.enum(['comfortable', 'compact']),
  corner: z.enum(['sharp', 'soft', 'round']),
  typeScale: z.enum(['compact', 'default', 'generous']),
  figureStyle: z.enum(['line', 'filled']),
});
export type DesignDirection = z.infer<typeof DesignDirectionSchema>;

export const VisualDirectionAgentSchema = S({
  direction: DesignDirectionSchema,
  rationale: z.string(),
  /** Human-readable design brief (Markdown) explaining the choices for this subject and audience. */
  briefMarkdown: z.string(),
  visualClassifications: z.array(
    S({ visualId: Id, archetype: VisualArchetypeSchema, rendererOverride: RendererSchema.nullable(), rationale: z.string() }),
  ),
});
export type VisualDirectionAgent = z.infer<typeof VisualDirectionAgentSchema>;

/* ------------------------------------------------------------ CLASSIFIERS */

export function classificationSchema<T extends [string, ...string[]]>(values: T) {
  return S({ value: z.enum(values), confidence: ConfidenceSchema, evidence: z.array(z.string()) });
}
