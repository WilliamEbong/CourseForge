/** Lucide icons (ISC) read from the installed `lucide-static` package; only named icons are inlined. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CfError } from '../core/errors.js';
import { repoRoot } from '../core/paths.js';

export const LUCIDE_NOTICE =
  'Icons: Lucide (lucide-static), ISC License. Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.';

const cache = new Map<string, string>();

/** Full Lucide SVG markup, normalised to currentColor + aria-hidden. */
export function lucideSvg(name: string): string {
  if (!/^[a-z0-9-]+$/.test(name)) throw new CfError('ICON_NAME', `Invalid icon name: ${name}`, { kind: 'renderer_failed' });
  const hit = cache.get(name);
  if (hit) return hit;
  let raw: string;
  try {
    raw = readFileSync(join(repoRoot(), 'node_modules', 'lucide-static', 'icons', `${name}.svg`), 'utf8');
  } catch (cause) {
    throw new CfError('ICON_MISSING', `Lucide icon not found: ${name}`, { kind: 'renderer_failed', cause });
  }
  const svg = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r?\n\s*/g, ' ')
    .replace(/\s+>/g, '>')
    .replace(/\s+\/>/g, '/>')
    .replace(/stroke="[^"]*"/, 'stroke="currentColor"')
    .replace(/<svg\b/, '<svg aria-hidden="true" focusable="false"')
    .trim();
  cache.set(name, svg);
  return svg;
}
