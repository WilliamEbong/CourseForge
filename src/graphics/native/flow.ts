/** Sequential archetypes: process band, lifecycle / feedback loop, timeline, continuum, funnel. */
import type { VisualSpec } from '../../core/schemas/content.js';
import { textWidth, wrapText } from '../text.js';
import { cssVar, type PaletteSlot, vizSlot } from '../theme.js';
import {
  arrowPath,
  badge,
  type CardLayout,
  type Ctx,
  card,
  cardLayout,
  doc,
  fmt,
  fmtValue,
  line,
  lineHeight,
  M,
  need,
  PAD,
  pill,
  SIZE,
  textLines,
  W,
} from './kit.js';

/* ---------------------------------------------------------------- PROCESS */

export function processBand(spec: VisualSpec, ctx: Ctx): string {
  const items = need(spec, 1);
  const n = items.length;
  const perRow = n <= 4 ? n : n <= 6 ? 3 : 4;
  const gap = 36;
  const rowGap = 60;
  const badgeTop = 14;
  const cw = (W - 2 * M - (perRow - 1) * gap) / perRow;
  const layouts = items.map((it) => cardLayout({ title: it.label, detail: it.detail }, cw, { padTop: 10 }));
  const rows: number[][] = [];
  for (let i = 0; i < n; i += perRow) rows.push(items.slice(i, i + perRow).map((_, k) => i + k));
  let body = '';
  let y = M + badgeTop;
  rows.forEach((row, r) => {
    const rowH = Math.max(...row.map((i) => (layouts[i] as CardLayout).h));
    row.forEach((i, c) => {
      const x = M + c * (cw + gap);
      body += card(x, y, cw, rowH, layouts[i] as CardLayout, ctx, 'viz-1', { padTop: 10 });
      body += badge(x + cw / 2, y, String(i + 1), 'viz-1');
      if (c < row.length - 1) body += arrowPath(`M${fmt(x + cw + 5)},${fmt(y + rowH / 2)} H${fmt(x + cw + gap - 5)}`);
    });
    const nextRow = rows[r + 1];
    if (nextRow) {
      const lastX = M + (row.length - 1) * (cw + gap) + cw / 2;
      const midY = y + rowH + rowGap / 2;
      const nextY = y + rowH + rowGap;
      body += arrowPath(`M${fmt(lastX)},${fmt(y + rowH + 2)} V${fmt(midY)} H${fmt(M + cw / 2)} V${fmt(nextY - 16)}`);
    }
    y += rowH + (nextRow ? rowGap : 0);
  });
  return doc(W, y + M, body);
}

/* ------------------------------------------------------ LIFECYCLE / FEEDBACK */

