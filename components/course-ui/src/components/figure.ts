/**
 * Figure wrapper: inline SVG slot, caption, short text equivalent (aria-describedby) and long description.
 * Without an SVG (renderer `text_equivalent`) the visual's content renders as a structured, styled fallback.
 */
import type { VisualSpec } from '../../../../src/core/schemas/content.js';
import { attrs, type CfComponent, esc, icon, md } from '../contract.js';
import { domId } from './question.js';

export interface VisualRender {
  svg: string;
  renderer: string;
  fallbackUsed?: boolean;
}

export interface FigureProps {
  visual: VisualSpec;
  render?: VisualRender | undefined;
  /** Figure number shown in the caption. */
  number?: number;
}

const ORDERED = new Set(['PROCESS', 'SEQUENCE', 'TIMELINE', 'LIFECYCLE']);

/** Minimal defence in depth; the graphics pipeline is responsible for full sanitisation. */
function prepareSvg(svg: string, describedBy: string, title: string): string {
  let out = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .trim();
  out = out.replace(/<svg\b([^>]*)>/i, (_m, a: string) => {
    let rest = a;
    if (!/\brole=/.test(rest)) rest += ' role="img"';
    if (!/\baria-describedby=/.test(rest)) rest += ` aria-describedby="${describedBy}"`;
    if (!/\baria-label(ledby)?=/.test(rest) && !/<title[\s>]/i.test(out)) rest += ` aria-label="${esc(title)}"`;
    if (!/\bfocusable=/.test(rest)) rest += ' focusable="false"';
    return `<svg${rest}>`;
  });
  return out;
}

function structured(v: VisualSpec): string {
  const c = v.content;
  if (c.columns.length && c.rows.length) {
    const head = `<tr><th scope="col"><span class="cf-sr-only">Item</span></th>${c.columns.map((col) => `<th scope="col">${esc(col)}</th>`).join('')}</tr>`;
    const body = c.rows
      .map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.cells.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
      .join('');
    return `<div class="cf-table-wrap" tabindex="0" role="region" aria-label="${esc(v.title)} (table)"><table class="cf-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }
  if (c.items.length) {
    const tag = ORDERED.has(v.archetype) ? 'ol' : 'ul';
    const unit = c.axes.y ? ` ${esc(c.axes.y)}` : '';
    return `<${tag} class="cf-figure-items">${c.items
      .map(
        (it) =>
          `<li><span class="cf-figure-item-label">${esc(it.label)}</span>${it.value !== null ? ` <span class="cf-figure-item-value">${esc(it.value)}${unit}</span>` : ''}${
            it.detail ? `<span class="cf-figure-item-detail">${esc(it.detail)}</span>` : ''
          }</li>`,
      )
      .join('')}</${tag}>`;
  }
  return '';
}

export const Figure: CfComponent<FigureProps> = {
  name: 'figure',
  render({ visual: v, render, number }) {
    const base = domId('cf-fig', v.id);
    const shortId = domId(base, 'short');
    const capId = domId(base, 'cap');
    const hasSvg = Boolean(render && render.renderer !== 'text_equivalent' && /<svg[\s>]/i.test(render.svg));
    const renderer = hasSvg ? render!.renderer : 'text_equivalent';
    const label = number ? `Figure ${number}` : 'Figure';
    const caption = `<figcaption class="cf-figure-caption"><span class="cf-figure-title" id="${capId}"><span class="cf-figure-num">${esc(label)}</span> ${esc(v.title)}</span><span class="cf-figure-short" id="${shortId}">${esc(v.textEquivalent.short)}</span>${
      hasSvg
        ? `<details class="cf-figure-long"><summary>Text description</summary><div class="cf-prose">${md(v.textEquivalent.long)}</div></details>`
        : ''
    }</figcaption>`;
    const media = hasSvg
      ? `<div class="cf-figure-media">${prepareSvg(render!.svg, shortId, v.title)}</div>`
      : `<div class="cf-figure-text"><p class="cf-figure-text-label">${icon('file-text')}Text version of this figure</p>${structured(v)}<div class="cf-prose">${md(v.textEquivalent.long)}</div></div>`;
    return `<figure class="cf-figure${hasSvg ? '' : ' cf-figure--text'}"${attrs({
      'data-cf-visual': v.id,
      'data-cf-renderer': renderer,
      'data-cf-archetype': v.archetype,
      'data-cf-fallback': render?.fallbackUsed ? 'true' : null,
      'aria-labelledby': capId,
      'aria-describedby': shortId,
    })}>${media}${caption}</figure>`;
  },
};
