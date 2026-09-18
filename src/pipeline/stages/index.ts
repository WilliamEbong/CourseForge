import type { Stage } from '../../core/enums.js';
import { concept, editorial, instructionalDesign, researchBrief, researchDossier, storyboard, visualDirection } from './authoring.js';
import type { StageHandler } from './common.js';
import { courseBuild, courseModel, courseQa, release } from './delivery.js';

export const HANDLERS: Record<Stage, StageHandler> = {
  CONCEPT: concept,
  RESEARCH_BRIEF: researchBrief,
  RESEARCH_DOSSIER: researchDossier,
  INSTRUCTIONAL_DESIGN: instructionalDesign,
  STORYBOARD: storyboard,
  EDITORIAL: editorial,
  VISUAL_DIRECTION: visualDirection,
  COURSE_MODEL: courseModel,
  COURSE_BUILD: courseBuild,
  COURSE_QA: courseQa,
  RELEASE: release,
};

export * from './common.js';
