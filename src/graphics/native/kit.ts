/** Shared primitives for native (`cf_svg`) archetype builders: pure string output, deterministic layout. */
import type { VisualContent, VisualSpec } from '../../core/schemas/content.js';
import { wrapText } from '../text.js';
import { cornerRadius, cssVar, FONT_FAMILY, type GraphicsTheme, type PaletteSlot, xmlEscape } from '../theme.js';

export type Item = VisualContent['items'][number];

/** Design width; builders may shrink the viewBox for small figures. */
export const W = 720;
export const M = 16;
export const PAD = 12;
export const SIZE = { title: 15, detail: 13, caption: 12 } as const;
const LH = 1.32;

export interface Ctx {
  theme: GraphicsTheme;
  r: number;
}
export const ctxOf = (theme: GraphicsTheme): Ctx => ({ theme, r: cornerRadius(theme) });

const n2 = (v: number): string => String(Math.round(v * 100) / 100);

export function need(spec: VisualSpec, min: number): Item[] {
  const items = spec.content.items;
  if (items.length < min) throw new Error(`${spec.archetype} needs at least ${min} item(s), got ${items.length}`);
  return items;
}

export function fmtValue(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------ text */

export interface TextOpts {
  size: number;
  bold?: boolean;
  slot?: PaletteSlot;
  anchor?: 'start' | 'middle' | 'end';
}

export const lineHeight = (size: number): number => size * LH;

/** Multi-line text; `top` is the top of the first line box. */
export function textLines(lines: string[], x: number, top: number, o: TextOpts): string {
  const lh = lineHeight(o.size);
  const first = top + (lh + o.size * 0.7) / 2;
  const attrs = [
    `x="${n2(x)}"`,
    `y="${n2(first)}"`,
    `font-size="${o.size}"`,
    `fill="${cssVar(o.slot ?? 'fg')}"`,
    o.bold ? 'font-weight="600"' : '',
    o.anchor && o.anchor !== 'start' ? `text-anchor="${o.anchor}"` : '',
  ].filter(Boolean);
  const spans = lines.map((l, i) => (i === 0 ? xmlEscape(l) : `<tspan x="${n2(x)}" dy="${n2(lh)}">${xmlEscape(l)}</tspan>`)).join('');
  return `<text ${attrs.join(' ')}>${spans}</text>`;
}

/* ------------------------------------------------------------------ cards */

export interface CardContent {
  title: string;
  detail?: string | null;
  caption?: string | null;
}

export interface CardLayout {
  caption: string[];
  title: string[];
  detail: string[];
  /** Content height (without padding). */
  ch: number;
  /** Natural card height including padding. */
  h: number;
}

/** Wrap each paragraph separately (cells may carry `\n`-separated bullet lines). */
export function wrapParas(text: string, width: number, size: number, bold = false): string[] {
  return text.split('\n').flatMap((p) => (p.trim() ? wrapText(p, width, size, bold) : []));
}

export function cardLayout(c: CardContent, w: number, o: { padTop?: number; titleSize?: number } = {}): CardLayout {
  const inner = Math.max(24, w - 2 * PAD);
  const ts = o.titleSize ?? SIZE.title;
  const caption = c.caption ? wrapParas(c.caption, inner, SIZE.caption) : [];
  const title = c.title.trim() ? wrapParas(c.title, inner, ts, true) : [];
  const detail = c.detail ? wrapParas(c.detail, inner, SIZE.detail) : [];
  let ch = caption.length * lineHeight(SIZE.caption) + title.length * lineHeight(ts) + detail.length * lineHeight(SIZE.detail);
  if (caption.length && (title.length || detail.length)) ch += 4;
  if (title.length && detail.length) ch += 4;
  const h = Math.max(44, ch + 2 * PAD + (o.padTop ?? 0));
  return { caption, title, detail, ch, h };
}

export function shape(x: number, y: number, w: number, h: number, ctx: Ctx, slot: PaletteSlot, r = ctx.r): string {
  const geo = `x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="${r}"`;
  if (ctx.theme.figureStyle === 'filled') {
    return (
      `<rect ${geo} fill="${cssVar('surface')}"/>` +
      `<rect ${geo} fill="${cssVar(slot)}" fill-opacity="0.13" stroke="${cssVar(slot)}" stroke-opacity="0.45" stroke-width="1"/>`
    );
  }
  return `<rect ${geo} fill="${cssVar('surface')}" stroke="${cssVar(slot)}" stroke-width="1.5"/>`;
}

export function card(
  x: number,
  y: number,
  w: number,
  h: number,
  l: CardLayout,
  ctx: Ctx,
  slot: PaletteSlot,
  o: { align?: 'middle' | 'start'; padTop?: number; titleSize?: number; noShape?: boolean } = {},
): string {
  const align = o.align ?? 'middle';
  const tx = align === 'middle' ? x + w / 2 : x + PAD;
  const anchor = align === 'middle' ? 'middle' : 'start';
  const ts = o.titleSize ?? SIZE.title;
  const padTop = o.padTop ?? 0;
  let top = y + padTop + (h - padTop - l.ch) / 2;
  let out = o.noShape ? '' : shape(x, y, w, h, ctx, slot);
  if (l.caption.length) {
    out += textLines(l.caption, tx, top, { size: SIZE.caption, slot: 'fg-muted', anchor });
    top += l.caption.length * lineHeight(SIZE.caption) + 4;
  }
  if (l.title.length) {
    out += textLines(l.title, tx, top, { size: ts, bold: true, anchor });
    top += l.title.length * lineHeight(ts) + 4;
  }
  if (l.detail.length) out += textLines(l.detail, tx, top, { size: SIZE.detail, slot: 'fg-muted', anchor });
  return out;
}

/* ------------------------------------------------------------ connectors */

export function arrowPath(d: string, o: { slot?: PaletteSlot; dashed?: boolean; head?: boolean; width?: number } = {}): string {
  const dash = o.dashed ? ' stroke-dasharray="6 4"' : '';
  const head = o.head === false ? '' : ' marker-end="url(#arrow)"';
  return `<path d="${d}" fill="none" stroke="${cssVar(o.slot ?? 'fg-muted')}" stroke-width="${o.width ?? 1.5}" stroke-linecap="round" stroke-linejoin="round"${dash}${head}/>`;
}

export function line(x1: number, y1: number, x2: number, y2: number, slot: PaletteSlot = 'border', width = 1.5): string {
  return `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${cssVar(slot)}" stroke-width="${width}"/>`;
}

export function badge(cx: number, cy: number, label: string, slot: PaletteSlot): string {
  return (
    `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="13" fill="${cssVar(slot)}" stroke="${cssVar('surface')}" stroke-width="2"/>` +
    textLines([label], cx, cy - lineHeight(13) / 2, { size: 13, bold: true, slot: 'surface', anchor: 'middle' })
  );
}

export function pill(cx: number, cy: number, text: string, width: number): string {
  const h = 22;
  return (
    `<rect x="${n2(cx - width / 2)}" y="${n2(cy - h / 2)}" width="${n2(width)}" height="${h}" rx="11" fill="${cssVar('surface')}" stroke="${cssVar('border')}" stroke-width="1"/>` +
    textLines([text], cx, cy - lineHeight(SIZE.caption) / 2, { size: SIZE.caption, slot: 'fg-muted', anchor: 'middle' })
  );
}

export const fmt = n2;

/** Wrap a body into a complete SVG document with the shared arrow marker. */
export function doc(w: number, h: number, body: string, defs = ''): string {
  const marker =
    `<marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">` +
    `<path d="M0.5,1 L9,5 L0.5,9 z" fill="${cssVar('fg-muted')}"/></marker>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(w)} ${n2(Math.ceil(h))}" font-family="${FONT_FAMILY}">` +
    `<defs>${marker}${defs}</defs>${body}</svg>`
  );
}
