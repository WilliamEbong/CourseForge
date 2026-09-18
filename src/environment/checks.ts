/**
 * Doctor check catalogue. Each check inspects the machine through an injectable `EnvProbe` and returns an outcome;
 * repairable checks carry a repo-local `repair`. Nothing here ever writes outside the repository: global agent
 * configuration is only inspected for presence (never modified, credential files never read).
 */
import { join } from 'node:path';
import { writeJson } from '../core/fsx.js';
import { SCHEMAS } from '../core/schemas/index.js';
import type { DoctorCheck } from '../core/schemas/reports.js';
import type { EnvProbe } from './probe.js';

export type CheckOutcome = Pick<DoctorCheck, 'status' | 'classification' | 'message' | 'repair'>;

export interface DoctorCheckDef {
  id: string;
  title: string;
  run(p: EnvProbe): Promise<CheckOutcome>;
  /** Repo-local fix; resolves with a short description, rejects on failure. */
  repair?(p: EnvProbe): Promise<string>;
}

export const NODE_REQUIRED = '22.12.0';
export const NPM_MIN_MAJOR = 10;
export const DISK_MIN_GB = 5;
export const RAM_ADVISORY_GB = 2;

export const REQUIRED_PACKAGES = [
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
] as const;

const REPAIR = {
  longpaths: 'git config --local core.longpaths true',
  deps: 'npm ci',
  chromium: 'npx playwright install chromium',
  build: 'npm run build',
  schemas: 'npm run gen:schemas',
} as const;

/* -------------------------------------------------------------------- outcomes */

const pass = (message: string): CheckOutcome => ({ status: 'pass', classification: 'ready', message, repair: null });
const advise = (message: string, repair: string | null = null): CheckOutcome => ({
  status: 'warn',
  classification: 'advisory',
  message,
  repair,
});
const fail = (classification: 'repairable' | 'manual', message: string, repair: string): CheckOutcome => ({
  status: 'fail',
  classification,
  message,
  repair,
});
const skip = (message: string): CheckOutcome => ({ status: 'skip', classification: 'ready', message, repair: null });

/* --------------------------------------------------------------- shared facts */

/** Leading `major.minor.patch` numbers found anywhere in a version string (`v24.1.0`, `git version 2.48.1.windows.1`). */
export function parseVersion(text: string | null): [number, number, number] | null {
  const m = text?.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

export function versionAtLeast(actual: string | null, required: string): boolean {
  const a = parseVersion(actual);
  const r = parseVersion(required);
  if (!a || !r) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== r[i]) return (a[i] as number) > (r[i] as number);
  return true;
}

export const npmVersion = (p: EnvProbe) => p.version(['npm', '--version']);
export const gitVersion = (p: EnvProbe) => p.version(['git', '--version']);
export const claudeVersion = (p: EnvProbe) => p.version(['claude', '--version']);
export const codexVersion = (p: EnvProbe) => p.version(['codex', '--version']);

/** `claude auth status --json` → `loggedIn`. Only that boolean is kept (the output also carries account details). */
export async function claudeAuth(p: EnvProbe): Promise<boolean | null> {
  if (!(await claudeVersion(p))) return null;
  const r = await p.run(['claude', 'auth', 'status', '--json']);
  try {
    const parsed = JSON.parse(r.stdout) as { loggedIn?: unknown };
    return typeof parsed.loggedIn === 'boolean' ? parsed.loggedIn : null;
  } catch {
    return null;
  }
}

/** `codex login status` exits 0 when logged in. */
export async function codexAuth(p: EnvProbe): Promise<boolean | null> {
  if (!(await codexVersion(p))) return null;
  const r = await p.run(['codex', 'login', 'status']);
  return r.spawnError ? null : r.code === 0;
}

function jsonKeys(p: EnvProbe, path: string): string[] {
  const text = p.readText(path);
  if (!text) return [];
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : [];
  } catch {
    return [];
  }
}

/** User-global Claude Code configuration that would influence a spawned `claude` unless the adapter isolates it. */
export function claudeGlobalConfig(p: EnvProbe): string[] {
  const dir = join(p.home, '.claude');
  const found: string[] = [];
  const keys = jsonKeys(p, join(dir, 'settings.json'));
  for (const k of ['hooks', 'enabledPlugins', 'mcpServers', 'outputStyle'])
    if (keys.includes(k)) found.push(`~/.claude/settings.json#${k}`);
  for (const f of ['CLAUDE.md', 'rules', 'skills', 'agents']) if (p.exists(join(dir, f))) found.push(`~/.claude/${f}`);
  return found;
}

