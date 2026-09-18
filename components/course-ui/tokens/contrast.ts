/**
 * Colour math with no dependencies: OKLCH → sRGB (Björn Ottosson's OKLab matrices), WCAG 2.x relative
 * luminance and contrast ratio, and a deterministic lightness search used to make token pairs pass.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const encode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const decode = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

function inGamut(lin: number[]): boolean {
  return lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** OKLCH → `#rrggbb`. Out-of-gamut colours are brought in by reducing chroma (hue and lightness kept). */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  let lin = oklchToLinear({ ...color, c });
  while (!inGamut(lin) && c > 0) {
    c = Math.max(0, c - 0.002);
    lin = oklchToLinear({ ...color, c });
  }
  return `#${lin
    .map((v) =>
      Math.round(clamp01(encode(clamp01(v))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((ch) => ch + ch).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Invalid hex colour: ${hex}`);
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.x relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => decode(v / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Unrounded WCAG contrast ratio (1–21). Use this for pass/fail decisions. */
export function rawContrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG contrast ratio rounded to 2 decimals for reports (`#777` on `#fff` → 4.48). */
export function contrastRatio(a: string, b: string): number {
  return Math.round(rawContrast(a, b) * 100) / 100;
}

/**
 * Move OKLCH lightness in `direction` (−1 darker, +1 lighter) in 0.005 steps until `ok(hex)` holds.
 * Deterministic; returns the first passing colour (or the extreme if none passes).
 */
export function searchLightness(start: Oklch, direction: -1 | 1, ok: (hex: string) => boolean): { hex: string; l: number; steps: number } {
  let l = start.l;
  let steps = 0;
  let hex = oklchToHex({ ...start, l });
  while (!ok(hex) && l > 0 && l < 1) {
    l = Math.round((l + direction * 0.005) * 1000) / 1000;
    steps++;
    hex = oklchToHex({ ...start, l: clamp01(l) });
  }
  return { hex, l, steps };
}
