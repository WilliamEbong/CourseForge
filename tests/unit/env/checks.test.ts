/** @A1 Doctor checks detect prerequisites through injected probes (no real processes). */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECKS, claudeAuth, detectCloudSync, parseVersion, versionAtLeast } from '../../../src/environment/checks.js';
import type { EnvProbe } from '../../../src/environment/probe.js';
import { type FakeSpec, fakeProbe, HOME, healthyFiles, REPO, r } from '../../fixtures/env/fake-probe.js';

const check = (id: string) => {
  const c = CHECKS.find((x) => x.id === id);
  if (!c) throw new Error(`no check ${id}`);
  return c;
};
const runCheck = (id: string, spec: FakeSpec = {}) => check(id).run(fakeProbe(spec));

describe('doctor checks @A1', () => {
  it('parses and compares versions from noisy strings', () => {
    expect(parseVersion('git version 2.48.1.windows.1')).toEqual([2, 48, 1]);
    expect(parseVersion('v22.12')).toEqual([22, 12, 0]);
    expect(parseVersion('garbage')).toBeNull();
    expect(versionAtLeast('22.12.0', '22.12.0')).toBe(true);
    expect(versionAtLeast('22.11.9', '22.12.0')).toBe(false);
    expect(versionAtLeast('24.0.0', '22.12.0')).toBe(true);
  });

  it('node too old → manual with an install command', async () => {
    const out = await runCheck('node.version', { overrides: { nodeVersion: '20.11.0', platform: 'win32' } });
    expect(out).toMatchObject({ status: 'fail', classification: 'manual' });
    expect(out.repair).toContain('winget install OpenJS.NodeJS.LTS');
    expect((await runCheck('node.version')).status).toBe('pass');
  });

  it('npm missing or old → manual', async () => {
    expect(await runCheck('npm.version', { versions: { 'npm --version': null } })).toMatchObject({
      status: 'fail',
      classification: 'manual',
    });
    expect(await runCheck('npm.version', { versions: { 'npm --version': '9.8.0' } })).toMatchObject({ status: 'fail' });
  });

  it('lockfile hash mismatch → repairable npm ci', async () => {
    const files = { ...healthyFiles(), [r('.courseforge', 'state.json')]: JSON.stringify({ lockHash: 'sha256:stale' }) };
    const out = await runCheck('deps.lock', { files });
    expect(out).toMatchObject({ status: 'fail', classification: 'repairable', repair: 'npm ci' });
  });

  it('lockfile hash match, and mtime fallback when no fingerprint was recorded', async () => {
    const lockText = healthyFiles()[r('package-lock.json')] ?? '';
    const files = { ...healthyFiles(), [r('.courseforge', 'state.json')]: JSON.stringify({ lockHash: `sha256:${lockText.length}` }) };
    expect((await runCheck('deps.lock', { files })).status).toBe('pass');
    const stale = await runCheck('deps.lock', {
      mtimes: { [r('package-lock.json')]: 2000, [r('node_modules', '.package-lock.json')]: 1000 },
    });
    expect(stale).toMatchObject({ status: 'fail', classification: 'repairable' });
  });

  it('missing node_modules and missing packages are repairable', async () => {
    const files = healthyFiles();
    delete files[r('node_modules', '.package-lock.json')];
    delete files[r('node_modules', 'mermaid', 'package.json')];
    expect(await runCheck('deps.lock', { files })).toMatchObject({ status: 'fail', classification: 'repairable' });
    const pk = await runCheck('deps.packages', { files });
    expect(pk).toMatchObject({ status: 'fail', classification: 'repairable' });
    expect(pk.message).toContain('mermaid');
  });

  it('chromium missing → repairable; system Edge → warn with channel fallback', async () => {
    expect(await runCheck('pw.chromium', { chromium: null })).toMatchObject({ status: 'fail', classification: 'repairable' });
    const edge = join('/', 'pf', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    const out = await runCheck('pw.chromium', {
      chromium: null,
      files: { ...healthyFiles(), [edge]: '' },
      overrides: { platform: 'win32', env: { ProgramFiles: join('/', 'pf') } },
    });
    expect(out.status).toBe('warn');
    expect(out.message).toContain('channel:msedge');
  });

  it('stale dist → repairable build', async () => {
    const out = await runCheck('build.dist', { mtimes: { [r('dist', 'src', 'cli', 'main.js')]: 1, [r('src', 'cli', 'main.ts')]: 5 } });
    expect(out).toMatchObject({ status: 'fail', classification: 'repairable', repair: 'npm run build' });
    expect((await runCheck('build.dist')).status).toBe('pass');
  });

  it('cloud-synced repo → advisory (env var prefix and path heuristics)', async () => {
    const env = { OneDrive: join('/', 'work') };
    expect(await runCheck('path.cloudsync', { overrides: { env } })).toMatchObject({ status: 'warn', classification: 'advisory' });
    const probe = (root: string) => ({ ...fakeProbe(), repoRoot: root }) as EnvProbe;
    expect(detectCloudSync(probe('C:\\Users\\a\\Dropbox\\cf')).provider).toBe('Dropbox');
    expect(detectCloudSync(probe('/Users/a/Library/Mobile Documents/com~apple~CloudDocs/cf')).provider).toBe('iCloud');
    expect(detectCloudSync(probe('C:\\Users\\a\\OneDrive - Contoso\\cf')).provider).toBe('OneDrive');
    expect(detectCloudSync(probe('/srv/cf')).detected).toBe(false);
  });

  it('global agent config detected → advisory listing, never a failure', async () => {
    const files = {
      ...healthyFiles(),
      [join(HOME, '.claude', 'settings.json')]: JSON.stringify({ hooks: {}, enabledPlugins: {} }),
      [join(HOME, '.claude', 'CLAUDE.md')]: '#',
      [join(HOME, '.codex', 'AGENTS.md')]: '#',
    };
    const claude = await runCheck('claude.globalconfig', { files });
    expect(claude).toMatchObject({ status: 'warn', classification: 'advisory' });
    expect(claude.message).toContain('settings.json#hooks');
    expect(claude.message).toContain('CLAUDE.md');
    expect(await runCheck('codex.globalconfig', { files })).toMatchObject({ status: 'warn', classification: 'advisory' });
    expect((await runCheck('claude.globalconfig')).status).toBe('pass');
  });

  it('claude auth: parses loggedIn from JSON and never keeps other fields', async () => {
    const versions = { 'claude --version': '2.1.258 (Claude Code)' };
    const loggedIn = fakeProbe({ versions, runs: { 'claude auth status --json': { stdout: '{"loggedIn":true,"email":"x@y"}' } } });
    expect(await claudeAuth(loggedIn)).toBe(true);
    const out = await runCheck('claude.auth', { versions, runs: { 'claude auth status --json': { stdout: '{"loggedIn":false}' } } });
    expect(out).toMatchObject({ status: 'warn', classification: 'manual' });
    expect(await claudeAuth(fakeProbe({ versions, runs: { 'claude auth status --json': { stdout: 'not json' } } }))).toBeNull();
    expect((await runCheck('claude.auth')).status).toBe('skip');
  });

  it('codex auth: exit code 0 → ready', async () => {
    const versions = { 'codex --version': 'codex-cli 0.144.6' };
    expect((await runCheck('codex.auth', { versions })).status).toBe('pass');
    expect((await runCheck('codex.auth', { versions, runs: { 'codex login status': { code: 1 } } })).status).toBe('warn');
  });

  it('git long paths is repairable on Windows git checkouts only', async () => {
    const files = { ...healthyFiles(), [r('.git', 'HEAD')]: 'ref' };
    const out = await runCheck('git.longpaths', { files, overrides: { platform: 'win32' } });
    expect(out).toMatchObject({ status: 'warn', classification: 'repairable', repair: 'git config --local core.longpaths true' });
    expect((await runCheck('git.longpaths')).status).toBe('skip');
  });

  it('config validator: missing module warns, invalid config fails manual', async () => {
    expect(await runCheck('config.valid', { validator: null })).toMatchObject({ status: 'warn', message: 'routing module not available' });
    const bad = await runCheck('config.valid', {
      validator: () => {
        throw new Error('config/stages.json: unknown key');
      },
    });
    expect(bad).toMatchObject({ status: 'fail', classification: 'manual' });
  });

  it('project instructions and skills frontmatter → advisory until present', async () => {
    const files = healthyFiles();
    expect((await runCheck('project.instructions', { files })).status).toBe('pass');
    files[r('.claude', 'skills', 'demo', 'SKILL.md')] = '---\nname: demo\n---\n';
    const out = await runCheck('project.instructions', { files });
    expect(out).toMatchObject({ status: 'warn', classification: 'advisory' });
    expect(out.message).toContain('demo');
  });

  it('low RAM is advisory; unwritable course dir is manual', async () => {
    expect(await runCheck('os.ram', { overrides: { freemem: 1024 ** 3 } })).toMatchObject({ status: 'warn', classification: 'advisory' });
    expect(await runCheck('fs.writable', { unwritable: ['courses'] })).toMatchObject({ status: 'fail', classification: 'manual' });
  });

  it('check ids are unique and repo paths stay under the repo', () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(REPO).toContain('CourseForge');
  });
});
