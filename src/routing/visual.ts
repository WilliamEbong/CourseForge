import { type Renderer, RendererSchema, VisualArchetypeSchema, VisualInteractionSchema } from '../core/enums.js';
import { RoutingError } from '../core/errors.js';
import type { RoutingConfig, ToolsConfig } from '../core/schemas/index.js';

export interface VisualRouteInput {
  id: string;
  archetype: string;
  interaction: string | null;
  rendererOverride: string | null;
}

export interface VisualRouteResult {
  renderer: Renderer;
  /** Ordered fallback chain; always ends with `text_equivalent`. */
  fallbacks: Renderer[];
  rule: string;
}

export const OVERRIDE_RULE = 'VIS-OVERRIDE-000';
const TERMINAL: Renderer = 'text_equivalent';

function chain(primary: Renderer, candidates: Renderer[]): Renderer[] {
  const out: Renderer[] = [];
  for (const r of [...candidates, TERMINAL]) if (r !== primary && !out.includes(r)) out.push(r);
  return out;
}

/** Deterministic visual routing: first matching rule in `routing.visualRoutes` wins (spec 05). */
export function routeVisual(v: VisualRouteInput, routing: RoutingConfig, tools: ToolsConfig): VisualRouteResult {
  const archetype = VisualArchetypeSchema.safeParse(v.archetype);
  if (!archetype.success) throw new RoutingError(`Visual ${v.id}: unknown archetype "${v.archetype}"`, { visualId: v.id });
  const interaction = VisualInteractionSchema.safeParse(v.interaction ?? 'none');
  if (!interaction.success) throw new RoutingError(`Visual ${v.id}: unknown interaction "${v.interaction}"`, { visualId: v.id });

  const route = routing.visualRoutes.find(
    (r) =>
      (r.when.archetype === null || r.when.archetype === archetype.data) &&
      (r.when.interaction === null || r.when.interaction === interaction.data),
  );
  if (!route) throw new RoutingError(`Visual ${v.id}: no visual route matches ${archetype.data}/${interaction.data}`, { visualId: v.id });

  if (v.rendererOverride) {
    const parsed = RendererSchema.safeParse(v.rendererOverride);
    const tool = parsed.success ? tools.tools[parsed.data] : undefined;
    if (!parsed.success || !tool || (tool.kind !== 'renderer' && tool.kind !== 'asset')) {
      throw new RoutingError(`Visual ${v.id}: rendererOverride "${v.rendererOverride}" is not a registered renderer`, { visualId: v.id });
    }
    return { renderer: parsed.data, fallbacks: chain(parsed.data, [route.primary, ...route.fallbacks]), rule: OVERRIDE_RULE };
  }
  return { renderer: route.primary, fallbacks: chain(route.primary, route.fallbacks), rule: route.rule };
}
