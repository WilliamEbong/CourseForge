import { describe, expect, it } from 'vitest';
import { VISUAL_ARCHETYPES } from '../../../src/core/enums.js';
import { RoutingError } from '../../../src/core/errors.js';
import { OVERRIDE_RULE, routeVisual } from '../../../src/routing/visual.js';
import { registries } from './helpers.js';

const route = (archetype: string, interaction: string | null = 'none', rendererOverride: string | null = null) =>
  routeVisual({ id: 'V-1', archetype, interaction, rendererOverride }, registries.routing, registries.tools);

const EXPECTED: Record<string, [string, string]> = {
  PROCESS: ['cf_svg', 'mermaid'],
  TIMELINE: ['cf_svg', 'mermaid'],
  DECISION_TREE: ['mermaid', 'svgjs'],
  CAUSE_EFFECT: ['mermaid', 'svgjs'],
  SYSTEM_ARCHITECTURE: ['mermaid', 'svgjs'],
  SEQUENCE: ['mermaid', 'svgjs'],
  STATE_DIAGRAM: ['mermaid', 'svgjs'],
  LIFECYCLE: ['cf_svg', 'svgjs'],
  COMPARISON: ['cf_svg', 'svgjs'],
  BEFORE_AFTER: ['cf_svg', 'svgjs'],
  LAYERED_SYSTEM: ['cf_svg', 'svgjs'],
  RESPONSIBILITY_MAP: ['cf_svg', 'svgjs'],
  FEEDBACK_LOOP: ['cf_svg', 'svgjs'],
  CONTINUUM: ['cf_svg', 'svgjs'],
  MATRIX: ['cf_svg', 'svgjs'],
  EVIDENCE_MAP: ['cf_svg', 'svgjs'],
  FUNNEL: ['cf_svg', 'svgjs'],
  SCENARIO_MAP: ['cf_svg', 'svgjs'],
  HIERARCHY: ['cf_svg', 'mermaid'],
  LABELED_OBJECT: ['svgjs', 'cf_svg'],
  RELATIONSHIP_NETWORK: ['svgjs', 'd3'],
  QUANTITATIVE_CHART: ['vega_lite', 'd3'],
};

describe('visual routing @D2 @H4', () => {
  it('covers all 22 archetypes', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...VISUAL_ARCHETYPES].sort());
  });

  it.each(VISUAL_ARCHETYPES)('%s routes to its primary renderer and ends in text_equivalent', (a) => {
    const [primary, fallback] = EXPECTED[a] as [string, string];
    expect(route(a)).toEqual({ renderer: primary, fallbacks: [fallback, 'text_equivalent'], rule: `VIS-${a}-001` });
  });

  it('interactive-data quantitative charts go to d3 first (VIS-QUANT-002)', () => {
    expect(route('QUANTITATIVE_CHART', 'interactive-data')).toEqual({
      renderer: 'd3',
      fallbacks: ['vega_lite', 'text_equivalent'],
      rule: 'VIS-QUANT-002',
    });
    expect(route('QUANTITATIVE_CHART', 'reveal').rule).toBe('VIS-QUANTITATIVE_CHART-001');
  });

  it('null interaction is treated as none', () => {
    expect(route('PROCESS', null).rule).toBe('VIS-PROCESS-001');
  });

  it('honours a registered renderer override and keeps the archetype chain as fallbacks (deduped)', () => {
    expect(route('PROCESS', 'none', 'svgjs')).toEqual({
      renderer: 'svgjs',
      fallbacks: ['cf_svg', 'mermaid', 'text_equivalent'],
      rule: OVERRIDE_RULE,
    });
    expect(route('LABELED_OBJECT', 'none', 'cf_svg')).toEqual({
      renderer: 'cf_svg',
      fallbacks: ['svgjs', 'text_equivalent'],
      rule: OVERRIDE_RULE,
    });
  });

  it('rejects an unregistered or unknown renderer override', () => {
    expect(() => route('PROCESS', 'none', 'text_equivalent')).toThrow(RoutingError);
    expect(() => route('PROCESS', 'none', 'graphviz')).toThrow(RoutingError);
    const tools = structuredClone(registries.tools);
    delete tools.tools.d3;
    expect(() =>
      routeVisual({ id: 'V', archetype: 'PROCESS', interaction: 'none', rendererOverride: 'd3' }, registries.routing, tools),
    ).toThrow(RoutingError);
  });

  it('rejects unknown archetype and interaction', () => {
    expect(() => route('SPIRAL')).toThrow(RoutingError);
    expect(() => route('PROCESS', 'wiggle')).toThrow(RoutingError);
  });

  it('first matching rule wins (ordering matters)', () => {
    const routing = structuredClone(registries.routing);
    routing.visualRoutes.unshift({ rule: 'VIS-ANY-000', when: { archetype: null, interaction: null }, primary: 'svgjs', fallbacks: [] });
    expect(routeVisual({ id: 'V', archetype: 'FUNNEL', interaction: 'none', rendererOverride: null }, routing, registries.tools)).toEqual({
      renderer: 'svgjs',
      fallbacks: ['text_equivalent'],
      rule: 'VIS-ANY-000',
    });
  });
});
