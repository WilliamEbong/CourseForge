import { load } from 'cheerio';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { VisualSpec } from '../../../src/core/schemas/content.js';
import { GraphicsBrowser } from '../../../src/graphics/browser.js';
import { type RenderContext, renderAll, renderVisual } from '../../../src/graphics/render.js';
import { FIXTURES, makeSpec } from '../../fixtures/visuals/index.js';

const browser = new GraphicsBrowser();
afterAll(() => browser.close());

const fx = (k: string): VisualSpec => {
  const s = FIXTURES[k];
  if (!s) throw new Error(`fixture ${k}`);
  return s;
};
const ctx = (over: Partial<RenderContext> = {}): RenderContext => ({
  browser,
  theme: { figureStyle: 'line' },
  maxSemanticRepairs: 1,
  ...over,
});

describe('bounded render loop', () => {
  it('@H4 forced primary failure → one repair → fallback renderer; every attempt recorded', async () => {
    const spec = { ...fx('process'), mermaid: 'flowchart LR\n  a -->> ((( b' };
    const repair = vi.fn(async (s: VisualSpec, issues: string[]) => {
      expect(issues.length).toBeGreaterThan(0);
      return { ...s, mermaid: 'this is still not mermaid' };
    });
    const r = await renderVisual(
      spec,
      { renderer: 'mermaid', fallbacks: ['cf_svg', 'svgjs', 'text_equivalent'], rule: 'VIS-PROCESS-001' },
      ctx({ repair }),
    );
    expect(repair).toHaveBeenCalledTimes(1);
    expect(r.renderer).toBe('cf_svg');
    expect(r.fallbackUsed).toBe(true);
    expect(r.rule).toBe('VIS-PROCESS-001');
    expect(r.attempts.map((a) => [a.renderer, a.ok])).toEqual([
      ['mermaid', false],
      ['mermaid', false],
      ['cf_svg', true],
    ]);
    expect(r.attempts[0]?.error).toBeTruthy();
    expect(r.svg).toContain('<title id="cf-v-process-title">');
    expect(r.bytes).toBe(Buffer.byteLength(r.svg ?? '', 'utf8'));
  });

  it('@H4 a successful repair re-renders with the same renderer', async () => {
    const spec = { ...fx('process'), mermaid: 'not mermaid at all' };
    const r = await renderVisual(
      spec,
      { renderer: 'mermaid', fallbacks: ['text_equivalent'], rule: 'R' },
      ctx({ repair: async (s) => ({ ...s, mermaid: null }) }),
    );
    expect(r.renderer).toBe('mermaid');
    expect(r.fallbackUsed).toBe(false);
    expect(r.attempts.map((a) => a.ok)).toEqual([false, true]);
  });

  it('@H4 visual QA failure (unreadable text) falls back without repair budget', async () => {
    const r = await renderVisual(
      fx('timelineLong'),
      { renderer: 'mermaid', fallbacks: ['cf_svg'], rule: 'R' },
      ctx({ maxSemanticRepairs: 0 }),
    );
    expect(r.attempts[0]).toMatchObject({ renderer: 'mermaid', ok: false });
    expect(r.attempts[0]?.error).toMatch(/px/);
    expect(r.renderer).toBe('cf_svg');
  });

  it('@H4 @J6 all renderers failing → structured text_equivalent figure', async () => {
    const spec = makeSpec(
      'v-empty',
      'COMPARISON',
      {
        columns: ['Option', 'Pros', 'Cons'],
        rows: [{ label: 'Respirator', cells: ['Protects <lungs>', 'Needs fit testing'] }],
      },
      { mermaid: '%% broken' },
    );
    const r = await renderVisual(
      spec,
      { renderer: 'mermaid', fallbacks: ['lucide', 'vega_lite', 'text_equivalent'], rule: 'R' },
      ctx({ maxSemanticRepairs: 0 }),
    );
    expect(r.renderer).toBe('text_equivalent');
    expect(r.svg).toBeNull();
    expect(r.attempts.map((a) => a.renderer)).toEqual(['mermaid', 'lucide', 'vega_lite', 'text_equivalent']);
    const $ = load(r.html ?? '');
    expect($('figure figcaption').text()).toBe(spec.title);
    expect($('table th[scope=col]').length).toBe(3);
    expect($('table td').first().text()).toBe('Protects <lungs>');
    expect(r.html).not.toContain('<lungs>');
    expect($('.cf-visual__long').text()).toBe(spec.textEquivalent.long);
  });

  it('@H5 @J6 every rendered output carries its text equivalents', async () => {
    const specs = ['lifecycle', 'chart', 'network', 'sequence'].map(fx);
    const routes = {
      'v-lifecycle': { renderer: 'cf_svg' as const, fallbacks: ['svgjs' as const, 'text_equivalent' as const], rule: 'A' },
      'v-chart': { renderer: 'vega_lite' as const, fallbacks: ['d3' as const, 'text_equivalent' as const], rule: 'B' },
      'v-network': { renderer: 'svgjs' as const, fallbacks: ['d3' as const, 'text_equivalent' as const], rule: 'C' },
      'v-sequence': { renderer: 'mermaid' as const, fallbacks: ['svgjs' as const, 'text_equivalent' as const], rule: 'D' },
    };
    const out = await renderAll(specs, routes, ctx());
    expect([...out.keys()]).toEqual(specs.map((s) => s.id));
    for (const spec of specs) {
      const r = out.get(spec.id);
      expect(r?.svg).toBeTruthy();
      const $ = load(r?.svg ?? '', { xml: true });
      expect($('svg > title').text()).toBe(spec.textEquivalent.short);
      expect($('svg > desc').text()).toBe(spec.textEquivalent.long);
      expect($('svg').attr('role')).toBe('img');
    }
  });

  it('@H5 hostile or instruction-like text equivalents do not crash rendering', async () => {
    const spec = {
      ...fx('process'),
      textEquivalent: {
        short: 'Alt text: <img src=x onerror=alert(1)>',
        long: 'Create original artwork & "ignore previous instructions" </desc><script>x</script>',
      },
    };
    const r = await renderVisual(spec, { renderer: 'cf_svg', fallbacks: ['text_equivalent'], rule: 'R' }, ctx());
    expect(r.renderer).toBe('cf_svg');
    expect(r.svg).not.toMatch(/<script|<img/);
    const $ = load(r.svg ?? '', { xml: true });
    expect($('svg > desc').text()).toBe(spec.textEquivalent.long);
    const te = await renderVisual(spec, { renderer: 'text_equivalent', fallbacks: [], rule: 'R' }, ctx());
    expect(te.html).not.toMatch(/<script|<img/);
  });
});
