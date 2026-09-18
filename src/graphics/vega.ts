/** `vega_lite` renderer: Vega-Lite → Vega → SVG headlessly in Node (renderer 'none', no canvas). */
import { parse, View } from 'vega';
import { compile, type TopLevelSpec } from 'vega-lite';
import type { VisualSpec } from '../core/schemas/content.js';
import { FONT_STACK, type GraphicsTheme, PALETTE } from './theme.js';

export interface Datum {
  category: string;
  series: string;
  value: number;
}

/** Long-format data from items (label/value/group) or rows × columns (numeric cells). */
export function chartData(spec: VisualSpec): { data: Datum[]; multiSeries: boolean } {
  const c = spec.content;
  const fromItems = c.items
    .filter((it) => typeof it.value === 'number')
    .map((it) => ({ category: it.label, series: c.groups.find((g) => g.id === it.group)?.label ?? '', value: it.value as number }));
  if (fromItems.length) return { data: fromItems, multiSeries: new Set(fromItems.map((d) => d.series)).size > 1 };
  if (c.rows.length) {
    const n = Math.max(...c.rows.map((r) => r.cells.length));
    const heads = c.columns.length === n + 1 ? c.columns.slice(1) : c.columns;
    const data: Datum[] = [];
    for (const r of c.rows) {
      r.cells.forEach((cell, j) => {
        const v = Number.parseFloat(cell.replace(/[,%\s]/g, ''));
        if (Number.isFinite(v)) data.push({ category: r.label, series: heads[j] ?? `Series ${j + 1}`, value: v });
      });
    }
    if (data.length) return { data, multiSeries: n > 1 };
  }
  throw new Error(`${spec.id}: no numeric data for a chart`);
}

const VIZ = [PALETTE['viz-1'], PALETTE['viz-2'], PALETTE['viz-3'], PALETTE['viz-4'], PALETTE['viz-5'], PALETTE['viz-6']];

export function vegaLiteSpec(spec: VisualSpec, theme: GraphicsTheme): TopLevelSpec {
  const { data, multiSeries } = chartData(spec);
  const type = spec.content.chartType ?? 'bar';
  const x = spec.content.axes.x ?? '';
  const y = spec.content.axes.y ?? '';
  const order = [...new Set(data.map((d) => d.category))];
  const xEnc = { field: 'category', type: 'ordinal' as const, sort: order, title: x || null, axis: { labelAngle: 0, labelLimit: 140 } };
  const yEnc = {
    field: 'value',
    type: 'quantitative' as const,
    title: y || null,
    stack: type === 'stacked-bar' ? ('zero' as const) : null,
  };
  const color = multiSeries
    ? { field: 'series', type: 'nominal' as const, title: null, legend: { orient: 'top' as const } }
    : { value: PALETTE['viz-1'] };
  const mark =
    type === 'line' || type === 'area' || type === 'point'
      ? { type, point: type !== 'point' ? true : undefined, strokeWidth: 2.5, opacity: type === 'area' ? 0.35 : 1 }
      : {
          type: 'bar' as const,
          cornerRadiusEnd: theme.corner === 'sharp' ? 0 : 3,
          ...(theme.figureStyle === 'line' ? { fillOpacity: 0.85 } : {}),
        };
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: spec.title ? { text: spec.title, anchor: 'start', fontSize: 16, fontWeight: 600, color: PALETTE.fg, offset: 12 } : undefined,
    width: 600,
    height: 300,
    background: null,
    data: { values: data },
    mark,
    encoding: {
      x: xEnc,
      y: yEnc,
      color,
      ...(multiSeries && type === 'bar' ? { xOffset: { field: 'series' } } : {}),
    },
    config: {
      font: FONT_STACK,
      view: { stroke: null },
      range: { category: VIZ },
      axis: {
        labelFontSize: 13,
        titleFontSize: 13,
        titleFontWeight: 600,
        labelColor: PALETTE['fg-muted'],
        titleColor: PALETTE.fg,
        domainColor: PALETTE.border,
        tickColor: PALETTE.border,
        gridColor: PALETTE.border,
        gridOpacity: 0.7,
      },
      legend: { labelFontSize: 13, labelColor: PALETTE.fg, symbolSize: 120 },
    },
  } as unknown as TopLevelSpec;
}

/** Raw SVG (hex colours; post-processing maps them to theme variables). */
export async function renderVegaLite(spec: VisualSpec, theme: GraphicsTheme): Promise<string> {
  const vg = compile(vegaLiteSpec(spec, theme)).spec;
  const view = new View(parse(vg), { renderer: 'none' });
  try {
    return await view.toSVG();
  } finally {
    view.finalize();
  }
}
