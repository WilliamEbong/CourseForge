/** Static and in-browser quality checks for post-processed SVG. */
import { load } from 'cheerio';
import type { GraphicsBrowser } from './browser.js';

export interface QualityIssue {
  kind: 'xml' | 'structure' | 'a11y' | 'unsafe' | 'ids' | 'clip' | 'font' | 'overlap';
  message: string;
}

/** Tag-balance well-formedness check (cheerio's parser is lenient, so do it ourselves). */
function xmlBalanceError(svg: string): string | null {
  const src = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const between = src.slice(last, m.index);
    if (between.includes('<')) return `Malformed markup near "${between.slice(between.indexOf('<'), between.indexOf('<') + 30)}"`;
    if (/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/.test(between)) return 'Unescaped "&" in text';
    last = re.lastIndex;
    const [, close, name, , selfClose] = m;
    if (selfClose) continue;
    if (close) {
      if (stack.pop() !== name) return `Mismatched closing tag </${name}>`;
    } else stack.push(name as string);
  }
  if (src.slice(last).includes('<')) return 'Trailing malformed markup';
  return stack.length ? `Unclosed <${stack[stack.length - 1]}>` : null;
}

export function checkSvgStatic(svg: string, visualId?: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const xmlErr = xmlBalanceError(svg);
  if (xmlErr) issues.push({ kind: 'xml', message: xmlErr });
  const $ = load(svg, { xml: true });
  const root = $.root().children().first();
  if (String(root.prop('tagName')).toLowerCase() !== 'svg') {
    issues.push({ kind: 'structure', message: 'Root element is not <svg>' });
    return issues;
  }
  if (!/^\s*-?[\d.]+(\s+|,)-?[\d.]+(\s+|,)[\d.]+(\s+|,)[\d.]+\s*$/.test(root.attr('viewBox') ?? '')) {
    issues.push({ kind: 'structure', message: 'Missing or invalid viewBox' });
  }
  if (root.attr('width') || root.attr('height')) issues.push({ kind: 'structure', message: 'Fixed width/height present' });
  if (root.attr('role') !== 'img') issues.push({ kind: 'a11y', message: 'Root lacks role="img"' });
  const title = root.children('title');
  const desc = root.children('desc');
  if (!title.length || !title.text().trim() || !title.attr('id'))
    issues.push({ kind: 'a11y', message: 'Missing <title id> text equivalent' });
  if (!desc.length || !desc.text().trim() || !desc.attr('id'))
    issues.push({ kind: 'a11y', message: 'Missing <desc id> long text equivalent' });
  if (title.attr('id') && !(root.attr('aria-labelledby') ?? '').split(/\s+/).includes(title.attr('id') as string)) {
    issues.push({ kind: 'a11y', message: 'aria-labelledby does not reference <title>' });
  }
  if ($('script').length) issues.push({ kind: 'unsafe', message: 'Contains <script>' });
  if ($('foreignObject, foreignobject').length) issues.push({ kind: 'unsafe', message: 'Contains <foreignObject>' });
  const seen = new Set<string>();
  const prefix = visualId ? null : 'cf-';
  for (const el of $('svg, svg *').toArray()) {
    for (const [name, value] of Object.entries(el.attribs)) {
      if (/^on/i.test(name)) issues.push({ kind: 'unsafe', message: `Event handler attribute ${name}` });
      if (/href$/i.test(name) && !value.startsWith('#')) issues.push({ kind: 'unsafe', message: `External reference ${name}="${value}"` });
    }
    const id = el.attribs.id;
    if (id === undefined) continue;
    if (seen.has(id)) issues.push({ kind: 'ids', message: `Duplicate id "${id}"` });
    seen.add(id);
    const want =
      prefix ??
      `cf-${(visualId as string)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')}-`;
    if (!id.startsWith(want)) issues.push({ kind: 'ids', message: `Id "${id}" is not prefixed with ${want}` });
  }
  return issues;
}

const BROWSER_CHECK = `({ svg, widths, minFont }) => {
  const issues = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  try {
    for (const w of widths) {
      host.style.cssText = 'width:' + w + 'px;position:absolute;left:0;top:0';
      host.innerHTML = svg;
      const el = host.querySelector('svg');
      if (!el) { issues.push({ kind: 'structure', message: 'SVG did not parse in the browser' }); break; }
      const box = el.getBoundingClientRect();
      const vb = el.viewBox.baseVal;
      const scale = vb && vb.width ? box.width / vb.width : 1;
      const texts = [...el.querySelectorAll('text')].filter((t) => t.textContent.trim() && t.getClientRects().length);
      const rects = new Map(texts.map((t) => [t, t.getBoundingClientRect()]));
      const label = (t) => JSON.stringify(t.textContent.trim().slice(0, 40));
      for (const t of texts) {
        const r = rects.get(t);
        if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) {
          issues.push({ kind: 'clip', message: '@' + w + 'px text ' + label(t) + ' extends outside the viewBox' });
        }
        if (w === widths[0]) {
          const px = parseFloat(getComputedStyle(t).fontSize) * scale;
          if (px < minFont - 0.25) issues.push({ kind: 'font', message: '@' + w + 'px text ' + label(t) + ' renders at ' + px.toFixed(1) + 'px (< ' + minFont + 'px)' });
        }
      }
      const byParent = new Map();
      for (const t of texts) { const k = t.parentNode; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(t); }
      if (w === widths[0]) for (const sibs of byParent.values()) {
        for (let i = 0; i < sibs.length; i++) for (let j = i + 1; j < sibs.length; j++) {
          const a = rects.get(sibs[i]), b = rects.get(sibs[j]);
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 2 && oy > 2 && ox * oy > 0.15 * Math.min(a.width * a.height, b.width * b.height)) {
            issues.push({ kind: 'overlap', message: '@' + w + 'px texts ' + label(sibs[i]) + ' and ' + label(sibs[j]) + ' overlap' });
          }
        }
      }
    }
  } finally { host.remove(); }
  return issues;
}`;

/** Render at 720px and 375px containers: clipping, min font size (at 720px), sibling text overlap. */
export async function checkSvgInBrowser(browser: GraphicsBrowser, svg: string, opts: { minFontPx?: number } = {}): Promise<QualityIssue[]> {
  return browser.call<QualityIssue[]>(BROWSER_CHECK, { svg, widths: [720, 375], minFont: opts.minFontPx ?? 11 });
}