function cycleDiagram(spec: VisualSpec, ctx: Ctx, withLinkLabels: boolean): string {
  const items = need(spec, 2);
  const n = items.length;
  let nodeW = n <= 4 ? 176 : n <= 6 ? 156 : n <= 8 ? 138 : 122;
  let layouts: CardLayout[] = [];
  let R = 0;
  let maxH = 0;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  // Grow the radius until adjacent cards clear each other; narrow cards if the ring would exceed W.
  for (;;) {
    layouts = items.map((it) => cardLayout({ title: it.label, detail: it.detail }, nodeW));
    maxH = Math.max(...layouts.map((l) => l.h));
    // A centre label needs clear space inside the ring.
    R = spec.content.groups[0] ? nodeW / 2 + 96 : n === 2 ? 70 : 110;
    const clash = (r: number) =>
      items.some((_, i) => {
        const j = (i + 1) % n;
        const dx = Math.abs(r * Math.cos(angle(i)) - r * Math.cos(angle(j)));
        const dy = Math.abs(r * Math.sin(angle(i)) - r * Math.sin(angle(j)));
        return dx < nodeW + 28 && dy < maxH + 28;
      });
    while (clash(R) && R < 600) R += 6;
    if (2 * R + nodeW + 2 * M <= W || nodeW <= 104) break;
    nodeW -= 8;
  }
  const width = Math.min(W, 2 * R + nodeW + 2 * M);
  const cx = width / 2;
  const cy = M + R + maxH / 2;
  const pos = items.map((_, i) => ({ x: cx + R * Math.cos(angle(i)), y: cy + R * Math.sin(angle(i)) }));
  const inside = (a: number, i: number, pad: number) => {
    const p = pos[i] as { x: number; y: number };
    const h = (layouts[i] as CardLayout).h;
    const px = cx + R * Math.cos(a);
    const py = cy + R * Math.sin(a);
    return Math.abs(px - p.x) < nodeW / 2 + pad && Math.abs(py - p.y) < h / 2 + pad;
  };
  const step = Math.PI / 360;
  let arcs = '';
  let labels = '';
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let a0 = angle(i);
    while (inside(a0, i, 6)) a0 += step;
    let a1 = angle(i) + (2 * Math.PI) / n;
    while (inside(a1, j, 9)) a1 -= step;
    if (a1 <= a0) continue;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0 = `${fmt(cx + R * Math.cos(a0))},${fmt(cy + R * Math.sin(a0))}`;
    const p1 = `${fmt(cx + R * Math.cos(a1))},${fmt(cy + R * Math.sin(a1))}`;
    arcs += arrowPath(`M${p0} A${fmt(R)},${fmt(R)} 0 ${large} 1 ${p1}`, { slot: 'fg-muted', width: 2 });
    if (withLinkLabels) {
      const from = items[i]?.id;
      const to = items[j]?.id;
      const text = spec.content.links.find((l) => l.from === from && l.to === to)?.label;
      if (text) {
        const am = (a0 + a1) / 2;
        const rr = R - 26;
        const tw = Math.min(textWidth(text, SIZE.caption) + 16, R);
        const clipped = wrapText(text, tw - 16, SIZE.caption)[0] ?? text;
        labels += pill(cx + rr * Math.cos(am), cy + rr * Math.sin(am), clipped, tw);
      }
    }
  }
  let body = arcs;
  items.forEach((_, i) => {
    const p = pos[i] as { x: number; y: number };
    const l = layouts[i] as CardLayout;
    body += card(p.x - nodeW / 2, p.y - l.h / 2, nodeW, l.h, l, ctx, vizSlot(i));
  });
  body += labels;
  const centre = spec.content.groups[0]?.label;
  if (centre) {
    const cl = wrapText(centre, Math.max(80, R * 0.9), 14, true);
    body += textLines(cl, cx, cy - (cl.length * lineHeight(14)) / 2, { size: 14, bold: true, slot: 'fg-muted', anchor: 'middle' });
  }
  return doc(width, cy + R + maxH / 2 + M, body);
}

export const lifecycle = (spec: VisualSpec, ctx: Ctx) => cycleDiagram(spec, ctx, false);
export const feedbackLoop = (spec: VisualSpec, ctx: Ctx) => cycleDiagram(spec, ctx, true);

/* ------------------------------------------------- tiered labels on an axis */

interface AxisPoint {
  x: number;
  layout: CardLayout;
  slot: PaletteSlot;
}

