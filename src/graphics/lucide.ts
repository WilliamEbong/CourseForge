/** Lucide icons (ISC) from `lucide-static`, inlined as currentColor strokes. */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { xmlEscape } from './theme.js';

const require = createRequire(import.meta.url);
const ICON_DIR = join(dirname(require.resolve('lucide-static/package.json')), 'icons');
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function hasIcon(name: string): boolean {
  return NAME.test(name) && existsSync(join(ICON_DIR, `${name}.svg`));
}

/** Inline SVG for a Lucide icon. Decorative (`aria-hidden`) unless a label is given. */
export function iconSvg(name: string, opts: { size?: number; label?: string | null } = {}): string {
  if (!hasIcon(name)) throw new Error(`Unknown Lucide icon "${name}"`);
  const src = readFileSync(join(ICON_DIR, `${name}.svg`), 'utf8');
  const inner = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(src)?.[1];
  if (!inner) throw new Error(`Malformed Lucide icon "${name}"`);
  const size = opts.size ?? 24;
  const a11y = opts.label ? `role="img" aria-label="${xmlEscape(opts.label)}"` : 'aria-hidden="true" focusable="false"';
  const body = inner.replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="cf-icon cf-icon-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`
  );
}
