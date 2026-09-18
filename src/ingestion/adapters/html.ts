import { load } from 'cheerio';
import type { Element } from 'domhandler';
import type { SourceFormat } from '../../core/enums.js';
import { normalizeNewlines } from '../../core/hash.js';
import type { DocHeading, DocTable, IngestAdapter, NormalizedDocument } from '../types.js';
import { scanIds, scanLinks } from '../util.js';

/** Index just past the value starting at `start` (`{`/`[`), skipping JS/JSON strings; -1 if unbalanced. */
export function scanBalanced(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Finds course data embedded in an HTML page: `const|let|var COURSE = {…}` / `window.COURSE = {…}` (bracket-balanced,
 * must be valid JSON) or the largest `<script type="application/json">` block.
 */
export function extractEmbeddedCourse(html: string): { value: unknown | null; via: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const m = /\b(?:(?:const|let|var)\s+COURSE|window\.COURSE)\s*=\s*/.exec(html);
  if (m) {
    const start = m.index + m[0].length;
    const end = /[{[]/.test(html[start] ?? '') ? scanBalanced(html, start) : -1;
    if (end > 0) {
      try {
        return { value: JSON.parse(html.slice(start, end)), via: 'const COURSE', warnings };
      } catch (err) {
        warnings.push(`Embedded COURSE literal is not valid JSON: ${(err as Error).message}`);
      }
    } else warnings.push('Embedded COURSE literal found but brackets are unbalanced');
  }
  const $ = load(html);
  let best: string | null = null;
  $('script[type="application/json"]').each((_, el) => {
    const t = $(el).text();
    if (!best || t.length > best.length) best = t;
  });
  if (best) {
    try {
      return { value: JSON.parse(best), via: 'application/json', warnings };
    } catch (err) {
      warnings.push(`JSON script block is not valid JSON: ${(err as Error).message}`);
    }
  }
  return { value: null, via: null, warnings };
}

const lineOf = (el: Element): number => el.sourceCodeLocation?.startLine ?? 0;
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

export function parseHtmlText(source: string, name: string, format: SourceFormat): NormalizedDocument {
  const html = normalizeNewlines(source).replace(/^﻿/, '');
  const embedded = extractEmbeddedCourse(html);
  const $ = load(html, { sourceCodeLocationInfo: true });
  const scripts = $('script');
  const scriptText = scripts.text();

  const headings: DocHeading[] = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    headings.push({ level: Number(el.name.slice(1)), text: clean($(el).text()), line: lineOf(el) });
  });
  const tables: DocTable[] = [];
  $('table').each((_, el) => {
    const rows = $(el)
      .find('tr')
      .toArray()
      .map((tr) =>
        $(tr)
          .children('th,td')
          .toArray()
          .map((c) => clean($(c).text())),
      );
    tables.push({ header: rows[0] ?? [], rows: rows.slice(1), line: lineOf(el) });
  });
  const links = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/^https?:\/\//i.test(href)) links.add(href);
  });

  const count = (sel: string) => $(sel).length;
  const dom: Record<string, number> = {
    sections: count('section,article,[role="region"]'),
    headings: headings.length,
    forms: count('form,fieldset'),
    inputs: count('input,select,textarea'),
    radios: count('input[type="radio"]'),
    checkboxes: count('input[type="checkbox"]'),
    selects: count('select'),
    buttons: count('button,[role="button"]'),
    dialogs: count('dialog,[role="dialog"]'),
    figures: count('figure,img,svg'),
    svgs: count('svg'),
    links: links.size,
    scripts: scripts.length,
  };
  const hints: string[] = [];
  if (embedded.value !== null) hints.push(`embedded-course-data:${embedded.via}`);
  if (dom.radios) hints.push('single-choice-inputs');
  if (dom.checkboxes) hints.push('multiple-response-inputs');
  if (dom.selects) hints.push('select-inputs');
  if (dom.dialogs) hints.push('dialogs');
  if (count('[draggable="true"]')) hints.push('drag-and-drop');
  if (/localStorage/.test(scriptText)) hints.push('progress-persistence');
  if (/addEventListener\(\s*['"](click|submit|change|keydown)/.test(scriptText)) hints.push('scripted-controls');

  $('script,style,noscript,template').remove();
  const bodyText = ($('body').length ? $('body').text() : $.root().text())
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  const title = clean($('title').first().text()) || headings[0]?.text || name;
  return {
    format,
    name,
    title,
    text: bodyText,
    headings,
    tables,
    ids: scanIds(bodyText),
    links: [...new Set([...links, ...scanLinks(bodyText)])],
    json: null,
    html: { embeddedCourse: embedded.value, scriptCount: scripts.length, interactionHints: hints, dom },
    rawHtml: html,
    warnings: embedded.warnings,
    lossy: false,
  };
}

export const htmlAdapter: IngestAdapter = {
  formats: ['html'],
  parse: async (bytes, name) => parseHtmlText(bytes.toString('utf8'), name, 'html'),
};