export function codexGlobalConfig(p: EnvProbe): string[] {
  const dir = join(p.home, '.codex');
  return ['AGENTS.md', 'config.toml', 'rules'].filter((f) => p.exists(join(dir, f))).map((f) => `~/.codex/${f}`);
}

const lower = (s: string) => s.replace(/\\/g, '/').toLowerCase();

export function detectCloudSync(p: EnvProbe): { detected: boolean; provider: string | null } {
  const root = lower(p.repoRoot);
  for (const name of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
    const v = p.env[name];
    if (v && root.startsWith(lower(v).replace(/\/$/, ''))) return { detected: true, provider: 'OneDrive' };
  }
  const heuristics: [RegExp, string][] = [
    [/\/onedrive( - [^/]+)?\//, 'OneDrive'],
    [/\/dropbox\//, 'Dropbox'],
    [/\/(google ?drive|my drive)\//, 'Google Drive'],
    [/\/(icloud ?drive|mobile documents|com~apple~clouddocs)\//, 'iCloud'],
  ];
  for (const [re, provider] of heuristics) if (re.test(`${root}/`)) return { detected: true, provider };
  return { detected: false, provider: null };
}

export function packageVersion(p: EnvProbe, name: string): string | null {
  const text = p.readText(join(p.repoRoot, 'node_modules', ...name.split('/'), 'package.json'));
  if (!text) return null;
  try {
    const v = (JSON.parse(text) as { version?: unknown }).version;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

function systemBrowserChannel(p: EnvProbe): string | null {
  const e = p.env;
  const candidates: [string, string | undefined][] =
    p.platform === 'win32'
      ? [
          ['msedge', e['ProgramFiles(x86)'] && join(e['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
          ['msedge', e.ProgramFiles && join(e.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
          ['chrome', e.ProgramFiles && join(e.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe')],
          ['chrome', e.LOCALAPPDATA && join(e.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')],
        ]
      : p.platform === 'darwin'
        ? [
            ['msedge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
            ['chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
          ]
        : [
            ['msedge', '/usr/bin/microsoft-edge'],
            ['chrome', '/usr/bin/google-chrome'],
          ];
  for (const [channel, path] of candidates) if (path && p.exists(path)) return channel;
  return null;
}

/** Bundled Chromium if present, else a system Edge/Chrome channel usable as a fallback. */
export async function browserStatus(p: EnvProbe): Promise<{ chromium: boolean; source: string | null }> {
  const exe = await p.chromiumPath();
  if (exe && p.exists(exe)) return { chromium: true, source: 'bundled' };
  const channel = systemBrowserChannel(p);
  return { chromium: false, source: channel ? `channel:${channel}` : null };
}

export interface LocalState {
  lockHash?: string;
  buildHash?: string;
  [k: string]: unknown;
}

export const statePath = (p: EnvProbe) => join(p.repoRoot, '.courseforge', 'state.json');

export function readState(p: EnvProbe): LocalState {
  try {
    return JSON.parse(p.readText(statePath(p)) ?? '{}') as LocalState;
  } catch {
    return {};
  }
}

/** Newest mtime of any `.ts` file under the given directories (recursive). */
function newestTsMtime(p: EnvProbe, dirs: string[]): number {
  let newest = 0;
  const visit = (dir: string) => {
    for (const name of p.listDir(dir)) {
      if (name === 'node_modules') continue;
      const abs = join(dir, name);
      if (name.endsWith('.ts')) newest = Math.max(newest, p.mtimeMs(abs) ?? 0);
      else if (!name.includes('.')) visit(abs);
    }
  };
  for (const d of dirs) visit(d);
  return newest;
}

async function runOrThrow(p: EnvProbe, argv: string[], timeoutMs: number): Promise<void> {
  const r = await p.run(argv, { timeoutMs });
  if (r.spawnError || r.code !== 0) {
    const tail = `${r.stderr}\n${r.stdout}`.trim().split(/\r?\n/).slice(-8).join('\n');
    throw new Error(`${argv.join(' ')} failed (${r.spawnError ?? `exit ${r.code}`})${tail ? `:\n${tail}` : ''}`);
  }
}

const nodeBin = (p: EnvProbe, ...rel: string[]) => join(p.repoRoot, 'node_modules', ...rel);

async function npmCi(p: EnvProbe): Promise<string> {
  await runOrThrow(p, ['npm', 'ci', '--no-audit', '--no-fund'], 20 * 60_000);
  const lockHash = p.hashFile(join(p.repoRoot, 'package-lock.json'));
  if (lockHash) writeJson(statePath(p), { ...readState(p), lockHash });
  return 'npm ci completed';
}

/* ------------------------------------------------------------------ catalogue */

export const CHECKS: DoctorCheckDef[] = [
  {
    id: 'os.platform',
    title: 'Operating system',
    run: async (p) => {
      const msg = `${p.platform} ${p.release} ${p.arch}`;
      return ['win32', 'darwin', 'linux'].includes(p.platform) ? pass(msg) : advise(`${msg} is not a tested platform`);
    },
  },
  {
    id: 'os.ram',
    title: 'Free memory',
    run: async (p) => {
      const free = p.freemem / 1024 ** 3;
      const msg = `${free.toFixed(1)} GB free of ${(p.totalmem / 1024 ** 3).toFixed(1)} GB`;
      return free < RAM_ADVISORY_GB ? advise(`${msg}; browser QA and agent pools run slowly below ${RAM_ADVISORY_GB} GB`) : pass(msg);
    },
  },
  {
    id: 'os.disk',
    title: 'Free disk space',
    run: async (p) => {
      const bytes = p.freeDiskBytes(p.repoRoot);
      if (bytes === null) return skip('free space could not be determined');
      const gb = bytes / 1024 ** 3;
      return gb < DISK_MIN_GB
        ? advise(`${gb.toFixed(1)} GB free; at least ${DISK_MIN_GB} GB recommended`)
        : pass(`${gb.toFixed(0)} GB free`);
    },
  },
  {
    id: 'node.version',
    title: 'Node.js',
    run: async (p) =>
      versionAtLeast(p.nodeVersion, NODE_REQUIRED)
        ? pass(`v${p.nodeVersion}`)
        : fail(
            'manual',
            `v${p.nodeVersion} is older than the required ${NODE_REQUIRED}`,
            p.platform === 'win32'
              ? 'winget install OpenJS.NodeJS.LTS'
              : 'install Node.js 24 LTS (brew install node@24, or fnm install 24)',
          ),
  },
  {
    id: 'npm.version',
    title: 'npm',
    run: async (p) => {
      const v = await npmVersion(p);
      if (!v) return fail('manual', 'npm not found', 'reinstall Node.js (npm ships with it)');
      return (parseVersion(v)?.[0] ?? 0) >= NPM_MIN_MAJOR
        ? pass(v)
        : fail('manual', `npm ${v} is older than ${NPM_MIN_MAJOR}`, 'npm i --global npm@latest (run it yourself)');
    },
  },
  {
    id: 'git.present',
    title: 'Git',
    run: async (p) => {
      const v = await gitVersion(p);
      return v ? pass(v) : advise('git not found; needed only for cloning and version control', 'install Git from https://git-scm.com');
    },
  },
  {
    id: 'git.longpaths',
    title: 'Git long paths (Windows)',
    run: async (p) => {
      if (p.platform !== 'win32') return skip('not Windows');
      if (!p.exists(join(p.repoRoot, '.git')) || !(await gitVersion(p))) return skip('not a git checkout');
      const r = await p.run(['git', 'config', '--get', 'core.longpaths']);
      return r.stdout.trim() === 'true'
        ? pass('core.longpaths=true')
        : {
            status: 'warn',
            classification: 'repairable',
            message: 'core.longpaths is not enabled for this repository',
            repair: REPAIR.longpaths,
          };
    },
    repair: async (p) => {
      await runOrThrow(p, ['git', 'config', '--local', 'core.longpaths', 'true'], 15000);
      return 'enabled core.longpaths (repository-local)';
    },
  },
  {
    id: 'git.autocrlf',
    title: 'Git line endings',
    run: async (p) => {
      if (!(await gitVersion(p))) return skip('git not found');
      const r = await p.run(['git', 'config', '--get', 'core.autocrlf']);
      const v = r.stdout.trim();
      return v === 'true'
        ? advise('core.autocrlf=true; .gitattributes keeps sources LF, hashes are LF-normalised anyway')
        : pass(`core.autocrlf=${v || 'unset'}`);
    },
  },
  {
    id: 'path.cloudsync',
    title: 'Cloud-synced folder',
    run: async (p) => {
      const { detected, provider } = detectCloudSync(p);
      return detected
        ? advise(`repository is inside a ${provider} folder; if sync is active, pause it or move the repo to avoid file locks`)
        : pass('not inside a known cloud-sync folder');
    },
  },
  {
    id: 'path.length',
    title: 'Repository path length',
    run: async (p) =>
      p.platform === 'win32' && p.repoRoot.length > 120
        ? advise(`${p.repoRoot.length} characters; deep node_modules paths may exceed Windows limits`)
        : pass(`${p.repoRoot.length} characters`),
  },
  {
    id: 'deps.lock',
    title: 'Installed dependencies match lockfile',
    run: async (p) => {
      const lock = join(p.repoRoot, 'package-lock.json');
      const hidden = join(p.repoRoot, 'node_modules', '.package-lock.json');
      if (!p.exists(lock)) return fail('manual', 'package-lock.json is missing', 'restore package-lock.json from git');
      if (!p.exists(hidden)) return fail('repairable', 'node_modules is missing or incomplete', REPAIR.deps);
      const recorded = readState(p).lockHash;
      if (recorded) {
        return recorded === p.hashFile(lock)
          ? pass('lockfile unchanged since last install')
          : fail('repairable', 'package-lock.json changed since the last install', REPAIR.deps);
      }
      // No fingerprint recorded (installed outside setup): npm rewrites node_modules/.package-lock.json on install.
      return (p.mtimeMs(hidden) ?? 0) >= (p.mtimeMs(lock) ?? 0)
        ? pass('node_modules is newer than package-lock.json')
        : fail('repairable', 'package-lock.json is newer than node_modules', REPAIR.deps);
    },
    repair: npmCi,
  },
  {
    id: 'deps.packages',
    title: 'Required packages',
    run: async (p) => {
      const missing = REQUIRED_PACKAGES.filter((n) => !packageVersion(p, n));
      return missing.length
        ? fail('repairable', `missing: ${missing.join(', ')}`, REPAIR.deps)
        : pass(`${REQUIRED_PACKAGES.length} packages present`);
    },
    repair: npmCi,
  },
  {
    id: 'pw.chromium',
    title: 'Playwright Chromium',
    run: async (p) => {
      const b = await browserStatus(p);
      if (b.chromium) return pass(`bundled Chromium (playwright ${packageVersion(p, 'playwright') ?? '?'})`);
      if (b.source)
        return {
          status: 'warn',
          classification: 'repairable',
          message: `bundled Chromium missing; system browser available as fallback (${b.source})`,
          repair: REPAIR.chromium,
        };
      return fail('repairable', 'no Chromium available for rendering and QA', REPAIR.chromium);
    },
    repair: async (p) => {
      await runOrThrow(p, [process.execPath, nodeBin(p, 'playwright', 'cli.js'), 'install', 'chromium'], 20 * 60_000);
      return 'installed Playwright Chromium into the shared browser cache';
    },
  },
  {
    id: 'build.dist',
    title: 'Compiled CLI (dist)',
    run: async (p) => {
      const main = join(p.repoRoot, 'dist', 'src', 'cli', 'main.js');
      const built = p.mtimeMs(main);
      if (built === null) return fail('repairable', 'dist/ has not been built', REPAIR.build);
      const newest = newestTsMtime(p, [join(p.repoRoot, 'src'), join(p.repoRoot, 'components', 'course-ui', 'src')]);
      return built >= newest ? pass('dist is up to date') : fail('repairable', 'sources changed since the last build', REPAIR.build);
    },
    repair: async (p) => {
      await runOrThrow(
        p,
        [process.execPath, nodeBin(p, 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.build.json', '--noEmitOnError'],
        10 * 60_000,
      );
      return 'rebuilt dist/';
    },
  },
  {
    id: 'config.valid',
    title: 'Registries (config/*.json)',
    run: async (p) => {
      const validate = await p.configValidator();
      if (!validate) return advise('routing module not available');
      try {
        const res = validate() as { ok?: unknown; errors?: unknown } | undefined;
        if (res && res.ok === false) {
          const errs = Array.isArray(res.errors) ? res.errors.map(String).slice(0, 3).join('; ') : 'invalid';
          return fail('manual', errs, 'fix config/*.json (see courseforge validate-config)');
        }
        return pass('all registries valid');
      } catch (err) {
        return fail('manual', err instanceof Error ? (err.message.split('\n')[0] ?? 'invalid') : String(err), 'fix config/*.json');
      }
    },
  },
  {
    id: 'schemas.drift',
    title: 'Generated JSON schemas',
    run: async (p) => {
      const missing = Object.keys(SCHEMAS).filter((n) => !p.exists(join(p.repoRoot, 'schemas', `${n}.schema.json`)));
      return missing.length
        ? fail(
            'repairable',
            `missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5})` : ''}`,
            REPAIR.schemas,
          )
        : pass(`${Object.keys(SCHEMAS).length} schema files present`);
    },
    repair: async (p) => {
      await runOrThrow(p, [process.execPath, nodeBin(p, 'tsx', 'dist', 'cli.mjs'), 'scripts/gen-schemas.ts'], 120_000);
      return 'regenerated schemas/';
    },
  },
  {
    id: 'project.instructions',
    title: 'Project agent instructions and skills',
    run: async (p) => {
      const missing = ['CLAUDE.md', 'AGENTS.md', join('.claude', 'settings.json')].filter((f) => !p.exists(join(p.repoRoot, f)));
      const skillsDir = join(p.repoRoot, '.claude', 'skills');
      const skills = p.listDir(skillsDir);
      const bad = skills.filter((s) => {
        const fm = p.readText(join(skillsDir, s, 'SKILL.md'))?.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
        return !/^name:\s*\S/m.test(fm) || !/^description:\s*\S/m.test(fm);
      });
      const problems = [
        ...missing.map((f) => `${f.replace(/\\/g, '/')} missing`),
        ...(skills.length ? [] : ['no project skills']),
        ...bad.map((s) => `skill ${s} lacks name/description frontmatter`),
      ];
      return problems.length ? advise(problems.join('; ')) : pass(`${skills.length} project skills`);
    },
  },
  {
    id: 'claude.cli',
    title: 'Claude Code CLI',
    run: async (p) => {
      const v = await claudeVersion(p);
      return v ? pass(v) : advise('not installed (optional backend)', 'npm i --global @anthropic-ai/claude-code (run it yourself)');
    },
  },
  {
    id: 'claude.auth',
    title: 'Claude Code sign-in',
    run: async (p) => {
      if (!(await claudeVersion(p))) return skip('claude not installed');
      const auth = await claudeAuth(p);
      if (auth === true) return pass('signed in');
      return {
        status: 'warn',
        classification: 'manual',
        message: auth === false ? 'not signed in' : 'sign-in state unknown',
        repair: 'run `claude` once and sign in',
      };
    },
  },
  {
    id: 'claude.globalconfig',
    title: 'Claude user-global config',
    run: async (p) => {
      const found = claudeGlobalConfig(p);
      return found.length
        ? advise(`detected ${found.join(', ')}; CourseForge isolates spawned agents from these (never modifies them)`)
        : pass('none detected');
    },
  },
  {
    id: 'codex.cli',
    title: 'Codex CLI',
    run: async (p) => {
      const v = await codexVersion(p);
      return v ? pass(v) : advise('not installed (optional backend)', 'npm i --global @openai/codex (run it yourself)');
    },
  },
  {
    id: 'codex.auth',
    title: 'Codex sign-in',
    run: async (p) => {
      if (!(await codexVersion(p))) return skip('codex not installed');
      const auth = await codexAuth(p);
      return auth ? pass('signed in') : { status: 'warn', classification: 'manual', message: 'not signed in', repair: 'run `codex login`' };
    },
  },
  {
    id: 'codex.globalconfig',
    title: 'Codex user-global config',
    run: async (p) => {
      const found = codexGlobalConfig(p);
      return found.length
        ? advise(`detected ${found.join(', ')}; CourseForge runs codex with --ignore-user-config (never modifies them)`)
        : pass('none detected');
    },
  },
  {
    id: 'fs.writable',
    title: 'Writable work directories',
    run: async (p) => {
      const bad = ['courses', '.courseforge'].filter((d) => !p.canWrite(join(p.repoRoot, d)));
      return bad.length
        ? fail('manual', `cannot write to ${bad.join(', ')}`, 'check folder permissions / antivirus / sync locks')
        : pass('courses/ and .courseforge/ writable');
    },
  },
];
