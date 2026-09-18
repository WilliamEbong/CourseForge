import type { Meta, StoryObj } from '@storybook/html-vite';
import { VISUAL_FAMILIES } from '../../../src/core/enums.js';
import { esc } from '../src/contract.js';
import { compileTheme, defaultDirection } from '../tokens/compile.js';
import { frame } from './support.js';

const SWATCHES = [
  'bg',
  'surface',
  'surface-2',
  'fg',
  'fg-muted',
  'border',
  'accent',
  'accent-soft',
  'success',
  'warning',
  'danger',
  'info',
  'viz-1',
  'viz-2',
  'viz-3',
  'viz-4',
  'viz-5',
  'viz-6',
];

/** Palette, type scale and contrast matrix for every family (follows the Family/Scheme toolbar for live tokens). */
const meta: Meta = {
  title: 'Foundations/Tokens',
  render: () => {
    const rows = VISUAL_FAMILIES.map((f) => {
      const { tokens, contrast } = compileTheme(defaultDirection(f));
      const sw = (scheme: 'light' | 'dark') =>
        SWATCHES.map(
          (k) =>
            `<span class="cf-badge" title="${esc(k)}"><span aria-hidden="true" style="display:inline-block;width:1rem;height:1rem;border-radius:3px;border:1px solid #8888;background:${tokens[scheme][k]}"></span>${esc(k)} ${esc(tokens[scheme][k])}</span>`,
        ).join(' ');
      const adjusted = contrast.filter((c) => c.adjusted).length;
      return `<section class="cf-card" style="margin-bottom:1.5rem"><h2 class="cf-section-title">${esc(tokens.label)}</h2><p class="cf-q-hint">${contrast.length} contrast pairs checked · ${adjusted} adjusted · all pass: ${contrast.every((c) => c.pass)}</p><p><strong>Light</strong></p><p style="display:flex;flex-wrap:wrap;gap:.25rem">${sw('light')}</p><p><strong>Dark</strong></p><p style="display:flex;flex-wrap:wrap;gap:.25rem">${sw('dark')}</p></section>`;
    }).join('');
    const scale = ['3xl', '2xl', 'xl', 'lg', 'base', 'sm', 'xs']
      .map(
        (k) =>
          `<p style="font-size:var(--cf-text-${k});font-family:var(--cf-font-heading);line-height:1.2">text-${k} — Reading a Safety Data Sheet</p>`,
      )
      .join('');
    return frame(`<div class="cf-stage"><section class="cf-card" style="margin-bottom:1.5rem">${scale}</section>${rows}</div>`);
  },
};
export default meta;
export const Palettes: StoryObj = {};
