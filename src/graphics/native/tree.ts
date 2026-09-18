/** Linked archetypes: hierarchy (top-down tree), scenario map (left-right decision tree), evidence map. */
import type { VisualSpec } from '../../core/schemas/content.js';
import { type PaletteSlot, vizSlot } from '../theme.js';
import { arrowPath, type CardLayout, type Ctx, card, cardLayout, doc, fmt, type Item, line, M, SIZE, textLines, W } from './kit.js';

interface Node {
  item: Item;
  caption: string | null;
  children: Node[];
  depth: number;
}

/** Build a forest from links (first parent wins, cycles ignored); falls back to groups → items. */
function forest(spec: VisualSpec): Node[] {
  const { items, links, groups } = spec.content;
  if (!items.length) throw new Error(`${spec.archetype} needs items`);
  const nodes = new Map<string, Node>(items.map((it) => [it.id, { item: it, caption: null, children: [], depth: 0 }]));
  const parentOf = new Map<string, string>();
  const hasParent = { has: (id: string) => parentOf.has(id) };
  if (links.length) {
    for (const l of links) {
      const p = nodes.get(l.from);
      const c = nodes.get(l.to);
      if (!p || !c || parentOf.has(l.to)) continue;
      // Reject edges that would close a cycle (c is p or an ancestor of p).
      let anc: string | undefined = l.from;
      while (anc && anc !== l.to) anc = parentOf.get(anc);
      if (anc) continue;
      c.caption = l.label;
      p.children.push(c);
      parentOf.set(l.to, l.from);
    }
    const roots = items.filter((it) => !hasParent.has(it.id)).map((it) => nodes.get(it.id) as Node);
    const setDepth = (n: Node, d: number) => {
      n.depth = d;
      for (const c of n.children) setDepth(c, d + 1);
    };
    for (const r of roots) setDepth(r, 0);
    return roots;
  }
  if (groups.length) {
    return groups.map((g) => ({
      item: { id: g.id, label: g.label, detail: null, group: null, value: null },
      caption: null,
      depth: 0,
      children: items.filter((it) => it.group === g.id).map((it) => ({ item: it, caption: null, children: [], depth: 1 })),
    }));
  }
  return items.map((it) => nodes.get(it.id) as Node);
}

const walk = (roots: Node[]): Node[] => roots.flatMap((r) => [r, ...walk(r.children)]);
const leaves = (n: Node): number => (n.children.length ? n.children.reduce((a, c) => a + leaves(c), 0) : 1);

/** Indented outline tree: robust fallback for wide or deep structures (and narrow screens). */
function indented(roots: Node[], ctx: Ctx, slotOf: (n: Node) => PaletteSlot, withCaption: boolean): string {
  const step = 28;
  let y = M;
  let body = '';
  const edges: string[] = [];
  const place = (n: Node, parent: { x: number; bottom: number } | null) => {
    const x = M + n.depth * step;
    const w = W - M - x;
    const l = cardLayout({ title: n.item.label, detail: n.item.detail, caption: withCaption ? n.caption : null }, w);
    if (parent)
      edges.push(
        arrowPath(`M${fmt(parent.x + 14)},${fmt(parent.bottom)} V${fmt(y + l.h / 2)} H${fmt(x - 2)}`, { head: false, slot: 'border' }),
      );
    body += card(x, y, w, l.h, l, ctx, slotOf(n), { align: 'start' });
    const me = { x, bottom: y + l.h };
    y += l.h + 10;
    for (const c of n.children) place(c, me);
  };
  for (const r of roots) place(r, null);
  return doc(W, y - 10 + M, edges.join('') + body);
}

/* --------------------------------------------------------------- HIERARCHY */

export function hierarchy(spec: VisualSpec, ctx: Ctx): string {
  const roots = forest(spec);
  const all = walk(roots);
  const slotOf = (n: Node) => vizSlot(n.depth);
  const L = roots.reduce((a, r) => a + leaves(r), 0);
  const hgap = 14;
  const nodeW = Math.min(184, (W - 2 * M - (L - 1) * hgap) / L);
  const depthN = Math.max(...all.map((n) => n.depth)) + 1;
  if (nodeW < 104) return indented(roots, ctx, slotOf, false);
  const layout = new Map<Node, CardLayout>(all.map((n) => [n, cardLayout({ title: n.item.label, detail: n.item.detail }, nodeW)]));
  const levelH = Array.from({ length: depthN }, (_, d) =>
    Math.max(...all.filter((n) => n.depth === d).map((n) => (layout.get(n) as CardLayout).h)),
  );
  const vgap = 44;
  const levelY = levelH.map((_, d) => M + levelH.slice(0, d).reduce((a, b) => a + b, 0) + d * vgap);
  const cx = new Map<Node, number>();
  let cursor = M;
  const assign = (n: Node): number => {
    if (!n.children.length) {
      const x = cursor + nodeW / 2;
      cursor += nodeW + hgap;
      cx.set(n, x);
      return x;
    }
    const xs = n.children.map(assign);
    const x = ((xs[0] as number) + (xs[xs.length - 1] as number)) / 2;
    cx.set(n, x);
    return x;
  };
  for (const r of roots) assign(r);
  const width = cursor - hgap + M;
  let edges = '';
  let body = '';
  for (const n of all) {
    const x = cx.get(n) as number;
    const y = levelY[n.depth] as number;
    const h = levelH[n.depth] as number;
    body += card(x - nodeW / 2, y, nodeW, h, layout.get(n) as CardLayout, ctx, slotOf(n));
    if (n.children.length) {
      const midY = y + h + vgap / 2;
      const xs = n.children.map((c) => cx.get(c) as number);
      edges += line(x, y + h, x, midY, 'fg-muted', 1.5);
      edges += line(Math.min(...xs, x), midY, Math.max(...xs, x), midY, 'fg-muted', 1.5);
      for (const c of n.children) edges += arrowPath(`M${fmt(cx.get(c) as number)},${fmt(midY)} V${fmt((levelY[c.depth] as number) - 2)}`);
    }
  }
  const height = (levelY[depthN - 1] as number) + (levelH[depthN - 1] as number) + M;
  return doc(Math.max(width, 240), height, edges + body);
}

