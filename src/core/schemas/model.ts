/**
 * `model/course.json` — the canonical, strongly validated course model consumed by the renderer.
 * Produced deterministically at COURSE_MODEL from the canonical storyboard + visual direction, or
 * reconstructed from an imported HTML course.
 */
import { z } from 'zod';
import { BlockKindSchema, ComponentTypeSchema, DifficultySchema, RendererSchema } from '../enums.js';
import {
  AcronymSchema,
  CitationSchema,
  DesignDirectionSchema,
  GlossaryEntrySchema,
  InteractionSchema,
  ReferenceSchema,
  VisualSpecSchema,
} from './content.js';

export const ScreenSchema = z.object({
  /** Equals the storyboard block ID; also the DOM anchor (`data-cf-block`). */
  id: z.string(),
  index: z.number().int().min(0),
  moduleId: z.string(),
  kind: BlockKindSchema,
  component: ComponentTypeSchema,
  title: z.string(),
  subtype: z.string().nullable(),
  optional: z.boolean(),
  body: z.string(),
  treatment: z.string(),
  loIds: z.array(z.string()),
  claimIds: z.array(z.string()),
  citations: z.array(CitationSchema),
  visualId: z.string().nullable(),
  interaction: InteractionSchema.nullable(),
  graded: z.boolean(),
  difficulty: DifficultySchema.nullable(),
  accessibility: z.string(),
});
export type Screen = z.infer<typeof ScreenSchema>;

export const CourseModelSchema = z.object({
  schemaVersion: z.literal('1'),
  courseId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  language: z.string(),
  estimatedMinutes: z.number().int().nullable(),
  /** Semantic build version (e.g. `1.0.0`), not a timestamp, so builds stay reproducible. */
  version: z.string(),
  theme: DesignDirectionSchema,
  objectives: z.array(z.object({ id: z.string(), text: z.string() })),
  modules: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        summary: z.string(),
        role: z.enum(['intro', 'topic', 'review', 'graded']),
        loIds: z.array(z.string()),
        screenIds: z.array(z.string()).min(1),
      }),
    )
    .min(1),
  screens: z.array(ScreenSchema).min(1),
  glossary: z.array(GlossaryEntrySchema),
  acronyms: z.array(AcronymSchema),
  references: z.array(ReferenceSchema),
  visuals: z.array(VisualSpecSchema),
  visualRoutes: z.array(z.object({ visualId: z.string(), renderer: RendererSchema, fallbacks: z.array(RendererSchema), rule: z.string() })),
  assessment: z.object({ passingPercent: z.number().int().min(0).max(100), gradedScreenIds: z.array(z.string()) }),
  /** Provenance of the inputs this model was compiled from. */
  sourceArtifacts: z.array(z.object({ artifactId: z.string().nullable(), path: z.string(), hash: z.string() })),
});
export type CourseModel = z.infer<typeof CourseModelSchema>;
