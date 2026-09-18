/**
 * Section locks. JSON artifacts: the region is the first object (depth-first) whose `id` equals the locked ID,
 * hashed as key-sorted canonical JSON. Markdown/other text: the region starts at `<!-- cf:id X -->` and runs to the
 * next heading of the same or higher level than the marker's heading, the next marker, or EOF.
 */
import { join } from 'node:path';
import { exists, readText } from '../core/fsx.js';
import { hashFile, hashJson, normalizeNewlines, sha256 } from '../core/hash.js';
import type { ArtifactRecord } from '../core/schemas/index.js';

function findById(value: unknown, id: string): unknown {
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = findById(v, id);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.id === id) return obj;
    for (const v of Object.values(obj)) {
      const hit = findById(v, id);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

const MARKER = /^\s*<!--\s*cf:id\s+(\S+)\s*-->\s*$/;
const HEADING = /^(#{1,6})\s/;

function markdownRegion(lines: string[], id: string): string | null {
  const start = lines.findIndex((l) => MARKER.exec(l)?.[1] === id);
  if (start === -1) return null;
  // The marker's heading is the first non-blank line after it when that line is a heading;
  // otherwise the marker sits inside the section of the nearest preceding heading.
  let i = start + 1;
  while (i < lines.length && lines[i]?.trim() === '') i++;
  let level = 7;
  let scanFrom = start + 1;
  const own = HEADING.exec(lines[i] ?? '');
  if (own?.[1]) {
    level = own[1].length;
    scanFrom = i + 1;
  } else {
    for (let j = start - 1; j >= 0; j--) {
      const h = HEADING.exec(lines[j] ?? '');
      if (h?.[1]) {
        level = h[1].length;
        break;
      }
    }
  }
  let end = lines.length;
  for (let j = scanFrom; j < lines.length; j++) {
    const l = lines[j] ?? '';
    const h = HEADING.exec(l);
    if (MARKER.test(l) || (h?.[1] && h[1].length <= level)) {
      end = j;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trimEnd();
}

/** Hash of each ID's region, or null when the ID is not found in the content. */
export function regionHashes(content: string, path: string, ids: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const lower = path.toLowerCase();
  if (lower.endsWith('.json') || lower.endsWith('.jsonl')) {
    const doc: unknown = lower.endsWith('.jsonl')
      ? content
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => JSON.parse(l) as unknown)
      : JSON.parse(content);
    for (const id of ids) {
      const hit = findById(doc, id);
      out[id] = hit === undefined ? null : hashJson(hit);
    }
    return out;
  }
  const lines = normalizeNewlines(content).split('\n');
  for (const id of ids) {
    const region = markdownRegion(lines, id);
    out[id] = region === null ? null : sha256(region);
  }
  return out;
}

export interface LockViolation {
  id: string;
  expected: string;
  actual: string | null;
}

/** Compares a record's locks against the file on disk (whole-artifact hash and per-ID region hashes). */
export function verifyLocks(courseDir: string, record: ArtifactRecord): LockViolation[] {
  const abs = join(courseDir, record.path);
  const present = exists(abs);
  const violations: LockViolation[] = [];
  if (record.locked) {
    const actual = present ? hashFile(abs) : null;
    if (actual !== record.hash) violations.push({ id: record.artifactId, expected: record.hash, actual });
  }
  if (record.lockedIds.length) {
    let actual: Record<string, string | null> = {};
    if (present) {
      try {
        actual = regionHashes(
          readText(abs),
          record.path,
          record.lockedIds.map((l) => l.id),
        );
      } catch {
        actual = {}; // unparseable file: every locked region counts as missing
      }
    }
    for (const l of record.lockedIds) {
      const a = actual[l.id] ?? null;
      if (a !== l.hash) violations.push({ id: l.id, expected: l.hash, actual: a });
    }
  }
  return violations;
}
