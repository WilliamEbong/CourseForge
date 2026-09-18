/**
 * `svgjs` renderer: SVG.js runs inside the shared Chromium page so text is measured with real font
 * metrics. Layouts: generic card grid (any spec), LABELED_OBJECT callouts, RELATIONSHIP_NETWORK radial.
 */
import type { VisualSpec } from '../core/schemas/content.js';
import type { GraphicsBrowser } from './browser.js';
import { CORNER_RADIUS, FONT_FAMILY, FONT_STACK, type GraphicsTheme, PALETTE } from './theme.js';

// Plain JS evaluated in the page (kept as a string so no bundler helpers leak in).
const DRAW_FN = `({ spec, style, radius, palette, font, measureFont }) => {
  const W = 720, M = 16, PAD = 12;
  const C = (s) => 'var(--cf-' + s + ', ' + palette[s] + ')';
  const viz = (i) => 'viz-' + ((i % 6) + 1);
  const draw = SVG().addTo(document.body);
  draw.attr({ 'font-family': font });
  const probe = document.createElement('canvas').getContext('2d');
  const width = (t, size, bold) => { probe.font = (bold ? '600 ' : '') + size + 'px ' + measureFont; return probe.measureText(t).width; };
  const wrap = (text, maxW, size, bold) => {
    const out = []; let line = '';
    for (const word of String(text).replace(/\\s+/g, ' ').trim().split(' ')) {
      const cand = line ? line + ' ' + word : word;
      if (!line || width(cand, size, bold) <= maxW) line = cand; else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    return out;
  };
  const lh = (s) => s * 1.32;
  const edges = draw.group();
  const layer = draw.group();
  const text = (lines, x, top, size, o = {}) => {
    lines.forEach((l, i) => {
      const t = layer.plain(l).attr({ x, y: top + lh(size) * i + (lh(size) + size * 0.7) / 2, 'font-size': size,
        fill: C(o.slot || 'fg'), 'text-anchor': o.anchor || 'start' });
      if (o.bold) t.attr('font-weight', 600);
    });
  };
  const box = (x, y, w, h, slot, r = radius) => {
    if (style === 'filled') {
      layer.rect(w, h).move(x, y).radius(r).attr({ fill: C('surface') });
      layer.rect(w, h).move(x, y).radius(r).attr({ fill: C(slot), 'fill-opacity': 0.13, stroke: C(slot), 'stroke-opacity': 0.45, 'stroke-width': 1 });
    } else layer.rect(w, h).move(x, y).radius(r).attr({ fill: C('surface'), stroke: C(slot), 'stroke-width': 1.5 });
  };
  const measureCard = (it, w) => {
    const inner = w - 2 * PAD;
    const title = wrap(it.label, inner, 15, true);
    const value = it.value === null || it.value === undefined ? [] : [Number(it.value).toLocaleString('en-US')];
    const detail = it.detail ? String(it.detail).split('\\n').flatMap((p) => wrap(p, inner, 13, false)) : [];
    const ch = title.length * lh(15) + (value.length ? lh(20) + 2 : 0) + (detail.length ? detail.length * lh(13) + 4 : 0);
    return { title, value, detail, ch, h: Math.max(48, ch + 2 * PAD) };
  };
  const drawCard = (x, y, w, h, m, slot, align = 'start') => {
    box(x, y, w, h, slot);
    const tx = align === 'middle' ? x + w / 2 : x + PAD;
    let top = y + (h - m.ch) / 2;
    if (m.value.length) { text(m.value, tx, top, 20, { bold: true, slot, anchor: align }); top += lh(20) + 2; }
    text(m.title, tx, top, 15, { bold: true, anchor: align }); top += m.title.length * lh(15) + 4;
    if (m.detail.length) text(m.detail, tx, top, 13, { slot: 'fg-muted', anchor: align });
  };
  const arrow = draw.marker(10, 10, (add) => add.path('M0.5,1 L9,5 L0.5,9 z').attr({ fill: C('fg-muted') }));
  arrow.id('arrow').attr({ refX: 8.5, refY: 5, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse', markerWidth: 8, markerHeight: 8, viewBox: '0 0 10 10' });
  /** Point where the segment from rect centre towards (tx,ty) leaves the rect (plus gap). */
  const exitPoint = (r, tx, ty, gap) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = tx - cx, dy = ty - cy;
    const s = Math.min(Math.abs((r.w / 2 + gap) / (dx || 1e-9)), Math.abs((r.h / 2 + gap) / (dy || 1e-9)));
    return [cx + dx * s, cy + dy * s];
  };
  const connect = (a, b, label) => {
    const [x1, y1] = exitPoint(a, b.x + b.w / 2, b.y + b.h / 2, 2);
    const [x2, y2] = exitPoint(b, a.x + a.w / 2, a.y + a.h / 2, 4);
    edges.line(x1, y1, x2, y2).attr({ stroke: C('fg-muted'), 'stroke-width': 1.5, 'marker-end': 'url(#arrow)' });
    return [(x1 + x2) / 2, (y1 + y2) / 2];
  };
  const tags = [];
  const tag = (cx, cy, label) => {
    const lines = wrap(label, 120, 12, false).slice(0, 2);
    const w = Math.max(...lines.map((l) => width(l, 12, false))) + 14, h = lines.length * lh(12) + 6;
    // Nudge down until clear of previously placed tags (bidirectional edges share a midpoint).
    for (let k = 0; k < 6 && tags.some((t) => Math.abs(t[0] - cx) < (t[2] + w) / 2 + 4 && Math.abs(t[1] - cy) < (t[3] + h) / 2 + 2); k++) cy += h + 4;
    tags.push([cx, cy, w, h]);
    layer.rect(w, h).move(cx - w / 2, cy - h / 2).radius(h / 2 > 11 ? 8 : h / 2).attr({ fill: C('surface'), stroke: C('border'), 'stroke-width': 1 });
    text(lines, cx, cy - h / 2 + 3, 12, { slot: 'fg-muted', anchor: 'middle' });
  };

  const c = spec.content;
  let items = c.items;
  if (!items.length && c.rows.length) {
    const heads = c.columns.length === Math.max(...c.rows.map((r) => r.cells.length)) + 1 ? c.columns.slice(1) : c.columns;
    items = c.rows.map((r, i) => ({ id: 'r' + i, label: r.label || r.cells[0] || '', group: null, value: null,
      detail: r.cells.map((cell, j) => (heads[j] ? heads[j] + ': ' : '') + cell).join('\\n') }));
  }
  if (!items.length) throw new Error('svgjs: spec has no items or rows');
  const ORDERED = ['PROCESS', 'LIFECYCLE', 'TIMELINE', 'SEQUENCE', 'FUNNEL', 'CAUSE_EFFECT', 'FEEDBACK_LOOP'];
  if (ORDERED.includes(spec.archetype) && !c.links.length) items = items.map((it, i) => ({ ...it, label: i + 1 + '. ' + it.label }));
  function layered(list, links) {
    if (list.length > 16) return null;
    const ids = new Set(list.map((it) => it.id));
    const out = new Map(list.map((it) => [it.id, []]));
    const indeg = new Map(list.map((it) => [it.id, 0]));
    for (const l of links) if (ids.has(l.from) && ids.has(l.to)) { out.get(l.from).push(l.to); indeg.set(l.to, indeg.get(l.to) + 1); }
    let frontier = list.filter((it) => indeg.get(it.id) === 0).map((it) => it.id);
    if (!frontier.length) frontier = [list[0].id];
    const depth = new Map(frontier.map((id) => [id, 0]));
    for (let q = [...frontier]; q.length; ) {
      const id = q.shift();
      for (const to of out.get(id)) if (!depth.has(to)) { depth.set(to, depth.get(id) + 1); q.push(to); }
    }
    const max = Math.max(...depth.values());
    const levels = Array.from({ length: max + 2 }, () => []);
    for (const it of list) levels[depth.has(it.id) ? depth.get(it.id) : max + 1].push(it);
    const rows = levels.filter((r) => r.length);
    return rows.some((r) => r.length > 4) ? null : rows;
  }
  const rects = new Map();
  let H = 0, vw = W;

  if (spec.archetype === 'LABELED_OBJECT' && items.length >= 2) {
    const [obj, ...parts] = items;
    const cw = 190, ow = 236, gap = (W - 2 * M - 2 * cw - ow) / 2;
    const cols = [parts.filter((_, i) => i % 2 === 0), parts.filter((_, i) => i % 2 === 1)];
    const ms = cols.map((col) => col.map((it) => measureCard(it, cw)));
    const colH = ms.map((col) => col.reduce((a, m) => a + m.h, 0) + Math.max(0, col.length - 1) * 16);
    const om = measureCard(obj, ow - 24);
    const oh = Math.max(160, om.h + 40, ...colH);
    const ox = M + cw + gap, oy = M;
    const leaders = [];
    cols.forEach((col, k) => {
      let y = oy + (oh - colH[k]) / 2;
      col.forEach((it, i) => {
        const m = ms[k][i], x = k === 0 ? M : W - M - cw;
        drawCard(x, y, cw, m.h, m, viz(i * 2 + k + 1));
        const cy = y + m.h / 2, ex = k === 0 ? ox : ox + ow;
        leaders.push([k === 0 ? x + cw : x, cy, ex, Math.min(Math.max(cy, oy + 12), oy + oh - 12)]);
        y += m.h + 16;
      });
    });
    const shape = layer.rect(ow, oh).move(ox, oy).radius(Math.max(radius, 10)).attr({ fill: C('surface-2'), stroke: C('fg-muted'), 'stroke-width': 2 });
    shape.back();
    const otop = oy + (oh - om.ch) / 2;
    text(om.title, ox + ow / 2, otop, 15, { bold: true, anchor: 'middle' });
    if (om.detail.length) text(om.detail, ox + ow / 2, otop + om.title.length * lh(15) + 4, 13, { slot: 'fg-muted', anchor: 'middle' });
    for (const [x1, y1, x2, y2] of leaders) {
      edges.polyline([[x1, y1], [(x1 + x2) / 2, y1], [(x1 + x2) / 2, y2], [x2, y2]]).attr({ fill: 'none', stroke: C('fg-muted'), 'stroke-width': 1.5 });
      edges.circle(8).center(x2, y2).attr({ fill: C('fg-muted') });
    }
    edges.front();
    H = oy + oh + M;
  } else if (spec.archetype === 'RELATIONSHIP_NETWORK' && c.links.length) {
    const deg = new Map(items.map((it) => [it.id, 0]));
    for (const l of c.links) { deg.set(l.from, (deg.get(l.from) || 0) + 1); deg.set(l.to, (deg.get(l.to) || 0) + 1); }
    const hub = items.reduce((b, it) => (deg.get(it.id) > deg.get(b.id) ? it : b), items[0]);
    const ring = items.filter((it) => it !== hub);
    const size = (it) => { const lines = wrap(it.label, 150, 14, true); return { lines, w: Math.max(...lines.map((l) => width(l, 14, true))) + 28, h: lines.length * lh(14) + 16 }; };
    const sz = new Map(items.map((it) => [it.id, size(it)]));
    const n = ring.length;
    let R = 120, pos;
    const place = (r) => new Map([[hub.id, [0, 0]], ...ring.map((it, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [it.id, [1.45 * r * Math.cos(a), r * Math.sin(a)]]; })]);
    const clash = (p) => items.some((a, i) => items.some((b, j) => {
      if (j <= i) return false;
      const [ax, ay] = p.get(a.id), [bx, by] = p.get(b.id), sa = sz.get(a.id), sb = sz.get(b.id);
      return Math.abs(ax - bx) < (sa.w + sb.w) / 2 + 20 && Math.abs(ay - by) < (sa.h + sb.h) / 2 + 26;
    }));
    for (pos = place(R); clash(pos) && R < 800; pos = place(R)) R += 8;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const it of items) { const [x, y] = pos.get(it.id), s = sz.get(it.id); minX = Math.min(minX, x - s.w / 2); maxX = Math.max(maxX, x + s.w / 2); minY = Math.min(minY, y - s.h / 2); maxY = Math.max(maxY, y + s.h / 2); }
    const ox = M - minX, oy = M - minY;
    for (const it of items) { const [x, y] = pos.get(it.id), s = sz.get(it.id); rects.set(it.id, { x: x + ox - s.w / 2, y: y + oy - s.h / 2, w: s.w, h: s.h }); }
    const mids = [];
    for (const l of c.links) { const a = rects.get(l.from), b = rects.get(l.to); if (a && b) mids.push([connect(a, b), l.label]); }
    items.forEach((it, i) => {
      const r = rects.get(it.id), s = sz.get(it.id), slot = it === hub ? 'viz-1' : viz(i + 1);
      box(r.x, r.y, r.w, r.h, slot, Math.min(r.h / 2, 18));
      text(s.lines, r.x + r.w / 2, r.y + 8, 14, { bold: true, anchor: 'middle' });
    });
    for (const [[x, y], label] of mids) if (label) tag(x, y, label);
    vw = maxX - minX + 2 * M; H = maxY - minY + 2 * M;
  } else if (c.links.length && !c.groups.length && layered(items, c.links)) {
    // Linked, ungrouped: rows by depth from the roots so connectors run downward.
    const levels = layered(items, c.links);
    const gapX = 28, gapY = 52, inner = W - 2 * M;
    let y = M;
    levels.forEach((row, d) => {
      const cw = Math.min(230, (inner - (row.length - 1) * gapX) / row.length);
      const ms = row.map((it) => measureCard(it, cw));
      const rh = Math.max(...ms.map((m) => m.h));
      const x0 = M + (inner - row.length * cw - (row.length - 1) * gapX) / 2;
      row.forEach((it, k) => {
        const x = x0 + k * (cw + gapX);
        drawCard(x, y, cw, rh, ms[k], viz(d));
        rects.set(it.id, { x, y, w: cw, h: rh });
      });
      y += rh + gapY;
    });
    const mids = [];
    for (const l of c.links) { const a = rects.get(l.from), b = rects.get(l.to); if (a && b && a !== b) mids.push([connect(a, b), l.label]); }
    for (const [[x, yy], label] of mids) if (label) tag(x, yy, label);
    H = y - gapY + M;
  } else {
    // Generic card grid: groups become labelled containers, links become connectors.
    const groups = c.groups.map((g) => ({ label: g.label, items: items.filter((it) => it.group === g.id) })).filter((g) => g.items.length);
    const loose = items.filter((it) => !c.groups.some((g) => g.id === it.group));
    if (loose.length) groups.push({ label: null, items: loose });
    let y = M;
    for (const [gi, g] of groups.entries()) {
      const inset = g.label ? 12 : 0, head = g.label ? 30 : 0;
      const inner = W - 2 * M - 2 * inset;
      const n = g.items.length, cols = n <= 2 ? n : n === 4 ? 2 : 3, gap = 28;
      const cw = (inner - (cols - 1) * gap) / cols;
      const ms = g.items.map((it) => measureCard(it, cw));
      const rowsH = [];
      for (let r = 0; r * cols < n; r++) rowsH.push(Math.max(...ms.slice(r * cols, r * cols + cols).map((m) => m.h)));
      const gh = head + rowsH.reduce((a, b) => a + b, 0) + (rowsH.length - 1) * gap + 2 * inset;
      if (g.label) {
        layer.rect(W - 2 * M, gh).move(M, y).radius(radius).attr({ fill: C('surface-2'), stroke: C('border'), 'stroke-width': 1 });
        text(wrap(g.label, inner, 13, true).slice(0, 1), M + inset + 2, y + 8, 13, { bold: true, slot: 'fg-muted' });
      }
      let ry = y + inset + head;
      rowsH.forEach((rh, r) => {
        ms.slice(r * cols, r * cols + cols).forEach((m, k) => {
          const it = g.items[r * cols + k], x = M + inset + k * (cw + gap);
          drawCard(x, ry, cw, rh, m, viz(gi));
          rects.set(it.id, { x, y: ry, w: cw, h: rh });
        });
        ry += rh + gap;
      });
      y += gh + 16;
    }
    for (const l of c.links) { const a = rects.get(l.from), b = rects.get(l.to); if (a && b && a !== b) connect(a, b); }
    H = y - 16 + M;
  }
  draw.viewbox(0, 0, Math.ceil(vw), Math.ceil(H));
  const out = draw.svg();
  draw.remove();
  return out;
}`;

/** Raw SVG via SVG.js in the shared page. */
export async function renderSvgJs(browser: GraphicsBrowser, spec: VisualSpec, theme: GraphicsTheme): Promise<string> {
  const raw = await browser.call<string>(
    DRAW_FN,
    {
      spec,
      style: theme.figureStyle,
      radius: CORNER_RADIUS[theme.corner ?? 'soft'],
      palette: PALETTE,
      font: FONT_FAMILY,
      measureFont: FONT_STACK,
    },
    ['svgjs'],
  );
  // Drop SVG.js bookkeeping (auto ids, namespace, data attrs) so output is deterministic.
  return raw
    .replace(/\s(?:xmlns:svgjs|svgjs:[\w-]+)="[^"]*"/g, '')
    .replace(/\sid="Svgjs\w+"/g, '')
    .replace(/\s(?:width|height)="100%"/g, '');
}
