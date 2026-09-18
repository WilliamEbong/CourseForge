import { describe, expect, it } from 'vitest';
import { compileTheme, defaultDirection, familyTokens } from '../../../components/course-ui/tokens/compile.js';
import { contrastRatio, oklchToHex, relativeLuminance } from '../../../components/course-ui/tokens/contrast.js';
import { VISUAL_FAMILIES } from '../../../src/core/enums.js';

const REQUIRED_VARS = [
  'bg',
  'surface',
  'surface-2',
  'fg',
  'fg-muted',
  'border',
  'accent',
  'accent-fg',
  'accent-soft',
  'focus',
  'success',
  'warning',
  'danger',
  'info',
  ...[1, 2, 3, 4, 5, 6].map((i) => `viz-${i}`),
  'font-sans',
  'font-serif',
  'font-mono',
  'radius-sm',
  'radius-md',
  'radius-lg',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `space-${i}`),
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'shadow-1',
  'shadow-2',
  'measure',
];

describe('colour math', () => {
  it('WCAG contrast of known pairs', () => {
    expect(contrastRatio('#777', '#fff')).toBe(4.48);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#767676', '#ffffff')).toBe(4.54);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
  });

  it('OKLCH → sRGB anchors and gamut mapping', () => {
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff');
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe('#000000');
    // pure sRGB red is oklch(0.628 0.2577 29.23)
    expect(oklchToHex({ l: 0.62796, c: 0.25768, h: 29.2339 })).toBe('#ff0000');
    // absurd chroma is clamped into gamut rather than producing garbage
    expect(oklchToHex({ l: 0.6, c: 0.9, h: 140 })).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('theme compiler', () => {
  it.each([...VISUAL_FAMILIES])('%s: family tokens validate and every pair passes in light and dark for all 24 hues', (family) => {
    expect(familyTokens(family).meta.label.$value.length).toBeGreaterThan(3);
    for (let hue = 0; hue < 360; hue += 15) {
      const { contrast, tokens } = compileTheme({ ...defaultDirection(family), accentHue: hue });
      const failing = contrast.filter((c) => !c.pass);
      expect(failing, `${family} hue ${hue}`).toEqual([]);
      expect(contrast.some((c) => c.scheme === 'dark')).toBe(true);
      expect(tokens.light.accent).not.toBe(tokens.dark.accent);
    }
  });

  it('emits the required CSS variable contract inside @layer cf.tokens for light, dark media and data-cf-theme', () => {
    const { css } = compileTheme(defaultDirection('corporate-professional'));
    expect(css.startsWith('@layer cf.tokens, cf.base, cf.components, cf.utilities;')).toBe(true);
    for (const v of REQUIRED_VARS) expect(css, v).toContain(`--cf-${v}:`);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('[data-cf-theme="dark"]');
    expect(css).toContain('--cf-measure: 68ch;');
  });

  it('is deterministic and responds to the bounded direction', () => {
    const d = defaultDirection('technical-industrial');
    expect(compileTheme(d).css).toBe(compileTheme(d).css);
    const compact = compileTheme({ ...d, density: 'compact', corner: 'round', typeScale: 'generous' }).tokens.base;
    const normal = compileTheme({ ...d, density: 'comfortable', corner: 'sharp', typeScale: 'compact' }).tokens.base;
    expect(compact['space-4']).not.toBe(normal['space-4']);
    expect(compact['radius-md']).not.toBe(normal['radius-md']);
    expect(compact['text-xl']).not.toBe(normal['text-xl']);
  });

  it('families are genuinely distinct', () => {
    const sigs = VISUAL_FAMILIES.map((f) => {
      const t = compileTheme(defaultDirection(f)).tokens;
      return `${t.light.bg}|${t.base['font-heading']}|${t.base['radius-md']}|${t.light['viz-2']}`;
    });
    expect(new Set(sigs).size).toBe(VISUAL_FAMILIES.length);
  });

  it('records deterministic adjustments with adjusted: true', () => {
    // Some hue/family combinations start below target and must be moved along OKLCH lightness.
    const adjusted = [0, 45, 90, 135, 195, 270].flatMap((accentHue) =>
      compileTheme({ ...defaultDirection('technical-industrial'), accentHue }).contrast.filter((c) => c.adjusted),
    );
    expect(adjusted.length).toBeGreaterThan(0);
    expect(adjusted.every((c) => c.pass)).toBe(true);
  });
});
