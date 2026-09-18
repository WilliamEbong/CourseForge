import { afterAll, describe, expect, it } from 'vitest';
import type { Renderer } from '../../../src/core/enums.js';
import type { VisualSpec } from '../../../src/core/schemas/content.js';
import { GraphicsBrowser } from '../../../src/graphics/browser.js';
import { postprocessSvg } from '../../../src/graphics/postprocess.js';
import { checkSvgInBrowser, checkSvgStatic } from '../../../src/graphics/quality.js';
import { renderRaw } from '../../../src/graphics/render.js';
import { FIXTURES, HOSTILE } from '../../fixtures/visuals/index.js';

const browser = new GraphicsBrowser();
afterAll(() => browser.close());
const theme = { figureStyle: 'line' as const };

const fx = (k: string): VisualSpec => {
  const s = FIXTURES[k];
  if (!s) throw new Error(`fixture ${k}`);
  return s;
};

async function compile(renderer: Renderer, spec: VisualSpec): Promise<{ raw: string; svg: string }> {
  const raw = await renderRaw(renderer, spec, { browser, theme });
  const svg = postprocessSvg(raw, { visualId: spec.id, title: spec.textEquivalent.short, desc: spec.textEquivalent.long });
  expect(checkSvgStatic(svg, spec.id)).toEqual([]);
  expect(svg).not.toMatch(/<script|<foreignObject/i);
  return { raw, svg };
}

describe('renderers compile to inline SVG', () => {
  it('@H1 Mermaid flowchart/sequence/state compile with no script or foreignObject, deterministically', async () => {
    for (const k of ['process', 'decision', 'architecture', 'sequence', 'state']) {
      const spec = fx(k);
      const { raw, svg } = await compile('mermaid', spec);
      expect(raw).not.toContain('foreignObject');
      expect(svg).toContain('var(--cf-');
      expect(svg).toMatch(/<text/);
      if (k === 'process') {
        expect((await compile('mermaid', spec)).svg).toBe(svg);
        expect(await checkSvgInBrowser(browser, svg)).toEqual([]);
      }
    }
  });

  it('@H1 hostile labels render as inert text through Mermaid', async () => {
    const { svg } = await compile('mermaid', HOSTILE);
    expect(svg).toContain('＜script＞');
    expect(svg).not.toMatch(/<script/i);
  });

  it('@H1 invalid Mermaid source is rejected (drives fallback)', async () => {
    const bad = { ...fx('process'), mermaid: 'flowchart LR\n  a -->> ((( b' };
    await expect(renderRaw('mermaid', bad, { browser, theme })).rejects.toThrow();
    // The page stays usable after a failure.
    await compile('mermaid', fx('cause'));
  });

  it('@H2 native cf_svg and SVG.js visuals compile and pass browser QA', async () => {
    for (const k of ['process', 'comparison', 'hierarchy', 'matrix']) {
      const { svg } = await compile('cf_svg', fx(k));
      expect(await checkSvgInBrowser(browser, svg)).toEqual([]);
    }
    for (const k of ['labeled', 'network', 'decision', 'layered', 'comparison']) {
      const spec = fx(k);
      const first = await compile('svgjs', spec);
      expect((await compile('svgjs', spec)).svg).toBe(first.svg);
      expect(await checkSvgInBrowser(browser, first.svg)).toEqual([]);
    }
  });

  it('@H3 Vega-Lite chart compiles headless (no browser, no canvas)', async () => {
    for (const k of ['chart', 'chartSeries']) {
      const { raw, svg } = await compile('vega_lite', fx(k));
      expect(raw).toMatch(/^<svg/);
      expect(svg).toContain(k === 'chart' ? 'Skin' : '2021');
      expect(svg).toContain('var(--cf-viz-1');
    }
  });

  it('@H3 D3 chart and force network compile deterministically', async () => {
    const chart = await compile('d3', fx('chart'));
    expect(chart.svg).toContain('Inhalation');
    const net1 = await compile('d3', fx('network'));
    const net2 = await compile('d3', fx('network'));
    expect(net1.svg).toBe(net2.svg);
    expect(net1.svg).toContain('Safety data sheet');
  });

  it('measures text in the shared page (batched)', async () => {
    const [a, b] = await browser.measureText(['i', 'WWWW'], '15px sans-serif');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a as number);
  });
});
