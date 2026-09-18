/**
 * Identifier grammar. The kind of an ID is determined by the artifact it lives in, never parsed from the
 * text, so imported mnemonic IDs (`AB-OHS-4`, `LO4`, `T3-07`, `GA-15`, `V-07`) are preserved verbatim.
 */
import { randomBytes } from 'node:crypto';

export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[-_.][A-Za-z0-9]+)*$/;
export const ID_MAX = 60;

export function isValidId(id: string): boolean {
  return id.length <= ID_MAX && ID_PATTERN.test(id);
}

/** `AB-OHS-4 s.21` → `{ sourceId: 'AB-OHS-4', locator: 's.21' }` (locator = everything after the first space). */
export function splitCitationToken(token: string): { sourceId: string; locator: string | null } {
  const t = token.trim();
  const i = t.search(/\s/);
  if (i === -1) return { sourceId: t, locator: null };
  return { sourceId: t.slice(0, i), locator: t.slice(i + 1).trim() || null };
}

/** Next sequential ID like `CLM-0007` given existing IDs with the same prefix. */
export function nextSequentialId(prefix: string, existing: Iterable<string>, width = 4): string {
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}-(\\d+)$`);
  for (const id of existing) {
    const m = re.exec(id);
    if (m?.[1]) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}

export function formatSeq(prefix: string, n: number, width = 4): string {
  return `${prefix}-${String(n).padStart(width, '0')}`;
}

export function slugify(text: string, max = 48): string {
  const s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return s || 'course';
}

/** Compact UTC timestamp used in run IDs: `20260918T154512Z`. */
export function compactTimestamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function newRunId(now: Date = new Date(), suffix?: string): string {
  return `RUN-${compactTimestamp(now)}-${suffix ?? randomBytes(2).toString('hex')}`;
}
