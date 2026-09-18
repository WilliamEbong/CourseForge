/**
 * Design-token compiler: family DTCG JSON + bounded DesignDirection → CSS custom properties in
 * `@layer cf.tokens`, with a WCAG contrast matrix for light and dark. Colours that fail are moved along
 * OKLCH lightness deterministically and reported with `adjusted: true`.
 */
import { z } from 'zod';
import type { VisualFamily } from '../../../src/core/enums.js';
import type { DesignDirection } from '../../../src/core/schemas/content.js';
import { type Oklch, oklchToHex, rawContrast, searchLightness } from './contrast.js';
import corporate from './families/corporate-professional.json' with { type: 'json' };
import editorial from './families/editorial-humanities.json' with { type: 'json' };
import environmental from './families/environmental-natural.json' with { type: 'json' };
import modern from './families/modern-technology.json' with { type: 'json' };
import scientific from './families/scientific-clinical.json' with { type: 'json' };
import technical from './families/technical-industrial.json' with { type: 'json' };

const Num = z.object({ $type: z.literal('number'), $value: z.number() });
const Str = z.object({ $type: z.literal('string'), $value: z.string() });
const Dim = z.object({ $type: z.literal('dimension'), $value: z.object({ value: z.number(), unit: z.enum(['px', 'em', 'rem']) }) });
const Color = z.object({
  $type: z.literal('color'),
  $value: z.object({ colorSpace: z.literal('oklch'), components: z.tuple([z.number(), z.number(), z.number()]) }),
});
const Font = z.object({ $type: z.literal('fontFamily'), $value: z.array(z.string()).min(1) });
const NEUTRAL_KEYS = ['bg', 'surface', 'surface-2', 'fg', 'fg-muted', 'border', 'control-border'] as const;
const Neutrals = z.object(Object.fromEntries(NEUTRAL_KEYS.map((k) => [k, Color])) as Record<(typeof NEUTRAL_KEYS)[number], typeof Color>);
const STATUS_KEYS = ['success', 'warning', 'danger', 'info'] as const;
const Status = z.object({ success: Color, warning: Color, danger: Color, info: Color });
const Viz = z.record(z.string().regex(/^viz-[1-6]$/), Color);
const Radius = z.object({ sm: Dim, md: Dim, lg: Dim });
const Duration = z.object({ $type: z.literal('duration'), $value: z.object({ value: z.number(), unit: z.literal('ms') }) });

