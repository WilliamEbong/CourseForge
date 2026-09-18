/** Tabular / banded archetypes: comparison, before–after, matrix, layered system, responsibility map. */
import type { VisualSpec } from '../../core/schemas/content.js';
import { textWidth, wrapText } from '../text.js';
import { cssVar, type PaletteSlot, vizSlot } from '../theme.js';
import {
  arrowPath,
  type CardContent,
  type CardLayout,
  type Ctx,
  card,
  cardLayout,
  doc,
  fmt,
  type Item,
  lineHeight,
  M,
  PAD,
  SIZE,
  shape,
  textLines,
  W,
  wrapParas,
} from './kit.js';

interface Table {
  corner: string;
  headers: string[];
  rows: { label: string; cells: string[] }[];
}

/** Normalise columns/rows (or groups → bullet columns) into a header + body table. */
function toTable(spec: VisualSpec): Table {
  const { columns, rows, groups, items } = spec.content;
  if (rows.length) {
    const n = Math.max(...rows.map((r) => r.cells.length), columns.length > 0 ? 1 : 0);
    const shifted = columns.length === n + 1;
    const headers = (shifted ? columns.slice(1) : columns.slice(0, n)).concat();
    while (headers.length < n) headers.push('');
    return { corner: shifted ? (columns[0] ?? '') : '', headers, rows: rows.map((r) => ({ label: r.label, cells: r.cells })) };
  }
  if (groups.length) {
    const cells = groups.map((g) =>
      items
        .filter((it) => it.group === g.id)
        .map((it) => `• ${it.label}${it.detail ? ` — ${it.detail}` : ''}`)
        .join('\n'),
    );
    return { corner: '', headers: groups.map((g) => g.label), rows: [{ label: '', cells }] };
  }
  throw new Error(`${spec.archetype} needs rows or groups`);
}

/* -------------------------------------------------------------- COMPARISON */

export function comparison(spec: VisualSpec, ctx: Ctx): string {
  const t = toTable(spec);
  const n = t.headers.length;
  if (n < 1) throw new Error('COMPARISON needs at least one column');
  const hasLabels = t.rows.some((r) => r.label.trim()) || Boolean(t.corner);
  const labelW = hasLabels ? (n >= 4 ? 128 : 160) : 0;
  const colW = (W - 2 * M - labelW) / n;
  const inner = colW - 2 * PAD;
  const headLines = t.headers.map((h) => wrapText(h, inner, SIZE.title, true));
  const headH = Math.max(...headLines.map((l) => l.length)) * lineHeight(SIZE.title) + 2 * PAD + 4;
  let y = M;
  let body = '';
  // Header cells
  if (t.corner)
    body += textLines(wrapText(t.corner, labelW - PAD, SIZE.caption, true), M + 4, y + PAD + 4, {
      size: SIZE.caption,
      bold: true,
      slot: 'fg-muted',
    });
  t.headers.forEach((_, j) => {
    const x = M + labelW + j * colW;
    const slot = vizSlot(j);
    if (ctx.theme.figureStyle === 'filled') body += shape(x + 3, y, colW - 6, headH, ctx, slot);
    else body += `<rect x="${fmt(x + 3)}" y="${fmt(y + headH - 3)}" width="${fmt(colW - 6)}" height="3" rx="1.5" fill="${cssVar(slot)}"/>`;
    body += textLines(headLines[j] ?? [], x + PAD, y + PAD + 2, { size: SIZE.title, bold: true });
  });
  y += headH + 6;
  const tableTop = y;
  t.rows.forEach((row, i) => {
    const cellLines = t.headers.map((_, j) => wrapParas(row.cells[j] ?? '', inner, 14));
    const labelLines = hasLabels ? wrapParas(row.label, labelW - PAD - 4, 14, true) : [];
    const lines = Math.max(labelLines.length, ...cellLines.map((l) => l.length), 1);
    const h = lines * lineHeight(14) + 2 * PAD;
    if (i % 2 === 0) body += `<rect x="${M}" y="${fmt(y)}" width="${W - 2 * M}" height="${fmt(h)}" fill="${cssVar('surface-2')}"/>`;
    if (labelLines.length) body += textLines(labelLines, M + 8, y + PAD, { size: 14, bold: true });
    cellLines.forEach((cl, j) => {
      body += textLines(cl, M + labelW + j * colW + PAD, y + PAD, { size: 14 });
    });
    y += h;
    body += `<line x1="${M}" y1="${fmt(y)}" x2="${W - M}" y2="${fmt(y)}" stroke="${cssVar('border')}" stroke-width="1"/>`;
  });
  body += `<line x1="${M}" y1="${fmt(tableTop)}" x2="${W - M}" y2="${fmt(tableTop)}" stroke="${cssVar('fg-muted')}" stroke-width="1.5"/>`;
  return doc(W, y + M, body);
}

