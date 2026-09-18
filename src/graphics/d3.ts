/**
 * `d3` renderer (in-page): (a) bar / line chart, (b) force-directed network with deterministic initial
 * positions and a fixed tick count (d3-force's own LCG makes jiggle deterministic too).
 */
import type { VisualSpec } from '../core/schemas/content.js';
import type { GraphicsBrowser } from './browser.js';
import { FONT_FAMILY, FONT_STACK, type GraphicsTheme, PALETTE } from './theme.js';
import { chartData } from './vega.js';

const DRAW_FN = `({ kind, data, nodes, links, chartType, axes, style, palette, font, measureFont }) => {
  const C = (s) => 'var(--cf-' + s + ', ' + palette[s] + ')';
  const viz = (i) => C('viz-' + ((i % 6) + 1));
  const probe = document.createElement('canvas').getContext('2d');
  const width = (t, size, bold) => { probe.font = (bold ? '600 ' : '') + size + 'px ' + measureFont; return probe.measureText(t).width; };
  const svg = d3.create('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('font-family', font);
  const defs = svg.append('defs');
  defs.append('marker').attr('id', 'arrow').attr('viewBox', '0 0 10 10').attr('refX', 8.5).attr('refY', 5)
    .attr('markerWidth', 8).attr('markerHeight', 8).attr('markerUnits', 'userSpaceOnUse').attr('orient', 'auto-start-reverse')
    .append('path').attr('d', 'M0.5,1 L9,5 L0.5,9 z').attr('fill', C('fg-muted'));

  if (kind === 'chart') {
    const W = 720, H = 360, m = { top: 44, right: 16, bottom: axes.x ? 56 : 36, left: axes.y ? 64 : 48 };
    const cats = [...new Set(data.map((d) => d.category))];
    const series = [...new Set(data.map((d) => d.series))];
    const x = d3.scaleBand().domain(cats).range([m.left, W - m.right]).padding(0.28);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) || 1]).nice().range([H - m.bottom, m.top]);
    const g = svg.append('g');
    g.append('g').attr('transform', 'translate(' + m.left + ',0)')
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.left - m.right)).tickPadding(8))
      .call((a) => { a.select('.domain').remove(); a.selectAll('line').attr('stroke', C('border')); });
    g.append('g').attr('transform', 'translate(0,' + (H - m.bottom) + ')').call(d3.axisBottom(x).tickSizeOuter(0).tickPadding(8))
      .call((a) => { a.select('.domain').attr('stroke', C('fg-muted')); a.selectAll('line').remove(); });
    g.selectAll('.tick text').attr('font-size', 13).attr('fill', C('fg-muted'));
    g.selectAll('g[font-family]').attr('font-family', null).attr('font-size', null);
    const line = chartType === 'line' || chartType === 'area' || chartType === 'point';
    if (!line) {
      const inner = d3.scaleBand().domain(series).range([0, x.bandwidth()]).padding(0.08);
      g.append('g').selectAll('rect').data(data).join('rect')
        .attr('x', (d) => x(d.category) + inner(d.series)).attr('width', inner.bandwidth())
        .attr('y', (d) => y(d.value)).attr('height', (d) => y(0) - y(d.value)).attr('rx', 3)
        .attr('fill', (d) => viz(series.indexOf(d.series))).attr('fill-opacity', style === 'line' ? 0.85 : 1);
      if (series.length === 1) g.append('g').selectAll('text').data(data).join('text')
        .attr('x', (d) => x(d.category) + x.bandwidth() / 2).attr('y', (d) => y(d.value) - 6)
        .attr('text-anchor', 'middle').attr('font-size', 13).attr('font-weight', 600).attr('fill', C('fg'))
        .text((d) => d.value.toLocaleString('en-US'));
    } else {
      series.forEach((s, i) => {
        const pts = data.filter((d) => d.series === s);
        const cx = (d) => x(d.category) + x.bandwidth() / 2;
        if (chartType !== 'point') g.append('path').datum(pts).attr('fill', 'none').attr('stroke', viz(i)).attr('stroke-width', 2.5)
          .attr('d', d3.line().x(cx).y((d) => y(d.value)));
        g.append('g').selectAll('circle').data(pts).join('circle').attr('cx', cx).attr('cy', (d) => y(d.value)).attr('r', 4.5)
          .attr('fill', C('surface')).attr('stroke', viz(i)).attr('stroke-width', 2.5);
      });
    }
    if (series.length > 1) {
      let lx = m.left;
      series.forEach((s, i) => {
        g.append('rect').attr('x', lx).attr('y', 12).attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', viz(i));
        g.append('text').attr('x', lx + 18).attr('y', 22.5).attr('font-size', 13).attr('fill', C('fg')).text(s);
        lx += 18 + width(s, 13, false) + 20;
      });
    }
    if (axes.x) g.append('text').attr('x', (m.left + W - m.right) / 2).attr('y', H - 12).attr('text-anchor', 'middle')
      .attr('font-size', 13).attr('font-weight', 600).attr('fill', C('fg')).text(axes.x);
    if (axes.y) g.append('text').attr('transform', 'translate(16,' + (m.top + H - m.bottom) / 2 + ') rotate(-90)').attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central').attr('font-size', 13).attr('font-weight', 600).attr('fill', C('fg')).text(axes.y);
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    return svg.node().outerHTML;
  }

  // Force-directed network.
  const n = nodes.length;
  const sim = nodes.map((d, i) => ({ ...d, x: 160 * Math.cos((2 * Math.PI * i) / n), y: 110 * Math.sin((2 * Math.PI * i) / n),
    half: width(d.label, 14, true) / 2 + 10 }));
  const ls = links.map((l) => ({ ...l }));
  const force = d3.forceSimulation(sim)
    .force('link', d3.forceLink(ls).id((d) => d.id).distance(130).strength(0.6))
    .force('charge', d3.forceManyBody().strength(-520))
    .force('collide', d3.forceCollide((d) => Math.min(d.half, 90) + 8))
    .force('x', d3.forceX(0).strength(0.04)).force('y', d3.forceY(0).strength(0.09))
    .stop();
  for (let i = 0; i < 400; i++) force.tick();
  const r = 9;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const d of sim) { minX = Math.min(minX, d.x - d.half); maxX = Math.max(maxX, d.x + d.half); minY = Math.min(minY, d.y - r); maxY = Math.max(maxY, d.y + r + 26); }
  const pad = 16, ox = pad - minX, oy = pad - minY;
  const g = svg.append('g').attr('transform', 'translate(' + ox.toFixed(2) + ',' + oy.toFixed(2) + ')');
  const fx = (v) => Math.round(v * 100) / 100;
  for (const l of ls) {
    const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, len = Math.hypot(dx, dy) || 1;
    g.append('line').attr('x1', fx(l.source.x + (dx / len) * r)).attr('y1', fx(l.source.y + (dy / len) * r))
      .attr('x2', fx(l.target.x - (dx / len) * (r + 3))).attr('y2', fx(l.target.y - (dy / len) * (r + 3)))
      .attr('stroke', C('fg-muted')).attr('stroke-width', 1.5).attr('marker-end', 'url(#arrow)');
  }
  const labels = g.append('g');
  sim.forEach((d, i) => {
    g.append('circle').attr('cx', fx(d.x)).attr('cy', fx(d.y)).attr('r', r).attr('fill', style === 'filled' ? viz(i) : C('surface'))
      .attr('stroke', viz(i)).attr('stroke-width', 2.5);
    labels.append('text').attr('x', fx(d.x)).attr('y', fx(d.y + r + 18)).attr('text-anchor', 'middle').attr('font-size', 14)
      .attr('font-weight', 600).attr('fill', C('fg')).attr('paint-order', 'stroke').attr('stroke', C('surface'))
      .attr('stroke-width', 4).attr('stroke-linejoin', 'round').text(d.label);
  });
  svg.attr('viewBox', '0 0 ' + Math.ceil(maxX - minX + 2 * pad) + ' ' + Math.ceil(maxY - minY + 2 * pad));
  return svg.node().outerHTML;
}`;

export async function renderD3(browser: GraphicsBrowser, spec: VisualSpec, theme: GraphicsTheme): Promise<string> {
  const c = spec.content;
  const common = {
    style: theme.figureStyle,
    palette: PALETTE,
    font: FONT_FAMILY,
    measureFont: FONT_STACK,
    axes: c.axes,
    chartType: c.chartType,
  };
  const numeric = c.items.some((it) => typeof it.value === 'number') || (c.rows.length > 0 && !c.links.length);
  if (spec.archetype === 'QUANTITATIVE_CHART' || numeric) {
    return browser.call<string>(DRAW_FN, { ...common, kind: 'chart', data: chartData(spec).data }, ['d3']);
  }
  const ids = new Set(c.items.map((it) => it.id));
  const links = c.links.filter((l) => ids.has(l.from) && ids.has(l.to)).map((l) => ({ source: l.from, target: l.to }));
  if (!links.length) throw new Error(`d3: ${spec.id} has neither numeric data nor links`);
  const nodes = c.items.map((it) => ({ id: it.id, label: it.label }));
  return browser.call<string>(DRAW_FN, { ...common, kind: 'network', nodes, links }, ['d3']);
}
