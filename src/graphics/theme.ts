/**
 * Theme contract shared by every renderer: colours are CSS custom properties with hex fallbacks so the
 * course stylesheet can re-theme inline SVG (including dark mode) without re-rendering.
 */
import type { DesignDirection } from '../core/schemas/content.js';

export type FigureStyle = DesignDirection['figureStyle'];
export type Corner = DesignDirection['corner'];

export interface GraphicsTheme {
  figureStyle: FigureStyle;
  corner?: Corner;
}

/** Default hex per slot. Order matters: nearest-colour ties resolve to the earlier slot. */
export const PALETTE = {
  fg: '#1f2937',
  'fg-muted': '#4b5563',
  surface: '#ffffff',
  'surface-2': '#f3f5f8',
  border: '#d0d7de',
  bg: '#fbfcfd',
  accent: '#1558d6',
  'viz-1': '#1f6feb',
  'viz-2': '#0f8a6c',
  'viz-3': '#c2610c',
  'viz-4': '#8a3ffc',
  'viz-5': '#c9303e',
  'viz-6': '#5b6b7f',
} as const;
export type PaletteSlot = keyof typeof PALETTE;
export const PALETTE_SLOTS = Object.keys(PALETTE) as PaletteSlot[];

/** `var(--cf-<slot>, #hex)` */
export const cssVar = (slot: PaletteSlot): string => `var(--cf-${slot}, ${PALETTE[slot]})`;

export type VizSlot = 'viz-1' | 'viz-2' | 'viz-3' | 'viz-4' | 'viz-5' | 'viz-6';
export const vizSlot = (i: number): VizSlot => `viz-${(((i % 6) + 6) % 6) + 1}` as VizSlot;

export const FONT_FAMILY = 'var(--cf-font-sans, system-ui, sans-serif)';
/** Literal font stack for renderers that cannot take CSS variables (Mermaid layout, Vega). */
export const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const CORNER_RADIUS: Record<Corner, number> = { sharp: 0, soft: 6, round: 12 };
export const cornerRadius = (theme: GraphicsTheme): number => CORNER_RADIUS[theme.corner ?? 'soft'];

export function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
