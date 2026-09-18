/**
 * Bounded render loop (spec 05): primary renderer → quality check → at most `maxSemanticRepairs` repair
 * callbacks (re-rendering the same renderer) → next fallback renderer → … → `text_equivalent`, which
 * always succeeds. Every attempt is recorded for the build report.
 */
import type { Renderer } from '../core/enums.js';
import { errorMessage } from '../core/errors.js';
import type { VisualSpec } from '../core/schemas/content.js';
import type { GraphicsBrowser } from './browser.js';
import { renderD3 } from './d3.js';
import { hasIcon, iconSvg } from './lucide.js';
import { renderMermaid } from './mermaid.js';
import { renderNative } from './native/index.js';
import { idPrefix, postprocessSvg } from './postprocess.js';
import { checkSvgInBrowser, checkSvgStatic, type QualityIssue } from './quality.js';
import { renderSvgJs } from './svgjs.js';
import type { GraphicsTheme } from './theme.js';
import { renderVegaLite } from './vega.js';

/** Structurally identical to `VisualRouteResult` from src/routing/visual.ts. */
export interface VisualRoute {
  renderer: Renderer;
  fallbacks: Renderer[];
  rule: string;
}

export interface RenderAttempt {
  renderer: Renderer;
  ok: boolean;
  error: string | null;
}

export interface RenderedVisual {
  visualId: string;
  svg: string | null;
  html: string | null;
  renderer: Renderer;
  rule: string;
  fallbackUsed: boolean;
  attempts: RenderAttempt[];
  bytes: number;
}

export interface RenderContext {
  browser: GraphicsBrowser;
  theme: GraphicsTheme;
  /** Semantic repair hook (e.g. an agent call); `null` means "no repair possible". */
  repair?: (spec: VisualSpec, issues: string[]) => Promise<VisualSpec | null>;
  maxSemanticRepairs: number;
  /** Skip the in-browser QA (static checks still run). Default false. */
  skipBrowserQa?: boolean;
}

class QualityError extends Error {
  constructor(readonly issues: QualityIssue[]) {
    super(issues.map((i) => i.message).join('; '));
  }
}

/** Raw SVG from one renderer (throws on failure). */
export async function renderRaw(renderer: Renderer, spec: VisualSpec, ctx: Pick<RenderContext, 'browser' | 'theme'>): Promise<string> {
  switch (renderer) {
    case 'mermaid':
      return renderMermaid(ctx.browser, spec, ctx.theme);
    case 'cf_svg':
      return renderNative(spec, ctx.theme);
    case 'svgjs':
      return renderSvgJs(ctx.browser, spec, ctx.theme);
    case 'vega_lite':
      return renderVegaLite(spec, ctx.theme);
    case 'd3':
      return renderD3(ctx.browser, spec, ctx.theme);
    case 'lucide': {
      const first = spec.content.items[0];
      const name = [first?.id, first?.label.toLowerCase()].find((n): n is string => Boolean(n && hasIcon(n)));
      if (!name) throw new Error(`lucide: no known icon name in ${spec.id}`);
      return iconSvg(name, { size: 48 });
    }
    case 'text_equivalent':
      throw new Error('text_equivalent is not an SVG renderer');
  }
}

