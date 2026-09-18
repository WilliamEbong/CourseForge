/**
 * Shared post-processing for every renderer's SVG: namespaced ids, sanitisation, accessibility,
 * viewBox-only sizing and palette → CSS custom properties. Output is deterministic.
 */
import { load } from 'cheerio';
import { PALETTE, PALETTE_SLOTS, type PaletteSlot, xmlEscape } from './theme.js';

export interface PostprocessOptions {
  visualId: string;
  /** Short text equivalent → `<title>`. */
  title: string;
  /** Long text equivalent → `<desc>`. */
  desc: string;
}

export class UnsafeSvgError extends Error {
  override name = 'UnsafeSvgError';
}

export const idPrefix = (visualId: string): string =>
  `cf-${
    visualId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'v'
  }-`;

/* ---------------------------------------------------------------- colours */

type Rgba = [number, number, number, number];

const hexRgb = (hex: string): Rgba => {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
};

function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function parseColor(text: string): Rgba | null {
  const t = text.trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/.test(t) && t.length !== 6) return hexRgb(t);
  const m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(t);
  if (!m) return null;
  const parts = (m[2] ?? '')
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((p) => p.trim());
  if (parts.length < 3) return null;
  const num = (p: string | undefined, scale: number) =>
    p?.endsWith('%') ? (Number.parseFloat(p) / 100) * scale : Number.parseFloat(p ?? '');
  const alpha = parts[3] === undefined ? 1 : num(parts[3], 1);
  if (m[1]?.startsWith('rgb')) return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha];
  const [r, g, b] = hslRgb(Number.parseFloat(parts[0] ?? '0'), num(parts[1], 1), num(parts[2], 1));
  return [r, g, b, alpha];
}

const SLOT_RGB = PALETTE_SLOTS.map((s) => [s, hexRgb(PALETTE[s])] as const);

