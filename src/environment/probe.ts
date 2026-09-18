/**
 * Everything the doctor needs to know about the machine, behind one interface so checks are testable with fakes.
 * The real probe only reads; the few writes (fs.writable temp file, repairs) go through `canWrite` / `run`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statfsSync, statSync, writeFileSync } from 'node:fs';
import { arch, cpus, freemem, homedir, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashFile } from '../core/hash.js';
import { repoRoot } from '../core/paths.js';
import { runProcess } from '../core/proc.js';

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  spawnError: string | null;
}

export interface EnvProbe {
  platform: NodeJS.Platform;
  release: string;
  arch: string;
  cpu: { model: string; cores: number };
  totalmem: number;
  freemem: number;
  env: Record<string, string | undefined>;
  nodeVersion: string;
  repoRoot: string;
  home: string;
  exists(path: string): boolean;
  readText(path: string): string | null;
  mtimeMs(path: string): number | null;
  listDir(path: string): string[];
  freeDiskBytes(path: string): number | null;
  hashFile(path: string): string | null;
  /** Writes and deletes a temp file in `dir` (creating `dir` if missing). */
  canWrite(dir: string): boolean;
  /** First line of a `--version` style command, or null when absent. */
  version(argv: readonly string[]): Promise<string | null>;
  run(argv: readonly string[], opts?: { timeoutMs?: number }): Promise<RunResult>;
  /** Absolute path of Playwright's bundled Chromium (may not exist on disk), or null if playwright is not importable. */
  chromiumPath(): Promise<string | null>;
  /** `validateConfig` from the routing module, or null if that module is not available. */
  configValidator(): Promise<(() => unknown) | null>;
}

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** Imports a repo-relative module by variable path (so a missing module is a runtime condition, not a type error). */
async function importOptional(relFromHere: string): Promise<Record<string, unknown> | null> {
  try {
    return (await import(new URL(relFromHere, import.meta.url).href)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function loadConfigValidator(): Promise<(() => unknown) | null> {
  const mod = await importOptional('../routing/registries.js');
  const fn = mod?.validateConfig;
  return typeof fn === 'function' ? (fn as () => unknown) : null;
}

export function realProbe(root: string = repoRoot()): EnvProbe {
  const c = cpus();
  return {
    platform: platform(),
    release: release(),
    arch: arch(),
    cpu: { model: c[0]?.model.trim() ?? 'unknown', cores: c.length },
    totalmem: totalmem(),
    freemem: freemem(),
    env: process.env,
    nodeVersion: process.versions.node,
    repoRoot: root,
    home: homedir(),
    exists: (p) => existsSync(p),
    readText: (p) => safe(() => readFileSync(p, 'utf8'), null),
    mtimeMs: (p) => safe(() => statSync(p).mtimeMs, null),
    listDir: (p) => safe(() => readdirSync(p), []),
    freeDiskBytes: (p) =>
      safe(() => {
        const s = statfsSync(p);
        return Number(s.bavail) * Number(s.bsize);
      }, null),
    hashFile: (p) => safe(() => hashFile(p), null),
    canWrite: (dir) =>
      safe(() => {
        mkdirSync(dir, { recursive: true });
        const f = join(dir, `.cf-write-test-${process.pid}`);
        writeFileSync(f, 'ok');
        rmSync(f);
        return true;
      }, false),
    version: async (argv) => {
      const res = await runProcess(argv, { timeoutMs: 20000 });
      if (res.spawnError || res.code !== 0) return null;
      return (res.stdout || res.stderr).trim().split(/\r?\n/)[0]?.trim() || null;
    },
    run: async (argv, opts) => {
      const r = await runProcess(argv, { cwd: root, timeoutMs: opts?.timeoutMs ?? 30000 });
      return { code: r.code, stdout: r.stdout, stderr: r.stderr, spawnError: r.spawnError };
    },
    chromiumPath: async () => {
      const pkg = join(root, 'node_modules', 'playwright', 'index.mjs');
      if (!existsSync(pkg)) return null;
      try {
        const pw = (await import(pathToFileURL(pkg).href)) as { chromium: { executablePath(): string } };
        return pw.chromium.executablePath();
      } catch {
        return null;
      }
    },
    configValidator: loadConfigValidator,
  };
}

/** Memoises process probes (by argv) and chromium lookup for one doctor pass, so checks can share results. */
export function memoProbe(p: EnvProbe): EnvProbe {
  const versions = new Map<string, Promise<string | null>>();
  const runs = new Map<string, Promise<RunResult>>();
  let chromium: Promise<string | null> | null = null;
  const key = (argv: readonly string[]) => JSON.stringify(argv);
  return {
    ...p,
    version: (argv) => {
      const k = key(argv);
      if (!versions.has(k)) versions.set(k, p.version(argv));
      return versions.get(k) as Promise<string | null>;
    },
    run: (argv, opts) => {
      const k = key(argv);
      if (!runs.has(k)) runs.set(k, p.run(argv, opts));
      return runs.get(k) as Promise<RunResult>;
    },
    chromiumPath: () => {
      chromium ??= p.chromiumPath();
      return chromium;
    },
  };
}
