/** In-memory EnvProbe for doctor tests. Paths are normalised, so tests can build them with `join`. */
import { join, normalize } from 'node:path';
import { SCHEMAS } from '../../../src/core/schemas/index.js';
import type { EnvProbe, RunResult } from '../../../src/environment/probe.js';

export const REPO = join('/', 'work', 'CourseForge');
export const HOME = join('/', 'home', 'ada');

export interface FakeSpec {
  files?: Record<string, string>;
  mtimes?: Record<string, number>;
  /** keyed by argv joined with spaces; missing = tool absent */
  versions?: Record<string, string | null>;
  runs?: Record<string, Partial<RunResult>>;
  chromium?: string | null;
  validator?: (() => unknown) | null;
  unwritable?: string[];
  overrides?: Partial<EnvProbe>;
}

export const r = (...parts: string[]) => normalize(join(REPO, ...parts));

/** A healthy machine: every check passes except advisory ones the spec adds. */
export function healthyFiles(): Record<string, string> {
  const files: Record<string, string> = {
    [r('package-lock.json')]: '{"lockfileVersion":3}',
    [r('node_modules', '.package-lock.json')]: '{}',
    [r('dist', 'src', 'cli', 'main.js')]: '',
    [r('src', 'cli', 'main.ts')]: '',
    [r('CLAUDE.md')]: '#',
    [r('AGENTS.md')]: '#',
    [r('.claude', 'settings.json')]: '{}',
    [r('.claude', 'skills', 'demo', 'SKILL.md')]: '---\nname: demo\ndescription: a demo skill\n---\nbody',
    [join('/', 'ms-playwright', 'chrome.exe')]: '',
  };
  for (const pkg of [
    'playwright',
    '@playwright/test',
    'mermaid',
    '@svgdotjs/svg.js',
    'vega',
    'vega-lite',
    'd3',
    'zod',
    'yaml',
    'marked',
    'cheerio',
    'esbuild',
    'cross-spawn',
    'mammoth',
    'unpdf',
    'axe-core',
    '@axe-core/playwright',
    'lucide-static',
    'storybook',
  ]) {
    files[r('node_modules', ...pkg.split('/'), 'package.json')] = JSON.stringify({ version: '1.0.0' });
  }
  for (const name of Object.keys(SCHEMAS)) files[r('schemas', `${name}.schema.json`)] = '{}';
  return files;
}

export function fakeProbe(spec: FakeSpec = {}): EnvProbe & { calls: string[] } {
  const files = new Map(Object.entries(spec.files ?? healthyFiles()).map(([k, v]) => [normalize(k), v]));
  const mtimes = new Map(Object.entries(spec.mtimes ?? {}).map(([k, v]) => [normalize(k), v]));
  const versions: Record<string, string | null> = {
    'npm --version': '11.11.0',
    'git --version': 'git version 2.48.1',
    ...spec.versions,
  };
  const calls: string[] = [];
  const isDirPrefix = (p: string) => {
    const pre = normalize(p).replace(/[\\/]$/, '');
    return [...files.keys()].some((f) => f.startsWith(pre + (pre.includes('\\') ? '\\' : '/')));
  };
  return {
    calls,
    platform: 'linux',
    release: '6.0',
    arch: 'x64',
    cpu: { model: 'Fake CPU', cores: 8 },
    totalmem: 16 * 1024 ** 3,
    freemem: 8 * 1024 ** 3,
    env: {},
    nodeVersion: '24.14.1',
    repoRoot: REPO,
    home: HOME,
    exists: (p) => files.has(normalize(p)) || isDirPrefix(p),
    readText: (p) => files.get(normalize(p)) ?? null,
    mtimeMs: (p) => mtimes.get(normalize(p)) ?? (files.has(normalize(p)) ? 1000 : null),
    listDir: (p) => {
      const pre = normalize(p).replace(/[\\/]$/, '');
      const names = new Set<string>();
      for (const f of files.keys()) {
        if (f.startsWith(pre) && f.length > pre.length && /[\\/]/.test(f[pre.length] ?? '')) {
          const name = f.slice(pre.length + 1).split(/[\\/]/)[0];
          if (name) names.add(name);
        }
      }
      return [...names];
    },
    freeDiskBytes: () => 100 * 1024 ** 3,
    hashFile: (p) => (files.has(normalize(p)) ? `sha256:${files.get(normalize(p))?.length}` : null),
    canWrite: (d) => !(spec.unwritable ?? []).some((u) => normalize(d).endsWith(u)),
    version: async (argv) => {
      const k = argv.join(' ');
      calls.push(`version ${k}`);
      return versions[k] ?? null;
    },
    run: async (argv) => {
      const k = argv.join(' ');
      calls.push(`run ${k}`);
      return { code: 0, stdout: '', stderr: '', spawnError: null, ...spec.runs?.[k] };
    },
    chromiumPath: async () => (spec.chromium === undefined ? join('/', 'ms-playwright', 'chrome.exe') : spec.chromium),
    configValidator: async () => (spec.validator === undefined ? () => ({ ok: true }) : spec.validator),
    ...spec.overrides,
  };
}