/* ------------------------------------------------------------ SCENARIO_MAP */

export function scenarioMap(spec: VisualSpec, ctx: Ctx): string {
  const roots = forest(spec);
  const all = walk(roots);
  const slotOf = (n: Node): PaletteSlot => (n.children.length ? 'viz-1' : 'viz-2');
  const D = Math.max(...all.map((n) => n.depth)) + 1;
  const colGap = 40;
  const colW = (W - 2 * M - (D - 1) * colGap) / D;
  if (colW < 128) return indented(roots, ctx, slotOf, true);
  const layout = new Map<Node, CardLayout>(
    all.map((n) => [n, cardLayout({ title: n.item.label, detail: n.item.detail, caption: n.caption }, colW)]),
  );
  const rowH = Math.max(...[...layout.values()].map((l) => l.h));
  const vgap = 14;
  const cy = new Map<Node, number>();
  let cursor = M;
  const assign = (n: Node): number => {
    if (!n.children.length) {
      const y = cursor + rowH / 2;
      cursor += rowH + vgap;
      cy.set(n, y);
      return y;
    }
    const ys = n.children.map(assign);
    const y = ((ys[0] as number) + (ys[ys.length - 1] as number)) / 2;
    cy.set(n, y);
    return y;
  };
  for (const r of roots) assign(r);
  let edges = '';
  let body = '';
  for (const n of all) {
    const x = M + n.depth * (colW + colGap);
    const y = cy.get(n) as number;
    body += card(x, y - rowH / 2, colW, rowH, layout.get(n) as CardLayout, ctx, slotOf(n), { align: 'start' });
    const midX = x + colW + colGap / 2;
    for (const c of n.children) {
      edges += arrowPath(`M${fmt(x + colW)},${fmt(y)} H${fmt(midX)} V${fmt(cy.get(c) as number)} H${fmt(x + colW + colGap - 2)}`);
    }
  }
  return doc(W, cursor - vgap + M, edges + body);
}

/* ------------------------------------------------------------ EVIDENCE_MAP */

const COUNTER = /contradict|refute|against|challenge|weaken|undermine/i;

export function evidenceMap(spec: VisualSpec, ctx: Ctx): string {
  const { items, links, groups, columns } = spec.content;
  let claimIds: Set<string>;
  if (links.length) claimIds = new Set(links.map((l) => l.to));
  else if (groups[0]) claimIds = new Set(items.filter((it) => it.group === groups[0]?.id).map((it) => it.id));
  else throw new Error('EVIDENCE_MAP needs links (source → claim) or groups');
  const claims = items.filter((it) => claimIds.has(it.id));
  const sources = items.filter((it) => !claimIds.has(it.id));
  if (!claims.length || !sources.length) throw new Error('EVIDENCE_MAP needs both sources and claims');
  const gap = 104;
  const colW = (W - 2 * M - gap) / 2;
  const headH = 26;
  const col = (list: Item[], x: number, slot: PaletteSlot) => {
    const ls = list.map((it) => cardLayout({ title: it.label, detail: it.detail }, colW));
    const total = ls.reduce((a, l) => a + l.h, 0) + (ls.length - 1) * 12;
    return { list, ls, total, x, slot };
  };
  const left = col(sources, M, 'viz-2');
  const right = col(claims, M + colW + gap, 'viz-1');
  const inner = Math.max(left.total, right.total);
  const pos = new Map<string, { x: number; y: number; h: number }>();
  let body = '';
  for (const c of [left, right]) {
    let y = M + headH + (inner - c.total) / 2;
    c.ls.forEach((l, i) => {
      const it = c.list[i] as Item;
      pos.set(it.id, { x: c.x, y, h: l.h });
      body += card(c.x, y, colW, l.h, l, ctx, c.slot, { align: 'start' });
      y += l.h + 12;
    });
  }
  const heads = [columns[0] ?? groups[1]?.label ?? 'Evidence', columns[1] ?? groups[0]?.label ?? 'Claims'];
  body += textLines([heads[0] as string], M + 2, M, { size: SIZE.caption, bold: true, slot: 'fg-muted' });
  body += textLines([heads[1] as string], M + colW + gap + 2, M, { size: SIZE.caption, bold: true, slot: 'fg-muted' });
  let edges = '';
  for (const l of links) {
    const a = pos.get(l.from);
    const b = pos.get(l.to);
    if (!a || !b || a.x === b.x) continue;
    const x1 = a.x + colW;
    const y1 = a.y + a.h / 2;
    const x2 = b.x - 2;
    const y2 = b.y + b.h / 2;
    const counter = Boolean(l.label && COUNTER.test(l.label));
    edges += arrowPath(`M${fmt(x1)},${fmt(y1)} C${fmt(x1 + gap / 2)},${fmt(y1)} ${fmt(x2 - gap / 2)},${fmt(y2)} ${fmt(x2)},${fmt(y2)}`, {
      slot: counter ? 'viz-5' : 'fg-muted',
      dashed: counter,
    });
  }
  const height = M + headH + inner + M;
  return doc(W, height, edges + body);
}