/* ------------------------------------------------------------ BEFORE_AFTER */

export function beforeAfter(spec: VisualSpec, ctx: Ctx): string {
  const { rows, groups, items, columns } = spec.content;
  let pairs: { caption: string; before: CardContent; after: CardContent }[];
  if (rows.length) {
    pairs = rows.map((r) => ({ caption: r.label, before: { title: r.cells[0] ?? '' }, after: { title: r.cells[1] ?? '' } }));
  } else if (groups.length >= 2) {
    const side = (gid: string | undefined) => items.filter((it) => it.group === gid);
    const b = side(groups[0]?.id);
    const a = side(groups[1]?.id);
    pairs = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => ({
      caption: '',
      before: { title: b[i]?.label ?? '', detail: b[i]?.detail },
      after: { title: a[i]?.label ?? '', detail: a[i]?.detail },
    }));
  } else throw new Error('BEFORE_AFTER needs rows or two groups');
  const heads = [columns[0] ?? groups[0]?.label ?? 'Before', columns[1] ?? groups[1]?.label ?? 'After'];
  const gap = 56;
  const pw = (W - 2 * M - gap) / 2;
  const slots: PaletteSlot[] = ['viz-6', 'viz-2'];
  let y = M;
  let body = '';
  heads.forEach((h, k) => {
    const x = M + k * (pw + gap);
    body += `<rect x="${fmt(x)}" y="${y}" width="${fmt(pw)}" height="36" rx="${ctx.r}" fill="${cssVar(slots[k] as PaletteSlot)}"/>`;
    body += textLines(wrapText(h, pw - 24, SIZE.title, true).slice(0, 1), x + pw / 2, y + 8, {
      size: SIZE.title,
      bold: true,
      slot: 'surface',
      anchor: 'middle',
    });
  });
  y += 36 + 12;
  for (const p of pairs) {
    if (p.caption.trim()) {
      const cl = wrapText(p.caption, W - 2 * M, SIZE.caption, true);
      body += textLines(cl, M + 2, y, { size: SIZE.caption, bold: true, slot: 'fg-muted' });
      y += cl.length * lineHeight(SIZE.caption) + 4;
    }
    const lb = cardLayout(p.before, pw, {});
    const la = cardLayout(p.after, pw, {});
    const h = Math.max(lb.h, la.h);
    body += card(M, y, pw, h, lb, ctx, 'viz-6', { align: 'start' });
    body += card(M + pw + gap, y, pw, h, la, ctx, 'viz-2', { align: 'start' });
    body += arrowPath(`M${fmt(M + pw + 12)},${fmt(y + h / 2)} H${fmt(M + pw + gap - 12)}`, { width: 2 });
    y += h + 10;
  }
  return doc(W, y - 10 + M, body);
}

/* ------------------------------------------------------------------ MATRIX */

