import { appendFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { ensureDir, parseWith, readText, withFsRetry } from './fsx.js';

/** Appends one JSON record as a line. Only the parent process appends, so no inter-process locking is needed. */
export function appendJsonl(path: string, record: unknown): void {
  ensureDir(dirname(path));
  withFsRetry(() => appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8'));
}

export function readJsonl<T = unknown>(path: string, schema?: z.ZodType<T>): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  const lines = readText(path).split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const value = JSON.parse(line) as unknown;
    out.push(schema ? parseWith(schema, value, `${path}:${i + 1}`) : (value as T));
  });
  return out;
}

export function toJsonl(records: readonly unknown[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
}
