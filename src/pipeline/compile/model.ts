/**
 * COURSE_MODEL compiler: canonical storyboard + visual direction → `model/course.json`. Pure and deterministic.
 */
import type { ComponentType, Renderer } from '../../core/enums.js';
import { COMPONENT_TYPES } from '../../core/enums.js';
import {
  type CourseModel,
  CourseModelSchema,
  type DesignDirection,
  type Screen,
  type Storyboard,
  type VisualSpec,
} from '../../core/schemas/index.js';

export interface ModelCompileInput {
  storyboard: Storyboard;
  direction: DesignDirection;
  /** Visual specs after VISUAL_DIRECTION reclassification (falls back to storyboard.visuals). */
  visuals: VisualSpec[] | null;
  visualRoutes: { visualId: string; renderer: Renderer; fallbacks: Renderer[]; rule: string }[];
  /** Block kind → component type (config/routing.json `components`). */
  componentMap: Record<string, string>;
  sourceArtifacts: { artifactId: string | null; path: string; hash: string }[];
  version?: string;
}

const COMPONENT_SET = new Set<string>(COMPONENT_TYPES);

export const RESULTS_SUFFIX = 'RESULTS';

export function compileCourseModel(input: ModelCompileInput): CourseModel {
  const { storyboard: sb } = input;
  const screens: Screen[] = [];
  const modules: CourseModel['modules'] = [];
  const gradedScreenIds: string[] = [];

  for (const m of sb.modules) {
    const ids: string[] = [];
    for (const b of m.blocks) {
      const mapped = input.componentMap[b.kind] ?? 'content';
      const component = (COMPONENT_SET.has(mapped) ? mapped : 'content') as ComponentType;
      const graded = b.kind === 'graded';
      screens.push({
        id: b.id,
        index: screens.length,
        moduleId: m.id,
        kind: b.kind,
        component: b.interaction && !graded && component !== 'scenario' ? 'question' : graded ? 'assessment-question' : component,
        title: b.title,
        subtype: b.subtype,
        optional: b.optional,
        body: b.body,
        treatment: b.treatment,
        loIds: b.loIds,
        claimIds: b.claimIds,
        citations: b.citations,
        visualId: b.visualId,
        interaction: b.interaction,
        graded,
        difficulty: b.difficulty,
        accessibility: b.accessibility,
      });
      ids.push(b.id);
      if (graded) gradedScreenIds.push(b.id);
    }
    const isLastGraded = m.role === 'graded' || (m.blocks.some((b) => b.kind === 'graded') && m === lastGradedModule(sb));
    if (isLastGraded && gradedScreenIds.length) {
      const id = `${m.id}-${RESULTS_SUFFIX}`;
      screens.push({
        id,
        index: screens.length,
        moduleId: m.id,
        kind: 'summary',
        component: 'results',
        title: 'Assessment results',
        subtype: 'results',
        optional: false,
        body: '',
        treatment: 'Shows the graded score, pass status and a per-item review with rationales.',
        loIds: [],
        claimIds: [],
        citations: [],
        visualId: null,
        interaction: null,
        graded: false,
        difficulty: null,
        accessibility: 'Score and per-item results are presented as text.',
      });
      ids.push(id);
    }
    modules.push({ id: m.id, title: m.title, summary: m.summary, role: m.role, loIds: m.loIds, screenIds: ids });
  }

  const visuals = input.visuals ?? sb.visuals;
  const model: CourseModel = {
    schemaVersion: '1',
    courseId: sb.courseId,
    title: sb.title,
    subtitle: sb.subtitle,
    language: sb.language,
    estimatedMinutes: sb.estimatedMinutes,
    version: input.version ?? '1.0.0',
    theme: input.direction,
    objectives: sb.objectives,
    modules,
    screens,
    glossary: sb.glossary,
    acronyms: sb.acronyms,
    references: sb.references,
    visuals,
    visualRoutes: [...input.visualRoutes].sort((a, b) => a.visualId.localeCompare(b.visualId)),
    assessment: { passingPercent: sb.assessment.passingPercent, gradedScreenIds },
    sourceArtifacts: input.sourceArtifacts,
  };
  return CourseModelSchema.parse(model);
}

function lastGradedModule(sb: Storyboard) {
  for (let i = sb.modules.length - 1; i >= 0; i--) {
    const m = sb.modules[i];
    if (m?.blocks.some((b) => b.kind === 'graded')) return m;
  }
  return null;
}

/** Integrity checks on a compiled model (used by the `model-integrity` validator). */
export function modelIntegrityProblems(model: CourseModel): { location: string; problem: string }[] {
  const out: { location: string; problem: string }[] = [];
  const ids = new Set<string>();
  for (const s of model.screens) {
    if (ids.has(s.id)) out.push({ location: s.id, problem: 'duplicate screen id' });
    ids.add(s.id);
  }
  for (const m of model.modules)
    for (const sid of m.screenIds) if (!ids.has(sid)) out.push({ location: m.id, problem: `module references missing screen ${sid}` });
  const visualIds = new Set(model.visuals.map((v) => v.id));
  for (const s of model.screens)
    if (s.visualId && !visualIds.has(s.visualId)) out.push({ location: s.id, problem: `missing visual ${s.visualId}` });
  const routed = new Set(model.visualRoutes.map((r) => r.visualId));
  for (const v of model.visuals) if (!routed.has(v.id)) out.push({ location: v.id, problem: 'visual has no resolved route' });
  for (const g of model.assessment.gradedScreenIds)
    if (!model.screens.find((s) => s.id === g && s.graded)) out.push({ location: g, problem: 'graded id is not a graded screen' });
  return out;
}