/** Place labels above/below a horizontal axis, pushing to outer tiers instead of overlapping. */
function axisFigure(points: AxisPoint[], labelW: number, ctx: Ctx, axis: (y: number) => string, belowOffset = 0): string {
  const tierRight: number[] = [];
  const tierH: number[] = [];
  const placed = points.map((p, i) => {
    const left = Math.min(Math.max(p.x - labelW / 2, M), W - M - labelW);
    const prefer = i % 2;
    let tier = prefer;
    for (let t = 0; ; t++) {
      const cand = t === 0 ? prefer : t === 1 ? 1 - prefer : t;
      if ((tierRight[cand] ?? Number.NEGATIVE_INFINITY) + 12 <= left) {
        tier = cand;
        break;
      }
    }
    tierRight[tier] = left + labelW;
    tierH[tier] = Math.max(tierH[tier] ?? 0, p.layout.h);
    return { ...p, left, tier };
  });
  const stem = 26;
  const tierGap = 12;
  const above = (t: number) => t % 2 === 0;
  let aboveTotal = 0;
  for (let t = 0; t < tierH.length; t += 2) aboveTotal += (tierH[t] ?? 0) + tierGap;
  const axisY = M + aboveTotal + stem - tierGap;
  const tierTop = (t: number): number => {
    let off = stem;
    for (let k = above(t) ? 0 : 1; k < t; k += 2) off += (tierH[k] ?? 0) + tierGap;
    return above(t) ? axisY - off - (tierH[t] ?? 0) : axisY + off + belowOffset;
  };
  let stems = '';
  let cards = '';
  let dots = '';
  let bottom = axisY + 10 + belowOffset;
  for (const p of placed) {
    const h = tierH[p.tier] ?? p.layout.h;
    const top = tierTop(p.tier);
    const edge = above(p.tier) ? top + h : top;
    stems += line(p.x, axisY, p.x, edge, 'border', 1.5);
    cards += card(p.left, top, labelW, h, p.layout, ctx, p.slot);
    dots += `<circle cx="${fmt(p.x)}" cy="${fmt(axisY)}" r="6" fill="${cssVar('surface')}" stroke="${cssVar(p.slot)}" stroke-width="3"/>`;
    bottom = Math.max(bottom, top + h);
  }
  return doc(W, bottom + M, stems + axis(axisY) + cards + dots);
}

/* --------------------------------------------------------------- TIMELINE */

export function timeline(spec: VisualSpec, ctx: Ctx): string {
  const items = need(spec, 1);
  const n = items.length;
  if (n <= 6) {
    const s = (W - 2 * M) / n;
    const labelW = n <= 2 ? Math.min(s - 16, 300) : Math.min(1.6 * s, 230);
    const pts = items.map((it, i) => ({
      x: M + s * (i + 0.5),
      layout: cardLayout({ title: it.label, detail: it.detail }, labelW),
      slot: 'viz-1' as PaletteSlot,
    }));
    return axisFigure(pts, labelW, ctx, (y) => arrowPath(`M${M},${fmt(y)} H${W - M - 2}`, { slot: 'border', width: 2.5 }));
  }
  // Vertical: date column | axis | detail card. Keeps many events readable on narrow screens.
  const hasDetail = items.some((it) => it.detail);
  const axisX = hasDetail ? M + 128 : M + 14;
  const cardX = axisX + 22;
  const cardW = W - M - cardX;
  let y = M;
  let body = '';
  const rowsSvg: string[] = [];
  for (const it of items) {
    const left = hasDetail ? wrapText(it.label, axisX - M - 18, SIZE.title, true) : [];
    const l = cardLayout(hasDetail ? { title: '', detail: it.detail ?? '' } : { title: it.label }, cardW);
    const h = Math.max(l.h, left.length * lineHeight(SIZE.title) + 2 * PAD);
    if (hasDetail) rowsSvg.push(textLines(left, axisX - 18, y + PAD, { size: SIZE.title, bold: true, anchor: 'end', slot: 'viz-1' }));
    rowsSvg.push(card(cardX, y, cardW, h, l, ctx, 'viz-1', { align: 'start' }));
    rowsSvg.push(
      `<circle cx="${fmt(axisX)}" cy="${fmt(y + PAD + lineHeight(SIZE.title) / 2)}" r="6" fill="${cssVar('surface')}" stroke="${cssVar('viz-1')}" stroke-width="3"/>`,
    );
    y += h + 12;
  }
  body = line(axisX, M, axisX, y - 12, 'border', 2.5) + rowsSvg.join('');
  return doc(W, y - 12 + M, body);
}

