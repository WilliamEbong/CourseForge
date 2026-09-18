import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { renderCourse } from '../../../src/renderer/index.js';
import { loadSmoke } from './smoke.js';

const b64 = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

describe('renderCourse(smoke)', () => {
  const { model, visuals } = loadSmoke();

  it('@G1 @G2 @G4 @H6 builds a single self-contained file whose checks all pass', async () => {
    const { html, report } = await renderCourse(model, { visuals, mode: 'release' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(report.checks.filter((c) => !c.pass)).toEqual([]);
    expect(report.checks.map((c) => c.id)).toEqual([
      'single-file',
      'ids-rendered',
      'no-runtime-deps',
      'size-budget',
      'text-equivalents',
      'no-drag-only',
    ]);
    expect(report.counts).toMatchObject({ modules: 3, screens: model.screens.length, graded: 3, visuals: 3, glossary: 3, references: 3 });
    expect(report.contrast.every((c) => c.pass)).toBe(true);
    expect(report.icons.length).toBeGreaterThan(5);
    expect(html).toContain('Lucide');
    const $ = cheerio.load(html);
    expect($('script[src], link[rel="stylesheet"]')).toHaveLength(0);
    expect(
      $('figure[data-cf-visual]')
        .map((_, e) => $(e).attr('data-cf-renderer'))
        .get(),
    ).toEqual(['cf_svg', 'cf_svg', 'vega_lite']);
  });

  it('@H6 CSP hashes match the exact inline style and script blocks', async () => {
    const { html } = await renderCourse(model, { visuals, mode: 'release' });
    const $ = cheerio.load(html);
    const csp = $('meta[http-equiv="Content-Security-Policy"]').attr('content') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    const runtime = $('script:not([type])').text();
    expect(csp).toContain(`script-src ${b64(runtime)}`);
    $('style').each((_, el) => {
      expect(csp).toContain(b64($(el).text()));
    });
  });

  it('@G1 is deterministic: identical input gives byte-identical HTML', async () => {
    const a = await renderCourse(model, { visuals, mode: 'release' });
    const b = await renderCourse(structuredClone(model), { visuals: new Map(visuals), mode: 'release' });
    expect(createHash('sha256').update(a.html).digest('hex')).toBe(createHash('sha256').update(b.html).digest('hex'));
    expect(a.report.outputHash).toBe(b.report.outputHash);
  });

  it('stays within budgets (release total, JS, CSS)', async () => {
    const { report } = await renderCourse(model, { visuals, mode: 'release' });
    expect(report.bytes).toBeLessThan(1.5 * 1024 * 1024);
    expect(report.sizeBreakdown.js).toBeLessThan(40 * 1024);
    expect(report.sizeBreakdown.css).toBeLessThan(48 * 1024);
    const sum = Object.values(report.sizeBreakdown).reduce((a, b) => a + b, 0);
    expect(sum).toBe(report.bytes);
  });

  it('@H4 falls back to a structured text equivalent when a visual has no SVG', async () => {
    const partial = new Map(visuals);
    partial.set('V-03', { svg: '', renderer: 'text_equivalent', fallbackUsed: true });
    partial.delete('V-02');
    const { html, report } = await renderCourse(model, { visuals: partial, mode: 'dev' });
    const $ = cheerio.load(html);
    expect($('figure[data-cf-visual="V-03"]').attr('data-cf-renderer')).toBe('text_equivalent');
    expect($('figure[data-cf-visual="V-02"] table')).toHaveLength(1);
    expect(report.checks.every((c) => c.pass)).toBe(true);
  });

  it('rejects an invalid model with a typed error', async () => {
    await expect(renderCourse({ ...model, screens: [] }, { visuals, mode: 'release' })).rejects.toThrow(/Course model is invalid/);
  });
});
