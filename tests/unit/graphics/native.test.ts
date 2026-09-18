import { describe, expect, it } from 'vitest';
import { NATIVE_ARCHETYPES, renderNative } from '../../../src/graphics/native/index.js';
import { postprocessSvg } from '../../../src/graphics/postprocess.js';
import { checkSvgStatic } from '../../../src/graphics/quality.js';
import { wrapText } from '../../../src/graphics/text.js';
import { FIXTURES, items, makeSpec } from '../../fixtures/visuals/index.js';

const nativeFixtures = Object.entries(FIXTURES).filter(([, s]) => NATIVE_ARCHETYPES.includes(s.archetype));

describe('native cf_svg builders @H2', () => {
  it('covers the required archetypes', () => {
    for (const a of [
      'PROCESS',
      'LIFECYCLE',
      'COMPARISON',
      'BEFORE_AFTER',
      'HIERARCHY',
      'LAYERED_SYSTEM',
      'RESPONSIBILITY_MAP',
      'FEEDBACK_LOOP',
      'CONTINUUM',
      'MATRIX',
      'FUNNEL',
      'EVIDENCE_MAP',
      'SCENARIO_MAP',
      'TIMELINE',
    ] as const) {
      expect(NATIVE_ARCHETYPES).toContain(a);
      expect(nativeFixtures.some(([, s]) => s.archetype === a)).toBe(true);
    }
  });

  for (const [name, spec] of nativeFixtures) {
    for (const figureStyle of ['line', 'filled'] as const) {
      it(`${name} (${figureStyle}) renders valid, deterministic, themeable SVG`, () => {
        const a = renderNative(spec, { figureStyle });
        const b = renderNative(spec, { figureStyle });
        expect(a).toBe(b);
        expect(a).toMatch(/^<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/);
        expect(/^<svg[^>]*>/.exec(a)?.[0]).not.toMatch(/\s(width|height)=/);
        expect(a).toContain('var(--cf-');
        const viewW = Number(/viewBox="0 0 ([\d.]+)/.exec(a)?.[1]);
        expect(viewW).toBeLessThanOrEqual(720);
        const svg = postprocessSvg(a, { visualId: spec.id, title: spec.textEquivalent.short, desc: spec.textEquivalent.long });
        expect(checkSvgStatic(svg, spec.id)).toEqual([]);
        for (const it of spec.content.items.slice(0, 3)) {
          const firstWord = it.label.split(' ')[0] as string;
          expect(a).toContain(firstWord.replace(/&/g, '&amp;'));
        }
      });
    }
  }

  it('figureStyle changes the styling', () => {
    const spec = FIXTURES.process;
    if (!spec) throw new Error('fixture');
    const line = renderNative(spec, { figureStyle: 'line' });
    const filled = renderNative(spec, { figureStyle: 'filled' });
    expect(line).not.toBe(filled);
    expect(filled).toContain('fill-opacity');
    expect(renderNative(spec, { figureStyle: 'line', corner: 'sharp' })).toContain('rx="0"');
  });

  it('wraps long labels onto multiple lines instead of overflowing', () => {
    const long = 'Establish a written emergency procedure that covers spills, fires, exposure incidents and evacuation routes';
    expect(wrapText(long, 150, 15, true).length).toBeGreaterThan(2);
    expect(wrapText('Supercalifragilisticexpialidocious', 80, 15).every((l) => l.length > 0)).toBe(true);
    const svg = renderNative(makeSpec('long', 'PROCESS', { items: items(['a', long], ['b', 'Short']) }), { figureStyle: 'line' });
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('escapes hostile label text', () => {
    const svg = renderNative(makeSpec('h', 'PROCESS', { items: items(['a', '<script>alert(1)</script> & "x"']) }), { figureStyle: 'line' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('throws for unsupported archetypes or empty content (triggers fallback)', () => {
    expect(() => renderNative(makeSpec('q', 'QUANTITATIVE_CHART', { items: items(['a', 'A']) }), { figureStyle: 'line' })).toThrow();
    expect(() => renderNative(makeSpec('e', 'PROCESS', {}), { figureStyle: 'line' })).toThrow();
  });
});
