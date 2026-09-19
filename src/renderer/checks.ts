/**
 * Pure post-build checks on the rendered HTML string (used by COURSE_BUILD validators and tests).
 * Each returns `{ id, pass, detail }`.
 */
import * as cheerio from 'cheerio';
import type { CourseModel } from '../core/schemas/model.js';

export interface CheckResult {
  id: string;
  pass: boolean;
  detail: string;
}

const result = (id: string, problems: string[], okDetail: string): CheckResult => ({
  id,
  pass: problems.length === 0,
  detail: problems.length ? problems.slice(0, 10).join('; ') + (problems.length > 10 ? ` (+${problems.length - 10} more)` : '') : okDetail,
});

/**
 * No external scripts, stylesheets, images, frames or CSS URLs; http(s) only in `<a href>`. The CSP must forbid
 * all connections, or (for a tracked course, ADR 0013) allow exactly `allowedConnect` and nothing else.
 */
export function checkSingleFile(html: string, allowedConnect: readonly string[] = []): CheckResult {
  const $ = cheerio.load(html);
  const problems: string[] = [];
  $('script[src]').each((_, el) => void problems.push(`script src=${$(el).attr('src')}`));
  $('link').each((_, el) => {
    const rel = ($(el).attr('rel') ?? '').toLowerCase();
    if (/stylesheet|preload|modulepreload|import|icon|manifest/.test(rel) || $(el).attr('href'))
      problems.push(`link rel=${rel} href=${$(el).attr('href') ?? ''}`);
  });
  $('[src]').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (!src.startsWith('data:')) problems.push(`<${el.tagName} src=${src}>`);
  });
  $('iframe, object, embed, frame').each((_, el) => void problems.push(`<${el.tagName}>`));
  $('[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/^(https?:)?\/\//i.test(href) && el.tagName !== 'a') problems.push(`<${el.tagName} href=${href}>`);
  });
  $('[xlink\\:href]').each((_, el) => {
    const href = $(el).attr('xlink:href') ?? '';
    if (!href.startsWith('#') && !href.startsWith('data:')) problems.push(`xlink:href=${href}`);
  });
  $('style').each((_, el) => {
    const css = $(el).text();
    if (/@import\b/i.test(css)) problems.push('@import in <style>');
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)/gi)) if (!/^(data:|#)/i.test(m[1]!)) problems.push(`css url(${m[1]})`);
  });
  $('[style]').each((_, el) => {
    for (const m of ($(el).attr('style') ?? '').matchAll(/url\(\s*['"]?([^'")]+)/gi))
      if (!/^(data:|#)/i.test(m[1]!)) problems.push(`style url(${m[1]})`);
  });
  const csp = $('meta[http-equiv="Content-Security-Policy"]').attr('content') ?? '';
  const directives = new Map(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map((d) => [d[0]!, d.slice(1).join(' ')]),
  );
  const expected = allowedConnect.length ? allowedConnect.join(' ') : "'none'";
  if (directives.get('default-src') !== "'none'" || directives.get('connect-src') !== expected)
    problems.push(`missing CSP meta with default-src 'none' and connect-src ${expected}`);
  return result(
    'single-file',
    problems,
    allowedConnect.length ? `no external resources; CSP allows only ${expected}` : 'no external resources; CSP present',
  );
}

/** Every screen id and interaction item id is present as a data-cf-* attribute. */
export function checkIdsRendered(html: string, model: CourseModel): CheckResult {
  const $ = cheerio.load(html);
  const screens = new Set(
    $('[data-cf-screen]')
      .map((_, el) => $(el).attr('data-cf-screen'))
      .get(),
  );
  const items = new Set(
    $('form[data-cf-item]')
      .map((_, el) => $(el).attr('data-cf-item'))
      .get(),
  );
  const problems: string[] = [];
  for (const s of model.screens) {
    if (!screens.has(s.id)) problems.push(`screen ${s.id} missing`);
    if (s.interaction && !items.has(s.id)) problems.push(`item ${s.id} missing`);
  }
  for (const v of new Set(model.screens.map((s) => s.visualId).filter((x): x is string => Boolean(x)))) {
    if ($(`figure[data-cf-visual="${v}"]`).length === 0) problems.push(`visual ${v} missing`);
  }
  return result('ids-rendered', problems, `${screens.size} screens, ${items.size} items`);
}

const RUNTIME_DEPS = [
  /\bmermaid\.(initialize|run|render|parse|contentLoaded)\b/,
  /\bmermaidAPI\b/,
  /\bvegaEmbed\b/,
  /\bvega\.(View|parse|loader)\b/,
  /\bvl\.compile\b/,
  /\bd3\.(select|selectAll|scale\w*|force\w*|zoom|drag)\b/,
  /\bSVG\(\)\.addTo\b/,
];

/** No Mermaid/Vega/D3/SVG.js runtime calls in the shipped HTML (visuals are precompiled). */
export function checkNoRuntimeDeps(html: string): CheckResult {
  const problems = RUNTIME_DEPS.filter((re) => re.test(html)).map((re) => `found ${re.source}`);
  return result('no-runtime-deps', problems, 'no diagram/chart runtime found');
}

export function checkSizeBudget(html: string, maxBytes = 1.5 * 1024 * 1024): CheckResult {
  const bytes = Buffer.byteLength(html, 'utf8');
  return result('size-budget', bytes > maxBytes ? [`${bytes} bytes > ${maxBytes}`] : [], `${bytes} bytes ≤ ${maxBytes}`);
}

const AUTHORING = /^(alt text|create original)/i;

/** Every `figure[data-cf-visual]` has a non-empty accessible description that is not an authoring note. */
export function checkTextEquivalents(html: string): CheckResult {
  const $ = cheerio.load(html);
  const problems: string[] = [];
  $('figure[data-cf-visual]').each((_, el) => {
    const fig = $(el);
    const id = fig.attr('data-cf-visual');
    const ids = (fig.attr('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const text = ids
      .map((d) => $(`[id="${d}"]`).text())
      .join(' ')
      .trim();
    if (!text) problems.push(`${id}: no description`);
    else if (AUTHORING.test(text)) problems.push(`${id}: description is an authoring instruction`);
    const label = (fig.attr('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((d) => $(`[id="${d}"]`).text())
      .join(' ')
      .trim();
    if (!label && !fig.attr('aria-label')) problems.push(`${id}: no accessible name`);
    fig.find('svg[role="img"]').each((_, svg) => {
      const s = $(svg);
      if (!s.attr('aria-label') && !s.attr('aria-labelledby') && s.children('title').length === 0) problems.push(`${id}: svg has no name`);
    });
  });
  return result('text-equivalents', problems, `${$('figure[data-cf-visual]').length} figures described`);
}

/** Drag must never be the only way to operate an interaction. */
export function checkNoDragOnly(html: string): CheckResult {
  const $ = cheerio.load(html);
  const problems: string[] = [];
  $('[draggable="true"], [ondragstart], [ondrop]').each((_, el) => {
    const form = $(el).closest('form.cf-question');
    if (!form.length || form.find('button[data-cf-move], select[data-cf-key]').length === 0)
      problems.push(`<${el.tagName}> drag without keyboard alternative`);
  });
  $('ol[data-cf-sequence] > li').each((_, el) => {
    const li = $(el);
    if (li.find('button[data-cf-move="up"]').length !== 1 || li.find('button[data-cf-move="down"]').length !== 1)
      problems.push(`sequence item ${li.attr('data-cf-key')} lacks move buttons`);
  });
  return result('no-drag-only', problems, 'all interactions keyboard operable');
}

export function runChecks(html: string, model: CourseModel, maxBytes?: number, allowedConnect: readonly string[] = []): CheckResult[] {
  return [
    checkSingleFile(html, allowedConnect),
    checkIdsRendered(html, model),
    checkNoRuntimeDeps(html),
    checkSizeBudget(html, maxBytes),
    checkTextEquivalents(html),
    checkNoDragOnly(html),
  ];
}