async function renderChecked(renderer: Renderer, spec: VisualSpec, ctx: RenderContext): Promise<string> {
  const raw = await renderRaw(renderer, spec, ctx);
  const svg = postprocessSvg(raw, { visualId: spec.id, title: spec.textEquivalent.short, desc: spec.textEquivalent.long });
  const issues = checkSvgStatic(svg, spec.id);
  if (!issues.length && !ctx.skipBrowserQa) issues.push(...(await checkSvgInBrowser(ctx.browser, svg)));
  if (issues.length) throw new QualityError(issues);
  return svg;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ORDERED = new Set(['PROCESS', 'LIFECYCLE', 'TIMELINE', 'SEQUENCE', 'FUNNEL', 'FEEDBACK_LOOP', 'CAUSE_EFFECT', 'CONTINUUM']);

/** Structured, styleable HTML figure built from the spec content plus the long text equivalent. */
export function textEquivalentFigure(spec: VisualSpec): string {
  const c = spec.content;
  const p = idPrefix(spec.id);
  const parts: string[] = [];
  if (c.rows.length) {
    const n = Math.max(...c.rows.map((r) => r.cells.length));
    const heads = c.columns.length === n + 1 ? c.columns : ['', ...c.columns.slice(0, n)];
    const hasHead = heads.some((h) => h.trim());
    parts.push(
      `<table class="cf-visual__table">${hasHead ? `<thead><tr>${heads.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${c.rows
        .map(
          (r) =>
            `<tr><th scope="row">${esc(r.label)}</th>${Array.from({ length: n }, (_, j) => `<td>${esc(r.cells[j] ?? '')}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody></table>`,
    );
  }
  if (c.items.length) {
    const tag = ORDERED.has(spec.archetype) ? 'ol' : 'ul';
    const li = (it: (typeof c.items)[number]) =>
      `<li><strong>${esc(it.label)}</strong>${it.value !== null ? ` (${esc(String(it.value))})` : ''}${it.detail ? ` — ${esc(it.detail)}` : ''}</li>`;
    const grouped = c.groups.filter((g) => c.items.some((it) => it.group === g.id));
    if (grouped.length) {
      const loose = c.items.filter((it) => !grouped.some((g) => g.id === it.group));
      parts.push(
        `<ul class="cf-visual__groups">${grouped
          .map(
            (g) =>
              `<li><strong>${esc(g.label)}</strong><${tag}>${c.items
                .filter((it) => it.group === g.id)
                .map(li)
                .join('')}</${tag}></li>`,
          )
          .join('')}${loose.map(li).join('')}</ul>`,
      );
    } else parts.push(`<${tag} class="cf-visual__list">${c.items.map(li).join('')}</${tag}>`);
  }
  if (c.links.length) {
    const name = new Map(c.items.map((it) => [it.id, it.label]));
    parts.push(
      `<ul class="cf-visual__links">${c.links
        .map((l) => `<li>${esc(name.get(l.from) ?? l.from)} → ${esc(name.get(l.to) ?? l.to)}${l.label ? ` (${esc(l.label)})` : ''}</li>`)
        .join('')}</ul>`,
    );
  }
  return (
    `<figure class="cf-visual cf-visual--text" id="${p}figure" aria-labelledby="${p}caption" aria-describedby="${p}long">` +
    `<figcaption id="${p}caption">${esc(spec.title || spec.textEquivalent.short)}</figcaption>` +
    `<div class="cf-visual__structure">${parts.join('')}</div>` +
    `<p class="cf-visual__long" id="${p}long">${esc(spec.textEquivalent.long)}</p></figure>`
  );
}

export async function renderVisual(input: VisualSpec, route: VisualRoute, ctx: RenderContext): Promise<RenderedVisual> {
  const chain: Renderer[] = [];
  for (const r of [route.renderer, ...route.fallbacks, 'text_equivalent' as const]) if (!chain.includes(r)) chain.push(r);
  const attempts: RenderAttempt[] = [];
  let spec = input;
  let repairsLeft = Math.max(0, ctx.maxSemanticRepairs);
  const done = (renderer: Renderer, svg: string | null, html: string | null): RenderedVisual => ({
    visualId: input.id,
    svg,
    html,
    renderer,
    rule: route.rule,
    fallbackUsed: renderer !== route.renderer,
    attempts,
    bytes: Buffer.byteLength(svg ?? html ?? '', 'utf8'),
  });
  for (const renderer of chain) {
    if (renderer === 'text_equivalent') {
      attempts.push({ renderer, ok: true, error: null });
      return done(renderer, null, textEquivalentFigure(spec));
    }
    for (;;) {
      try {
        const svg = await renderChecked(renderer, spec, ctx);
        attempts.push({ renderer, ok: true, error: null });
        return done(renderer, svg, null);
      } catch (err) {
        const issues = err instanceof QualityError ? err.issues.map((i) => i.message) : [errorMessage(err)];
        attempts.push({ renderer, ok: false, error: issues.join('; ').slice(0, 2000) });
        if (!ctx.repair || repairsLeft <= 0) break;
        repairsLeft--;
        const repaired = await ctx.repair(spec, issues);
        if (!repaired) break;
        spec = { ...repaired, id: input.id };
      }
    }
  }
  // Unreachable: text_equivalent terminates the chain.
  throw new Error(`renderVisual: no terminal renderer for ${input.id}`);
}

/** Sequential on purpose (one shared page, low RAM). */
export async function renderAll(
  specs: VisualSpec[],
  routes: Map<string, VisualRoute> | Record<string, VisualRoute>,
  ctx: RenderContext,
): Promise<Map<string, RenderedVisual>> {
  const out = new Map<string, RenderedVisual>();
  for (const spec of specs) {
    const route = routes instanceof Map ? routes.get(spec.id) : routes[spec.id];
    if (!route) throw new Error(`renderAll: no route for visual ${spec.id}`);
    out.set(spec.id, await renderVisual(spec, route, ctx));
  }
  return out;
}