export function matrix(spec: VisualSpec, ctx: Ctx): string {
  const { rows, columns, items, axes } = spec.content;
  let grid: CardContent[][];
  let rowHeads: string[];
  let colHeads: string[];
  if (rows.length) {
    const n = Math.max(...rows.map((r) => r.cells.length));
    grid = rows.map((r) => Array.from({ length: n }, (_, j) => ({ title: r.cells[j] ?? '' })));
    rowHeads = rows.map((r) => r.label);
    colHeads = columns.length === n + 1 ? columns.slice(1) : columns.slice(0, n);
  } else if (items.length >= 1 && items.length <= 4) {
    const q = (i: number): CardContent => ({ title: items[i]?.label ?? '', detail: items[i]?.detail });
    grid = [
      [q(0), q(1)],
      [q(2), q(3)],
    ];
    rowHeads = [];
    colHeads = columns.slice(0, 2);
  } else throw new Error('MATRIX needs rows or 1–4 items');
  const nr = grid.length;
  const nc = grid[0]?.length ?? 0;
  if (nc === 0) throw new Error('MATRIX has no cells');
  const quad = nr === 2 && nc === 2;
  const yAxisW = axes.y ? 28 : 0;
  const headW = rowHeads.some((h) => h.trim()) ? 132 : 0;
  const gap = 8;
  const x0 = M + yAxisW + headW;
  const cw = (W - M - x0 - (nc - 1) * gap) / nc;
  let y = M;
  let body = '';
  if (colHeads.some((h) => h.trim())) {
    const hl = colHeads.map((h) => wrapText(h, cw - 8, SIZE.title, true));
    const hh = Math.max(...hl.map((l) => l.length)) * lineHeight(SIZE.title);
    hl.forEach((l, j) => {
      body += textLines(l, x0 + j * (cw + gap) + cw / 2, y, { size: SIZE.title, bold: true, anchor: 'middle' });
    });
    y += hh + 10;
  }
  const gridTop = y;
  grid.forEach((row, i) => {
    const ls = row.map((c) => cardLayout(c, cw));
    const hl = headW ? wrapText(rowHeads[i] ?? '', headW - 16, SIZE.title, true) : [];
    const h = Math.max(quad ? 96 : 56, ...ls.map((l) => l.h), hl.length * lineHeight(SIZE.title) + 2 * PAD);
    if (hl.length)
      body += textLines(hl, x0 - 14, y + (h - hl.length * lineHeight(SIZE.title)) / 2, { size: SIZE.title, bold: true, anchor: 'end' });
    ls.forEach((l, j) => {
      body += card(x0 + j * (cw + gap), y, cw, h, l as CardLayout, ctx, quad ? vizSlot(i * 2 + j) : 'viz-1');
    });
    y += h + gap;
  });
  const gridBottom = y - gap;
  if (axes.y) {
    const cy = (gridTop + gridBottom) / 2;
    const ax = M + 10;
    body += arrowPath(`M${fmt(ax)},${fmt(gridBottom)} V${fmt(gridTop + 2)}`, { width: 1.5 });
    const label = wrapText(axes.y, gridBottom - gridTop - 24, SIZE.detail, true)[0] ?? '';
    const w = textWidth(label, SIZE.detail, true) + 8;
    body += `<rect x="${fmt(ax - 9)}" y="${fmt(cy - w / 2)}" width="18" height="${fmt(w)}" fill="${cssVar('surface')}"/>`;
    body += `<text x="${fmt(ax)}" y="${fmt(cy)}" font-size="${SIZE.detail}" font-weight="600" fill="${cssVar('fg-muted')}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${fmt(ax)} ${fmt(cy)})">${escapeText(label)}</text>`;
  }
  if (axes.x) {
    const ay = gridBottom + 16;
    body += arrowPath(`M${fmt(x0)},${fmt(ay)} H${fmt(W - M - 2)}`, { width: 1.5 });
    const lines = wrapText(axes.x, W - M - x0 - 40, SIZE.detail, true);
    body += textLines(lines, (x0 + W - M) / 2, ay + 8, { size: SIZE.detail, bold: true, slot: 'fg-muted', anchor: 'middle' });
    y = ay + 8 + lines.length * lineHeight(SIZE.detail) + gap;
  }
  return doc(W, y - gap + M, body);
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ----------------------------------------------------------- LAYERED_SYSTEM */

interface Chip {
  x: number;
  y: number;
  w: number;
  lines: string[];
}

/** Flow-wrap chips into `width`; returns chip boxes relative to (0,0) and the total height. */
function flowChips(labels: string[], width: number): { chips: Chip[]; h: number } {
  const chips: Chip[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const label of labels) {
    const lines = wrapText(label, width - 24, SIZE.detail);
    const w = Math.min(width, Math.max(...lines.map((l) => textWidth(l, SIZE.detail))) + 24);
    const h = lines.length * lineHeight(SIZE.detail) + 12;
    if (x > 0 && x + w > width) {
      x = 0;
      y += rowH + 8;
      rowH = 0;
    }
    chips.push({ x, y, w, lines });
    x += w + 8;
    rowH = Math.max(rowH, h);
  }
  return { chips, h: y + rowH };
}

export function layeredSystem(spec: VisualSpec, ctx: Ctx): string {
  const { groups, items } = spec.content;
  const layers: { title: string; detail: string | null; chips: string[] }[] = groups.length
    ? groups.map((g) => ({ title: g.label, detail: null, chips: items.filter((it) => it.group === g.id).map((it) => it.label) }))
    : items.map((it) => ({ title: it.label, detail: it.detail, chips: [] }));
  if (!layers.length) throw new Error('LAYERED_SYSTEM needs groups or items');
  const headW = 188;
  const areaX = M + headW + 8;
  const areaW = W - M - areaX - PAD;
  let y = M;
  let body = '';
  layers.forEach((layer, i) => {
    const slot = vizSlot(i);
    const head = cardLayout({ title: layer.title }, headW, {});
    const detailLines = layer.detail ? wrapParas(layer.detail, areaW, 14) : [];
    const flow = flowChips(layer.chips, areaW);
    const contentH = layer.chips.length ? flow.h : detailLines.length * lineHeight(14);
    const h = Math.max(head.h, contentH + 2 * 14, 56);
    body += shape(M, y, W - 2 * M, h, ctx, slot);
    body += card(M, y, headW, h, head, ctx, slot, { align: 'start', noShape: true });
    body += `<line x1="${areaX - 4}" y1="${fmt(y + 10)}" x2="${areaX - 4}" y2="${fmt(y + h - 10)}" stroke="${cssVar(slot)}" stroke-opacity="0.5" stroke-width="1"/>`;
    const top = y + (h - contentH) / 2;
    if (layer.chips.length) {
      for (const c of flow.chips) {
        const ch = c.lines.length * lineHeight(SIZE.detail) + 12;
        body += `<rect x="${fmt(areaX + PAD + c.x)}" y="${fmt(top + c.y)}" width="${fmt(c.w)}" height="${fmt(ch)}" rx="${Math.min(ctx.r, 8) || 0}" fill="${cssVar('surface')}" stroke="${cssVar(slot)}" stroke-width="1"/>`;
        body += textLines(c.lines, areaX + PAD + c.x + c.w / 2, top + c.y + 6, { size: SIZE.detail, anchor: 'middle' });
      }
    } else if (detailLines.length) {
      body += textLines(detailLines, areaX + PAD, top, { size: 14, slot: 'fg' });
    }
    y += h + 8;
  });
  return doc(W, y - 8 + M, body);
}

/* ------------------------------------------------------- RESPONSIBILITY_MAP */

export function responsibilityMap(spec: VisualSpec, ctx: Ctx): string {
  const { groups, items } = spec.content;
  if (!groups.length) throw new Error('RESPONSIBILITY_MAP needs groups (actors)');
  const lanes: { label: string; items: Item[] }[] = groups.map((g) => ({ label: g.label, items: items.filter((it) => it.group === g.id) }));
  const loose = items.filter((it) => !groups.some((g) => g.id === it.group));
  if (loose.length) lanes.push({ label: 'Shared', items: loose });
  const headW = 150;
  const areaX = M + headW + 12;
  const areaW = W - M - areaX - 10;
  const cardW = 164;
  const cols = Math.max(1, Math.floor((areaW + 10) / (cardW + 10)));
  const cw = (areaW - (cols - 1) * 10) / cols;
  let y = M;
  let body = '';
  lanes.forEach((lane, i) => {
    const slot = vizSlot(i);
    const ls = lane.items.map((it) => cardLayout({ title: it.label, detail: it.detail }, cw));
    const rowsN = Math.max(1, Math.ceil(ls.length / cols));
    const rowH: number[] = Array.from({ length: rowsN }, (_, r) => Math.max(44, ...ls.slice(r * cols, r * cols + cols).map((l) => l.h)));
    const head = cardLayout({ title: lane.label }, headW);
    const h = Math.max(head.h + 12, rowH.reduce((a, b) => a + b, 0) + (rowsN - 1) * 10 + 20);
    body += `<rect x="${M}" y="${fmt(y)}" width="${W - 2 * M}" height="${fmt(h)}" rx="${ctx.r}" fill="${cssVar(i % 2 ? 'surface' : 'surface-2')}" stroke="${cssVar('border')}" stroke-width="1"/>`;
    body += card(M + 6, y + 6, headW, h - 12, head, ctx, slot);
    let ry = y + 10;
    rowH.forEach((rh, r) => {
      ls.slice(r * cols, r * cols + cols).forEach((l, c) => {
        body += card(areaX + c * (cw + 10), ry, cw, rh, l, ctx, slot, { align: 'start' });
      });
      ry += rh + 10;
    });
    y += h + 8;
  });
  return doc(W, y - 8 + M, body);
}
