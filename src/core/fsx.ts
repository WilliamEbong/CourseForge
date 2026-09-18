/**
 * Filesystem helpers with the safety properties CourseForge relies on:
 * atomic writes (temp + rename) with retry on transient Windows/sync/AV locks, schema-validated reads,
 * a per-course exclusive lock, and a deterministic directory walk for write audits.
 */
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import YAML from 'yaml';
import type { z } from 'zod';
import { EXIT } from './enums.js';
import { CfError } from './errors.js';
import { hashFile } from './hash.js';

const TRANSIENT = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY']);

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Retries a sync fs operation on transient lock errors (5 attempts, 50·2ⁿ ms). */
export function withFsRetry<T>(op: () => T, attempts = 5): T {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return op();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !TRANSIENT.has(code) || i === attempts - 1) throw err;
      last = err;
      sleepSync(50 * 2 ** i);
    }
  }
  throw last;
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function exists(path: string): boolean {
  return existsSync(path);
}

/** Writes via a temp file in the same directory, fsyncs, then renames over the target. */
export function writeAtomic(path: string, data: string | Uint8Array): void {
  ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.${Date.now().toString(36)}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, typeof data === 'string' ? Buffer.from(data, 'utf8') : data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    withFsRetry(() => renameSync(tmp, path));
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/** Stable pretty JSON with a trailing newline (LF). */
export function toJsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeJson(path: string, value: unknown): void {
  writeAtomic(path, toJsonText(value));
}

export function readText(path: string): string {
  return withFsRetry(() => readFileSync(path, 'utf8'));
}

export function readJson<T = unknown>(path: string, schema?: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(readText(path));
  } catch (err) {
    throw new CfError('JSON_INVALID', `Cannot parse JSON file ${path}: ${(err as Error).message}`, {
      exitCode: EXIT.USAGE,
      kind: 'input_invalid',
    });
  }
  return schema ? parseWith(schema, raw, path) : (raw as T);
}

export function readYaml<T = unknown>(path: string, schema?: z.ZodType<T>): T {
  const raw = YAML.parse(readText(path));
  return schema ? parseWith(schema, raw, path) : (raw as T);
}

export function writeYaml(path: string, value: unknown): void {
  writeAtomic(path, YAML.stringify(value, { lineWidth: 0 }));
}

/** Parses with a zod schema and throws a CfError naming the file and the failing paths. */
export function parseWith<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const res = schema.safeParse(value);
  if (!res.success) {
    const issues = res.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new CfError('SCHEMA_INVALID', `${label} failed schema validation:\n  ${issues.join('\n  ')}`, {
      exitCode: EXIT.USAGE,
      kind: 'schema_invalid',
      detail: { issues },
    });
  }
  return res.data;
}

export function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  withFsRetry(() => copyFileSync(src, dest));
}

export function removePath(path: string): void {
  withFsRetry(() => rmSync(path, { recursive: true, force: true }));
}

/** Forward-slash relative path (stable across OSes, used in manifests and logs). */
export function relPath(from: string, to: string): string {
  return relative(from, to).split(sep).join('/');
}

/**
 * Deterministic recursive listing of files (forward-slash relative paths, sorted).
 * `exclude` holds relative directory prefixes to skip (e.g. `logs/`).
 */
export function walkFiles(root: string, exclude: string[] = []): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const visit = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      const rel = relPath(root, abs);
      if (exclude.some((p) => rel === p.replace(/\/$/, '') || rel.startsWith(p.endsWith('/') ? p : `${p}/`))) continue;
      const st = statSync(abs);
      if (st.isDirectory()) visit(abs);
      else if (st.isFile()) out.push(rel);
    }
  };
  visit(root);
  return out;
}

/** Map of relative path → content hash for every file under root (used by the write audit). */
export function hashTree(root: string, exclude: string[] = []): Map<string, string> {
  const map = new Map<string, string>();
  for (const rel of walkFiles(root, exclude)) map.set(rel, hashFile(join(root, rel)));
  return map;
}

export interface TreeDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export function diffTrees(before: Map<string, string>, after: Map<string, string>): TreeDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [k, v] of after) {
    if (!before.has(k)) added.push(k);
    else if (before.get(k) !== v) changed.push(k);
  }
  for (const k of before.keys()) if (!after.has(k)) removed.push(k);
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

/* ----------------------------------------------------------------------- lock */

export interface LockInfo {
  pid: number;
  host: string;
  startedAt: string;
  cmd: string;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Takes the exclusive per-course lock (`<courseDir>/.lock`). A lock left by a dead process on the same host
 * is stolen (and reported via `onSteal`); otherwise a CfError with exit code 5 is thrown.
 */
export function acquireLock(courseDir: string, cmd: string, onSteal?: (prev: LockInfo) => void): () => void {
  const lockPath = join(courseDir, '.lock');
  const info: LockInfo = { pid: process.pid, host: hostname(), startedAt: new Date().toISOString(), cmd };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockPath, 'wx');
      writeSync(fd, JSON.stringify(info));
      closeSync(fd);
      return () => {
        try {
          unlinkSync(lockPath);
        } catch {
          /* already gone */
        }
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      let prev: LockInfo | null = null;
      try {
        prev = JSON.parse(readFileSync(lockPath, 'utf8')) as LockInfo;
      } catch {
        prev = null;
      }
      if (prev && prev.host === info.host && !pidAlive(prev.pid)) {
        onSteal?.(prev);
        withFsRetry(() => unlinkSync(lockPath));
        continue;
      }
      throw new CfError(
        'COURSE_LOCKED',
        `Course is locked by ${prev ? `pid ${prev.pid} (${prev.cmd}) since ${prev.startedAt}` : 'another process'}`,
        {
          exitCode: EXIT.COURSE_LOCKED,
        },
      );
    }
  }
  throw new CfError('COURSE_LOCKED', 'Could not acquire course lock', { exitCode: EXIT.COURSE_LOCKED });
}

export function writeFileRaw(path: string, data: string | Uint8Array): void {
  ensureDir(dirname(path));
  withFsRetry(() => writeFileSync(path, data));
}
