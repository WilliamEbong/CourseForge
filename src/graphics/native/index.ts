/** Native (`cf_svg`) renderer: pure TypeScript archetype builders, no browser required. */
import type { VisualArchetype } from '../../core/enums.js';
import type { VisualSpec } from '../../core/schemas/content.js';
import type { GraphicsTheme } from '../theme.js';
import { continuum, feedbackLoop, funnel, lifecycle, processBand, timeline } from './flow.js';
import { beforeAfter, comparison, layeredSystem, matrix, responsibilityMap } from './grid.js';
import { type Ctx, ctxOf } from './kit.js';
import { evidenceMap, hierarchy, scenarioMap } from './tree.js';

type Builder = (spec: VisualSpec, ctx: Ctx) => string;

export const NATIVE_BUILDERS: Partial<Record<VisualArchetype, Builder>> = {
  PROCESS: processBand,
  LIFECYCLE: lifecycle,
  FEEDBACK_LOOP: feedbackLoop,
  TIMELINE: timeline,
  CONTINUUM: continuum,
  FUNNEL: funnel,
  COMPARISON: comparison,
  BEFORE_AFTER: beforeAfter,
  MATRIX: matrix,
  LAYERED_SYSTEM: layeredSystem,
  RESPONSIBILITY_MAP: responsibilityMap,
  HIERARCHY: hierarchy,
  SCENARIO_MAP: scenarioMap,
  EVIDENCE_MAP: evidenceMap,
};

export const NATIVE_ARCHETYPES = Object.keys(NATIVE_BUILDERS) as VisualArchetype[];

/** Raw (un-post-processed) SVG for a spec; throws when the archetype has no native builder. */
export function renderNative(spec: VisualSpec, theme: GraphicsTheme): string {
  const build = NATIVE_BUILDERS[spec.archetype];
  if (!build) throw new Error(`cf_svg has no native builder for ${spec.archetype}`);
  return build(spec, ctxOf(theme));
}