export function nearestSlot(rgb: readonly number[]): PaletteSlot {
  let best: PaletteSlot = 'fg';
  let bestD = Number.POSITIVE_INFINITY;
  for (const [slot, c] of SLOT_RGB) {
    // Weighted RGB distance (approximates perceived difference cheaply).
    const d = 2 * ((rgb[0] ?? 0) - c[0]) ** 2 + 4 * ((rgb[1] ?? 0) - c[1]) ** 2 + 3 * ((rgb[2] ?? 0) - c[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = slot;
    }
  }
  return best;
}

const COLOR_RE = /var\(--cf-[\w-]+,[^()]*\)|#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|(?:rgba?|hsla?)\([^()]*\)/g;

/** Rewrite colour literals (hex/rgb/hsl) to `var(--cf-<nearest slot>, #hex)`; existing vars untouched. */
export function rewritePalette(text: string): string {
  return text.replace(COLOR_RE, (m) => {
    if (m.startsWith('var(')) return m;
    const c = parseColor(m);
    if (!c || !Number.isFinite(c[0])) return m;
    const slot = nearestSlot(c);
    const v = `var(--cf-${slot}, ${PALETTE[slot]})`;
    if (c[3] <= 0) return 'transparent';
    return c[3] < 1 ? `color-mix(in srgb, ${v} ${Math.round(c[3] * 100)}%, transparent)` : v;
  });
}

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000' };
const COLOR_ATTRS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']);

/* ------------------------------------------------------------------- main */

const DROP = ['script', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'foreignobject'];
const REF_LIST_ATTRS = new Set(['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto', 'for']);

export function postprocessSvg(input: string, opts: PostprocessOptions): string {
  const cleaned = input
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  const $ = load(cleaned, { xml: true });
  const root = $('svg').first();
  if (!root.length) throw new UnsafeSvgError('No <svg> root element');
  if ($('foreignObject, foreignobject').length) throw new UnsafeSvgError('SVG contains <foreignObject> (HTML labels)');

  const prefix = idPrefix(opts.visualId);

  // 1. Sanitise elements.
  for (const el of $('svg, svg *').toArray()) {
    if (DROP.includes(el.name.toLowerCase())) {
      $(el).remove();
      continue;
    }
    if (el.name === 'a') {
      $(el).replaceWith($(el).contents());
    }
  }
  for (const el of $('svg, svg *').toArray()) {
    for (const [name, value] of Object.entries(el.attribs)) {
      const lower = name.toLowerCase();
      if (lower.startsWith('on') || /javascript:/i.test(value)) {
        $(el).removeAttr(name);
        continue;
      }
      if ((lower === 'href' || lower === 'xlink:href') && !value.startsWith('#') && !/^data:image\/(png|jpeg|gif|webp);/i.test(value)) {
        if (el.name === 'image' || el.name === 'use') $(el).remove();
        else $(el).removeAttr(name);
      }
    }
  }

  // 2. Namespace ids and every reference to them.
  const ids = new Map<string, string>();
  const used = new Set<string>();
  $('[id]').each((_, el) => {
    const id = el.attribs.id ?? '';
    let next = id.startsWith(prefix) ? id : `${prefix}${id}`;
    for (let k = 2; used.has(next); k++) next = `${prefix}${id}-${k}`;
    used.add(next);
    if (!ids.has(id)) ids.set(id, next);
    $(el).attr('id', next);
  });
  const mapUrl = (v: string) =>
    v.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (m, _q, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : m));
  const safeUrl = (v: string) => v.replace(/url\(\s*(['"]?)(?!#)[^)]*\)/g, 'none');
  for (const el of $('svg, svg *').toArray()) {
    for (const [name, value] of Object.entries(el.attribs)) {
      const lower = name.toLowerCase();
      let next = value;
      if (lower === 'href' || lower === 'xlink:href') {
        const id = value.slice(1);
        if (value.startsWith('#') && ids.has(id)) next = `#${ids.get(id)}`;
      } else if (REF_LIST_ATTRS.has(lower)) {
        next = value
          .split(/\s+/)
          .filter(Boolean)
          .map((t) => ids.get(t) ?? t)
          .join(' ');
      } else if (value.includes('url(')) {
        next = safeUrl(mapUrl(value));
      }
      if (COLOR_ATTRS.has(lower) && NAMED[value.trim().toLowerCase()]) next = NAMED[value.trim().toLowerCase()] as string;
      if (COLOR_ATTRS.has(lower) || lower === 'style') next = rewritePalette(next);
      if (next !== value) $(el).attr(name, next);
    }
  }
  $('style').each((_, el) => {
    const css = $(el)
      .text()
      .replace(/@import[^;]*;/g, '');
    const out = css.replace(/([^{}]*)([{}])/g, (_m, text: string, brace: string) => {
      if (brace === '{') {
        return `${text.replace(/#([A-Za-z_][\w-]*)/g, (m, id: string) => (ids.has(id) ? `#${ids.get(id)}` : m))}{`;
      }
      return `${rewritePalette(safeUrl(mapUrl(text)))}}`;
    });
    $(el).text(out.replace(/\s+/g, ' ').trim());
  });

  // 3. Accessibility: role, title, desc.
  root.children('title, desc').remove();
  const titleId = `${prefix}title`;
  const descId = `${prefix}desc`;
  root.prepend(`<title id="${titleId}">${xmlEscape(opts.title)}</title><desc id="${descId}">${xmlEscape(opts.desc)}</desc>`);
  root.attr('role', 'img');
  root.attr('aria-labelledby', titleId);
  root.attr('aria-describedby', descId);
  root.removeAttr('aria-roledescription');

  // 4. viewBox-only sizing.
  let viewBox = root.attr('viewBox') ?? root.attr('viewbox');
  if (!viewBox) {
    const w = Number.parseFloat(root.attr('width') ?? '');
    const h = Number.parseFloat(root.attr('height') ?? '');
    if (!(w > 0 && h > 0)) throw new UnsafeSvgError('SVG has neither viewBox nor numeric width/height');
    viewBox = `0 0 ${w} ${h}`;
  }
  const vb = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || (vb[2] ?? 0) <= 0 || (vb[3] ?? 0) <= 0) {
    throw new UnsafeSvgError(`Invalid viewBox "${viewBox}"`);
  }
  root.removeAttr('viewbox');
  root.attr('viewBox', vb.join(' '));
  root.removeAttr('width');
  root.removeAttr('height');
  root.attr('style', `max-width:${vb[2]}px;width:100%;height:auto`);
  if (!root.attr('xmlns')) root.attr('xmlns', 'http://www.w3.org/2000/svg');

  return $.xml(root)
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex: string) => {
      // cheerio escapes all non-ASCII; keep only the XML-significant escapes.
      const cp = Number.parseInt(hex, 16);
      return cp >= 0x80 ? String.fromCodePoint(cp) : m;
    })
    .replace(/>\s+</g, '><')
    .replace(/[\t\r\n]+/g, ' ')
    .trim();
}
