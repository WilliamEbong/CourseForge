#!/usr/bin/env node
/**
 * CourseForge bootstrap (called by setup.ps1 / setup.sh / `npm run setup`). Dependency-free: it runs before
 * node_modules exists. Idempotent: install/browser/build steps are fingerprinted in .courseforge/state.json and
 * skipped when nothing changed. Prints READY only when doctor and the smoke fixture both pass.
 *
 * Flags: --ci (plain output) --no-smoke --offline (skip network steps) --json (machine summary on stdout)
 * Exit: 0 ready, 3 environment problem.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { freemem, platform, totalmem } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const opts = { ci: args.has('--ci'), noSmoke: args.has('--no-smoke'), offline: args.has('--offline'), json: args.has('--json') };
const known = new Set(['--ci', '--no-smoke', '--offline', '--json']);
for (const a of args) {
  if (!known.has(a)) {
    process.stderr.write(`bootstrap: unknown flag ${a} (known: ${[...known].join(' ')})\n`);
    process.exit(2);
  }
}

const log = (s) => {
  if (!opts.json) process.stdout.write(`${s}\n`);
};
const statePath = join(root, '.courseforge', 'state.json');
const readState = () => {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
};
const saveState = (patch) => {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify({ ...readState(), ...patch, updatedAt: new Date().toISOString() }, null, 2)}\n`);
};

/** Same format as src/core/hash.ts hashFile for text: sha256 of LF-normalised content. */
const lockHash = () =>
  `sha256:${createHash('sha256')
    .update(readFileSync(join(root, 'package-lock.json'), 'utf8').replace(/\r\n?/g, '\n'))
    .digest('hex')}`;

/** Cheap source fingerprint: relative path + mtime + size of every compiled .ts file and the build tsconfigs. */
function sourceFingerprint() {
  const entries = [];
  const visit = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) {
        if (name !== 'node_modules') visit(abs);
      } else if (name.endsWith('.ts')) entries.push(`${relative(root, abs)}:${st.mtimeMs}:${st.size}`);
    }
  };
  visit(join(root, 'src'));
  visit(join(root, 'components', 'course-ui', 'src'));
  for (const f of ['tsconfig.json', 'tsconfig.build.json']) {
    const p = join(root, f);
    if (existsSync(p)) entries.push(`${f}:${statSync(p).mtimeMs}:${statSync(p).size}`);
  }
  return `sha256:${createHash('sha256').update(entries.join('\n')).digest('hex')}`;
}

/**
 * Runs a command with captured output. npm is a .cmd shim on Windows, which Node only launches through a shell;
 * the arguments passed here are fixed literals, never user input.
 */
