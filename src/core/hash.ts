import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.ts',
  '.svg',
  '.csv',
  '.xml',
]);

export function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

/** CRLF/CR → LF, so hashes do not depend on the checkout's line-ending policy. */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function sha256(data: string | Uint8Array): string {
  return `sha256:${sha256Hex(data)}`;
}

/** Hash of a file: LF-normalised for text files, raw bytes otherwise. */
export function hashFile(path: string): string {
  const buf = readFileSync(path);
  return hashBytes(buf, path);
}

export function hashBytes(buf: Uint8Array, pathHint: string): string {
  if (isTextPath(pathHint)) return sha256(normalizeNewlines(Buffer.from(buf).toString('utf8')));
  return sha256(buf);
}

/** Deterministic JSON: object keys sorted recursively, no insignificant whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function hashJson(value: unknown): string {
  return sha256(canonicalJson(value));
}

/** Short stable fingerprint for filenames / keys. */
export function shortHash(data: string | Uint8Array, len = 12): string {
  return sha256Hex(data).slice(0, len);
}