/* --------------------------------------------------------------- CONTINUUM */

export function continuum(spec: VisualSpec, ctx: Ctx): string {
  const items = need(spec, 1);
  const n = items.length;
  const labelW = Math.min(180, Math.max(120, (1.6 * (W - 2 * M)) / n));
  const values = items.map((it) => it.value);
  const numeric = values.every((v): v is number => typeof v === 'number');
  const span = W - 2 * M;
  let xs: number[];
  if (numeric && n > 1) {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    xs = values.map((v) => M + span * (0.08 + (0.84 * (v - lo)) / (hi - lo || 1)));
  } else {
    xs = items.map((_, i) => M + (span * (i + 0.5)) / n);
  }
  const order = items.map((_, i) => i).sort((a, b) => (xs[a] as number) - (xs[b] as number) || a - b);
  const pts = order.map((i) => ({
    x: xs[i] as number,
    layout: cardLayout({ title: items[i]?.label ?? '', detail: items[i]?.detail }, labelW),
    slot: 'viz-1' as PaletteSlot,
  }));
  const [leftEnd, rightEnd] = spec.content.columns;
  const hasEnds = Boolean(leftEnd || rightEnd);
  const grad =
    `<linearGradient id="scale" x1="0" x2="1" y1="0" y2="0">` +
    `<stop offset="0" stop-color="${cssVar('viz-1')}"/><stop offset="1" stop-color="${cssVar('viz-3')}"/></linearGradient>`;
  const svg = axisFigure(
    pts,
    labelW,
    ctx,
    (y) => {
      let s = `<rect x="${M}" y="${fmt(y - 4)}" width="${span}" height="8" rx="4" fill="url(#scale)"/>`;
      if (leftEnd) s += textLines([leftEnd], M, y + 10, { size: SIZE.detail, bold: true, slot: 'fg-muted' });
      if (rightEnd) s += textLines([rightEnd], W - M, y + 10, { size: SIZE.detail, bold: true, slot: 'fg-muted', anchor: 'end' });
      return s;
    },
    hasEnds ? 22 : 0,
  );
  return svg.replace('<defs>', `<defs>${grad}`);
}

/* ------------------------------------------------------------------ FUNNEL */

export function funnel(spec: VisualSpec, ctx: Ctx): string {
  const items = need(spec, 2);
  const n = items.length;
  const topW = W - 2 * M;
  const botW = Math.max(300, topW * 0.44);
  const widthAt = (k: number) => topW - ((topW - botW) * k) / n;
  let y = M;
  let body = '';
  items.forEach((it, i) => {
    const wTop = widthAt(i);
    const wBot = widthAt(i + 1);
    const title = it.value === null ? it.label : `${it.label} · ${fmtValue(it.value)}`;
    const l = cardLayout({ title, detail: it.detail }, wBot - 48);
    const h = Math.max(56, l.h);
    const cx = W / 2;
    const d = `M${fmt(cx - wTop / 2)},${fmt(y)} H${fmt(cx + wTop / 2)} L${fmt(cx + wBot / 2)},${fmt(y + h)} H${fmt(cx - wBot / 2)} Z`;
    const slot = vizSlot(i);
    body +=
      ctx.theme.figureStyle === 'filled'
        ? `<path d="${d}" fill="${cssVar('surface')}"/><path d="${d}" fill="${cssVar(slot)}" fill-opacity="0.16" stroke="${cssVar(slot)}" stroke-opacity="0.5" stroke-width="1" stroke-linejoin="round"/>`
        : `<path d="${d}" fill="${cssVar('surface')}" stroke="${cssVar(slot)}" stroke-width="1.5" stroke-linejoin="round"/>`;
    body += card(cx - (wBot - 24) / 2, y, wBot - 24, h, l, ctx, slot, { noShape: true });
    y += h + 5;
  });
  return doc(W, y - 5 + M, body);
}
