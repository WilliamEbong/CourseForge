import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { iconSvg } from '../../../src/graphics/lucide.js';
import { renderNative } from '../../../src/graphics/native/index.js';
import { idPrefix, parseColor, postprocessSvg, rewritePalette, UnsafeSvgError } from '../../../src/graphics/postprocess.js';
import { checkSvgStatic } from '../../../src/graphics/quality.js';
import { FIXTURES } from '../../fixtures/visuals/index.js';

const opts = (visualId: string) => ({ visualId, title: 'Short text', desc: 'Long description of the figure.' });

const RAW = `<?xml version="1.0"?><!-- comment --><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="m1" width="400" height="200" onload="alert(1)">
  <style>#m1 .node rect{fill:#1f6feb;stroke:hsl(0, 0%, 100%)} #m1 .x{marker-end:url(#arrow)} @keyframes dash{to{stroke-dashoffset:0}}</style>
  <defs><marker id="arrow"><path d="M0,0 L10,5 z" fill="#000"/></marker><linearGradient id="g"><stop stop-color="#0f8a6c"/></linearGradient></defs>
  <script>alert(2)</script>
  <g aria-labelledby="lbl"><text id="lbl" onclick="x()">Label</text></g>
  <path d="M0 0" marker-end="url(#arrow)" fill="url(#g)" stroke="rgba(31, 41, 55, 0.5)"/>
  <use href="#arrow"/><use xlink:href="https://evil.example/x.svg#a"/>
  <a href="javascript:alert(3)"><text>link</text></a>
  <image href="https://evil.example/i.png"/>
</svg>`;

describe('postprocessSvg', () => {
  const out = postprocessSvg(RAW, opts('Vis 1'));
  const $ = load(out, { xml: true });

  it('prefixes every id and rewrites all references', () => {
    const p = idPrefix('Vis 1');
    expect(p).toBe('cf-vis-1-');
    const ids = $('[id]')
      .toArray()
      .map((e) => e.attribs.id);
    expect(ids.every((id) => id?.startsWith(p))).toBe(true);
    expect(out).toContain(`marker-end="url(#${p}arrow)"`);
    expect(out).toContain(`fill="url(#${p}g)"`);
    expect(out).toContain(`href="#${p}arrow"`);
    expect(out).toContain(`aria-labelledby="${p}lbl"`);
    expect(out).toContain(`#${p}m1 .node rect{`);
    expect(out).toContain(`marker-end:url(#${p}arrow)`);
    expect(out).toContain('@keyframes dash');
  });

  it('strips scripts, handlers, external references and javascript: links', () => {
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/\son\w+=/i);
    expect(out).not.toContain('evil.example');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('<a ');
    expect(out).toContain('>link<');
    expect(out).not.toContain('<!--');
  });

  it('adds role, title and desc and keeps viewBox-only sizing', () => {
    const root = $('svg').first();
    expect(root.attr('role')).toBe('img');
    expect(root.children().first().prop('tagName')?.toLowerCase()).toBe('title');
    expect(root.children('title').text()).toBe('Short text');
    expect(root.children('desc').text()).toBe('Long description of the figure.');
    expect(root.attr('aria-labelledby')).toBe('cf-vis-1-title');
    expect(root.attr('aria-describedby')).toBe('cf-vis-1-desc');
    expect(root.attr('viewBox')).toBe('0 0 400 200');
    expect(root.attr('width')).toBeUndefined();
    expect(root.attr('height')).toBeUndefined();
    expect(checkSvgStatic(out, 'Vis 1')).toEqual([]);
  });

  it('rewrites palette literals to CSS variables with hex fallbacks', () => {
    expect(out).toContain('fill:var(--cf-viz-1, #1f6feb)');
    expect(out).toContain('stroke:var(--cf-surface, #ffffff)');
    expect(out).toContain('stop-color="var(--cf-viz-2, #0f8a6c)"');
    expect(out).toContain('color-mix(in srgb, var(--cf-fg, #1f2937) 50%, transparent)');
    expect(out).toMatch(/<path d="M0,0 L10,5 z" fill="var\(--cf-fg, #1f2937\)"/);
    expect(rewritePalette('fill:var(--cf-viz-3, #c2610c)')).toBe('fill:var(--cf-viz-3, #c2610c)');
    expect(rewritePalette('#fefefe')).toBe('var(--cf-surface, #ffffff)');
    expect(parseColor('hsl(120, 100%, 25%)')?.slice(0, 3).map(Math.round)).toEqual([0, 128, 0]);
  });

  it('is deterministic and idempotent on ids', () => {
    expect(postprocessSvg(RAW, opts('Vis 1'))).toBe(out);
    const twice = postprocessSvg(out, opts('Vis 1'));
    expect(twice).not.toContain('cf-vis-1-cf-vis-1-');
  });

  it('rejects foreignObject and SVG without size information', () => {
    expect(() => postprocessSvg('<svg viewBox="0 0 1 1"><foreignObject><div/></foreignObject></svg>', opts('a'))).toThrow(UnsafeSvgError);
    expect(() => postprocessSvg('<svg><rect/></svg>', opts('a'))).toThrow(UnsafeSvgError);
    expect(() => postprocessSvg('<div/>', opts('a'))).toThrow(UnsafeSvgError);
  });

  it('two visuals inlined together have zero duplicate ids', () => {
    const a = FIXTURES.process;
    const b = FIXTURES.continuum;
    if (!a || !b) throw new Error('fixtures');
    const svgA = postprocessSvg(renderNative(a, { figureStyle: 'line' }), opts(a.id));
    const svgB = postprocessSvg(renderNative(b, { figureStyle: 'line' }), opts(b.id));
    const svgA2 = postprocessSvg(renderNative(a, { figureStyle: 'line' }), opts('another'));
    const page = load(`<div>${svgA}${svgB}${svgA2}</div>`, { xml: true });
    const ids = page('[id]')
      .toArray()
      .map((e) => e.attribs.id);
    expect(ids.length).toBeGreaterThan(6);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lucide icons are currentColor, decorative by default, labelled on request', () => {
    const icon = iconSvg('circle-check');
    expect(icon).toContain('stroke="currentColor"');
    expect(icon).toContain('aria-hidden="true"');
    expect(iconSvg('circle-check', { label: 'Done', size: 16 })).toMatch(/role="img" aria-label="Done"/);
    expect(() => iconSvg('../etc/passwd')).toThrow();
    expect(() => iconSvg('not-a-real-icon-name')).toThrow();
  });
});