export const FamilyTokensSchema = z.object({
  $description: z.string(),
  meta: z.object({ label: Str, defaultAccentHue: Num }),
  color: z.object({
    light: Neutrals,
    dark: Neutrals,
    accent: z.object({ chroma: Num, lightness: z.object({ light: Num, dark: Num }), softLightness: z.object({ light: Num, dark: Num }) }),
    status: z.object({ light: Status, dark: Status }),
    viz: z.object({ light: Viz, dark: Viz }),
  }),
  font: z.object({
    sans: Font,
    serif: Font,
    mono: Font,
    body: Font,
    heading: Font,
    headingWeight: z.object({ $type: z.literal('fontWeight'), $value: z.number() }),
    headingTracking: Dim,
    eyebrowCase: Str,
  }),
  type: z.object({
    base: Dim,
    lineHeight: Num,
    headingLineHeight: Num,
    ratio: z.object({ compact: Num, default: Num, generous: Num }),
  }),
  space: z.object({ unit: Dim }),
  radius: z.object({ sharp: Radius, soft: Radius, round: Radius }),
  shadow: z.object({ light: z.object({ 1: Str, 2: Str }), dark: z.object({ 1: Str, 2: Str }) }),
  motion: z.object({
    duration: z.object({ fast: Duration, base: Duration }),
    easing: z.object({ $type: z.literal('cubicBezier'), $value: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
  }),
});
export type FamilyTokens = z.infer<typeof FamilyTokensSchema>;

const RAW: Record<VisualFamily, unknown> = {
  'scientific-clinical': scientific,
  'technical-industrial': technical,
  'corporate-professional': corporate,
  'editorial-humanities': editorial,
  'modern-technology': modern,
  'environmental-natural': environmental,
};

const cache = new Map<VisualFamily, FamilyTokens>();
export function familyTokens(family: VisualFamily): FamilyTokens {
  let t = cache.get(family);
  if (!t) {
    t = FamilyTokensSchema.parse(RAW[family]);
    cache.set(family, t);
  }
  return t;
}

export type Scheme = 'light' | 'dark';
export interface ContrastResult {
  pair: string;
  scheme: Scheme;
  ratio: number;
  required: number;
  pass: boolean;
  adjusted: boolean;
}
export interface ResolvedTokens {
  family: VisualFamily;
  label: string;
  direction: DesignDirection;
  /** Scheme-independent custom properties (name without `--`). */
  base: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
}
export interface CompiledTheme {
  css: string;
  tokens: ResolvedTokens;
  contrast: ContrastResult[];
}

const oklch = (c: z.infer<typeof Color>): Oklch => ({ l: c.$value.components[0], c: c.$value.components[1], h: c.$value.components[2] });
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const rem = (px: number) => `${r4(px / 16)}rem`;
const dimCss = (d: z.infer<typeof Dim>) => `${d.$value.value}${d.$value.unit}`;
const fontStack = (f: z.infer<typeof Font>) => f.$value.map((n) => (/[\s\d]/.test(n) && !n.includes('-') ? `"${n}"` : n)).join(', ');

function resolveScheme(t: FamilyTokens, hue: number, scheme: Scheme, results: ContrastResult[]): Record<string, string> {
  const dir: -1 | 1 = scheme === 'light' ? -1 : 1;
  const n = t.color[scheme];
  const out: Record<string, string> = {};
  for (const k of NEUTRAL_KEYS) out[k] = oklchToHex(oklch(n[k]));
  const surfaces = [out.bg!, out.surface!, out['surface-2']!];
  const record = (pair: string, fg: string, bg: string, required: number, adjusted: boolean) => {
    const ratio = rawContrast(fg, bg);
    results.push({ pair, scheme, ratio: Math.round(ratio * 100) / 100, required, pass: ratio >= required, adjusted });
  };
  const passAll = (hex: string, against: string[], min: number) => against.every((b) => rawContrast(hex, b) >= min);

  // Neutral text: fg and muted must read on every surface.
  for (const k of ['fg', 'fg-muted'] as const) {
    const found = searchLightness(oklch(n[k]), dir, (hex) => passAll(hex, surfaces, 4.5));
    out[k] = found.hex;
    for (const s of ['bg', 'surface', 'surface-2']) record(`${k}/${s}`, found.hex, out[s]!, 4.5, found.steps > 0);
  }
  const ctrl = searchLightness(oklch(n['control-border']), dir, (hex) => passAll(hex, [out.surface!, out.bg!], 3));
  out['control-border'] = ctrl.hex;
  record('control-border/surface', ctrl.hex, out.surface!, 3, ctrl.steps > 0);

  // Accent: usable as text on surfaces and its own soft tint, and as a fill under accent-fg text.
  const a = t.color.accent;
  out['accent-soft'] = oklchToHex({ l: a.softLightness[scheme].$value, c: scheme === 'light' ? 0.03 : 0.05, h: hue });
  const inkCandidates = scheme === 'light' ? ['#ffffff', out.fg!] : [out.bg!, '#ffffff'];
  const pickInk = (hex: string) => inkCandidates.find((ink) => rawContrast(ink, hex) >= 4.5) ?? null;
  const accent = searchLightness(
    { l: a.lightness[scheme].$value, c: a.chroma.$value, h: hue },
    dir,
    (hex) => passAll(hex, [...surfaces, out['accent-soft']!], 4.5) && pickInk(hex) !== null,
  );
  out.accent = accent.hex;
  out['accent-fg'] = pickInk(accent.hex) ?? inkCandidates[0]!;
  out['accent-hover'] = oklchToHex({ l: accent.l + (scheme === 'light' ? -0.06 : 0.06), c: a.chroma.$value, h: hue });
  out['accent-strong'] = oklchToHex({ l: accent.l + (scheme === 'light' ? -0.12 : 0.1), c: a.chroma.$value, h: hue });
  out.focus = out.accent;
  const adj = accent.steps > 0;
  for (const s of ['bg', 'surface', 'surface-2']) record(`accent/${s}`, accent.hex, out[s]!, 4.5, adj);
  record('accent/accent-soft', accent.hex, out['accent-soft']!, 4.5, adj);
  record('fg/accent-soft', out.fg!, out['accent-soft']!, 4.5, false);
  record('accent-fg/accent', out['accent-fg']!, accent.hex, 4.5, adj);
  record('focus/surface', out.focus, out.surface!, 3, adj);
  record('focus/bg', out.focus, out.bg!, 3, adj);

  // Status colours are used as text and icons on their soft tint and on plain surfaces.
  for (const k of STATUS_KEYS) {
    const start = oklch(t.color.status[scheme][k]);
    const soft = oklchToHex({ l: scheme === 'light' ? 0.965 : 0.28, c: scheme === 'light' ? 0.025 : 0.045, h: start.h });
    out[`${k}-soft`] = soft;
    const found = searchLightness(start, dir, (hex) => passAll(hex, [...surfaces, soft], 4.5));
    out[k] = found.hex;
    record(`${k}/surface`, found.hex, out.surface!, 4.5, found.steps > 0);
    record(`${k}/${k}-soft`, found.hex, soft, 4.5, found.steps > 0);
    record(`fg/${k}-soft`, out.fg!, soft, 4.5, false);
  }

  // Data-viz marks are graphical objects: ≥3:1 against the surface.
  for (let i = 1; i <= 6; i++) {
    const key = `viz-${i}`;
    const c = t.color.viz[scheme][key];
    if (!c) throw new Error(`Family is missing ${scheme} ${key}`);
    const found = searchLightness(oklch(c), dir, (hex) => passAll(hex, [out.surface!, out.bg!], 3));
    out[key] = found.hex;
    record(`${key}/surface`, found.hex, out.surface!, 3, found.steps > 0);
  }
  out['shadow-1'] = t.shadow[scheme][1].$value;
  out['shadow-2'] = t.shadow[scheme][2].$value;
  return out;
}

function resolveBase(t: FamilyTokens, d: DesignDirection): Record<string, string> {
  const base = t.type.base.$value.value;
  const ratio = t.type.ratio[d.typeScale].$value;
  const size = (step: number) => base * ratio ** step;
  const compact = d.density === 'compact';
  const out: Record<string, string> = {
    'font-sans': fontStack(t.font.sans),
    'font-serif': fontStack(t.font.serif),
    'font-mono': fontStack(t.font.mono),
    'font-body': fontStack(t.font.body),
    'font-heading': fontStack(t.font.heading),
    'heading-weight': String(t.font.headingWeight.$value),
    'heading-tracking': dimCss(t.font.headingTracking),
    'eyebrow-case': t.font.eyebrowCase.$value,
    'text-xs': rem(size(-2)),
    'text-sm': rem(size(-1)),
    'text-base': rem(size(0)),
    'text-lg': rem(size(1)),
    'text-xl': rem(size(2)),
    // Display sizes shrink fluidly on narrow viewports.
    'text-2xl': `clamp(${rem(size(2.4))}, ${rem(size(1.6))} + 1.2vw, ${rem(size(3))})`,
    'text-3xl': `clamp(${rem(size(2.8))}, ${rem(size(1.8))} + 2vw, ${rem(size(4))})`,
    leading: String(r4(t.type.lineHeight.$value - (compact ? 0.06 : 0))),
    'leading-tight': String(t.type.headingLineHeight.$value),
    measure: '68ch',
    'radius-pill': '999px',
    'duration-fast': `${t.motion.duration.fast.$value.value}ms`,
    'duration-base': `${t.motion.duration.base.$value.value}ms`,
    ease: `cubic-bezier(${t.motion.easing.$value.join(', ')})`,
    'figure-fill-opacity': d.figureStyle === 'filled' ? '0.9' : '0.14',
    'figure-stroke-width': d.figureStyle === 'filled' ? '1' : '1.75',
    'control-size': compact ? '2.5rem' : '2.75rem',
  };
  const unit = t.space.unit.$value.value * (compact ? 0.875 : 1);
  [1, 2, 3, 4, 6, 8, 12, 16].forEach((m, i) => {
    out[`space-${i + 1}`] = rem(Math.round(unit * m * 2) / 2);
  });
  const r = t.radius[d.corner];
  out['radius-sm'] = dimCss(r.sm);
  out['radius-md'] = dimCss(r.md);
  out['radius-lg'] = dimCss(r.lg);
  return out;
}

const decls = (vars: Record<string, string>, indent: string) =>
  Object.keys(vars)
    .sort()
    .map((k) => `${indent}--cf-${k}: ${vars[k]};`)
    .join('\n');

export function compileTheme(direction: DesignDirection): CompiledTheme {
  const t = familyTokens(direction.family);
  const contrast: ContrastResult[] = [];
  const light = resolveScheme(t, direction.accentHue, 'light', contrast);
  const dark = resolveScheme(t, direction.accentHue, 'dark', contrast);
  const base = resolveBase(t, direction);
  const css = [
    '@layer cf.tokens, cf.base, cf.components, cf.utilities;',
    '@layer cf.tokens {',
    `  :root {\n${decls(base, '    ')}\n  }`,
    `  :root, [data-cf-theme="light"] {\n    color-scheme: light;\n${decls(light, '    ')}\n  }`,
    `  @media (prefers-color-scheme: dark) {\n    :root:not([data-cf-theme="light"]) {\n      color-scheme: dark;\n${decls(dark, '      ')}\n    }\n  }`,
    `  [data-cf-theme="dark"] {\n    color-scheme: dark;\n${decls(dark, '    ')}\n  }`,
    '}',
    '',
  ].join('\n');
  return { css, tokens: { family: direction.family, label: t.meta.label.$value, direction, base, light, dark }, contrast };
}

/** Default direction for a family (used by Storybook and fixtures). */
export function defaultDirection(family: VisualFamily): DesignDirection {
  return {
    family,
    accentHue: familyTokens(family).meta.defaultAccentHue.$value,
    density: 'comfortable',
    corner: family === 'technical-industrial' || family === 'editorial-humanities' ? 'sharp' : 'soft',
    typeScale: 'default',
    figureStyle: 'line',
  };
}