function run(cmd, argv, { timeoutMs = 20 * 60_000 } = {}) {
  const useShell = platform() === 'win32' && cmd === 'npm';
  const res = spawnSync(cmd, argv, {
    cwd: root,
    encoding: 'utf8',
    shell: useShell,
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  return { code: res.status ?? (res.error ? -1 : 1), out: `${res.stdout ?? ''}${res.stderr ?? ''}`, error: res.error?.message ?? null };
}

const tail = (text, n = 25) => text.trim().split(/\r?\n/).slice(-n).join('\n');
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const steps = [];
const nextActions = [];
function step(name, fn) {
  const started = Date.now();
  log(`» ${name}`);
  let result;
  try {
    result = fn();
  } catch (err) {
    result = { status: 'failed', detail: err instanceof Error ? err.message : String(err) };
  }
  const entry = { name, ...result, ms: Date.now() - started };
  steps.push(entry);
  const mark = entry.status === 'failed' ? '✗' : entry.status === 'skipped' ? '-' : '✓';
  log(`  ${mark} ${entry.status}${entry.detail ? `: ${entry.detail.split('\n')[0]}` : ''}`);
  return entry.status !== 'failed';
}

/* 1 — environment summary (informational; doctor does the real classification) */
step('environment', () => {
  const [maj, min] = process.versions.node.split('.').map(Number);
  if (maj < 22 || (maj === 22 && min < 12)) {
    nextActions.push('Install Node.js 22.12+ (Windows: winget install OpenJS.NodeJS.LTS; macOS: brew install node@24)');
    return { status: 'failed', detail: `Node ${process.versions.node} is older than 22.12.0` };
  }
  const npm = run('npm', ['--version'], { timeoutMs: 60_000 });
  const cloud = /[\\/](onedrive[^\\/]*|dropbox|google ?drive|my drive|icloud ?drive|mobile documents)[\\/]/i.test(`${root}/`);
  const gb = (n) => (n / 1024 ** 3).toFixed(1);
  const detail = [
    `${platform()} node ${process.versions.node} npm ${npm.code === 0 ? npm.out.trim() : 'missing'}`,
    `RAM ${gb(freemem())}/${gb(totalmem())} GB free`,
    cloud ? 'repo is in a cloud-synced folder (pause sync if you see EPERM/EBUSY)' : '',
  ]
    .filter(Boolean)
    .join('; ');
  if (npm.code !== 0) {
    nextActions.push('Reinstall Node.js so that npm is available');
    return { status: 'failed', detail };
  }
  return { status: 'done', detail };
});

/* 2 — dependencies */
const depsOk =
  steps[0].status !== 'failed' &&
  step('dependencies (npm ci)', () => {
    const hidden = join(root, 'node_modules', '.package-lock.json');
    const current = lockHash();
    const recorded = readState().lockHash;
    const fresh =
      existsSync(hidden) &&
      (recorded ? recorded === current : statSync(hidden).mtimeMs >= statSync(join(root, 'package-lock.json')).mtimeMs);
    if (fresh) {
      if (!recorded) saveState({ lockHash: current });
      return { status: 'skipped', detail: 'lockfile unchanged' };
    }
    if (opts.offline) {
      nextActions.push('Run setup without --offline to install dependencies');
      return { status: 'failed', detail: 'dependencies need installing but --offline was given' };
    }
    let last = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      last = run('npm', ['ci', '--no-audit', '--no-fund']);
      if (last.code === 0) {
        saveState({ lockHash: current });
        return { status: 'done', detail: attempt > 1 ? `succeeded on attempt ${attempt}` : '' };
      }
      if (!/EPERM|EBUSY|ENOTEMPTY/.test(last.out)) break;
      log(`  file lock during npm ci (attempt ${attempt}); retrying…`);
      sleep(2000 * 2 ** (attempt - 1));
    }
    nextActions.push(
      /EPERM|EBUSY|ENOTEMPTY/.test(last.out)
        ? 'npm ci hit file locks: close editors/terminals using node_modules, pause OneDrive/antivirus scanning, then rerun setup'
        : 'npm ci failed: check network/proxy settings, then rerun setup',
    );
    return { status: 'failed', detail: tail(last.out) };
  });

/* 3 — Playwright Chromium (shared per-user cache, never inside the repo) */
const browserOk =
  depsOk &&
  step('browser (Playwright Chromium)', () => {
    const probe = run(process.execPath, [
      '--input-type=module',
      '-e',
      "import('playwright').then(m => process.stdout.write(m.chromium.executablePath()))",
    ]);
    const exe = probe.code === 0 ? probe.out.trim() : '';
    if (exe && existsSync(exe)) return { status: 'skipped', detail: 'Chromium already installed' };
    if (opts.offline) {
      nextActions.push('Run setup without --offline to install Chromium');
      return { status: 'failed', detail: 'Chromium missing and --offline was given' };
    }
    const res = run(process.execPath, [join(root, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium']);
    if (res.code === 0) return { status: 'done', detail: '' };
    nextActions.push('Chromium download failed: check network/proxy, or run: npx playwright install chromium');
    return { status: 'failed', detail: tail(res.out) };
  });

/* 4 — compile TypeScript */
const buildOk =
  depsOk &&
  step('build (tsc)', () => {
    const fp = sourceFingerprint();
    if (existsSync(join(root, 'dist', 'src', 'cli', 'main.js')) && readState().buildHash === fp) {
      return { status: 'skipped', detail: 'sources unchanged' };
    }
    const res = run(
      process.execPath,
      [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.build.json', '--noEmitOnError'],
      {
        timeoutMs: 10 * 60_000,
      },
    );
    if (res.code === 0) {
      saveState({ buildHash: fp });
      return { status: 'done', detail: '' };
    }
    nextActions.push('TypeScript build failed (see output above); run: npm run build');
    return { status: 'failed', detail: tail(res.out) };
  });

/* 5 — doctor (repairs repo-local problems, writes .courseforge/environment.json) */
const cli = join(root, 'bin', 'courseforge.mjs');
const doctorOk =
  buildOk &&
  step('doctor --repair', () => {
    const res = run(process.execPath, [cli, 'doctor', '--repair']);
    if (!opts.json) process.stdout.write(`${res.out.trim().replace(/^/gm, '    ')}\n`);
    if (res.code === 0) return { status: 'done', detail: '' };
    nextActions.push('Resolve the doctor items marked ✗ above, then rerun setup (or: courseforge doctor)');
    return { status: 'failed', detail: `doctor exited ${res.code}` };
  });

/* 6 — smoke fixture */
const smokeOk =
  doctorOk &&
  (opts.noSmoke
    ? step('smoke fixture', () => ({ status: 'skipped', detail: '--no-smoke' }))
    : step('smoke fixture', () => {
        const res = run(process.execPath, [cli, 'smoke'], { timeoutMs: 10 * 60_000 });
        if (!opts.json) process.stdout.write(`${res.out.trim().replace(/^/gm, '    ')}\n`);
        if (res.code === 0) return { status: 'done', detail: '' };
        nextActions.push('Smoke fixture failed: run `courseforge smoke` for details');
        return { status: 'failed', detail: `smoke exited ${res.code}` };
      }));

const ready = Boolean(browserOk && smokeOk);
if (opts.json) {
  process.stdout.write(`${JSON.stringify({ ready, steps, nextActions }, null, 2)}\n`);
} else if (ready) {
  log('\nREADY');
} else {
  log('\nNOT READY — next actions:');
  (nextActions.length ? nextActions : ['Rerun setup and read the failed step above']).forEach((a, i) => {
    log(`  ${i + 1}. ${a}`);
  });
}
process.exit(ready ? 0 : 3);
