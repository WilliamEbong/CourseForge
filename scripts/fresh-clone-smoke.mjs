#!/usr/bin/env node
/**
 * Fresh-clone smoke (`npm run smoke:clean`): shallow-clones the committed HEAD into the OS temp dir (outside the
 * repo and any synced folder), runs bootstrap twice and asserts READY, a ready environment manifest, and that the
 * second run skips install/browser/build (idempotent). Only committed files are tested. `--keep` keeps the clone.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keep = process.argv.includes('--keep');
const dest = join(tmpdir(), `cf-fresh-${Date.now()}`);
const failures = [];
const summary = [];

const run = (cmd, args, cwd) => {
  const started = Date.now();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  return {
    code: r.status ?? -1,
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
    stdout: r.stdout ?? '',
    ms: Date.now() - started,
    error: r.error,
  };
};
const check = (ok, label) => {
  summary.push(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures.push(label);
  return ok;
};

if (!existsSync(join(root, '.git'))) {
  console.error('fresh-clone-smoke: the repository is not a git checkout (nothing committed to clone).');
  process.exit(2);
}

console.log(`Cloning HEAD into ${dest}`);
const clone = run('git', ['clone', '--depth', '1', pathToFileURL(root).href, dest], root);
if (!check(clone.code === 0, `git clone (${clone.ms} ms)`)) {
  console.error(clone.out);
} else {
  const boot = (extra) => run(process.execPath, [join('scripts', 'bootstrap.mjs'), '--ci', ...extra], dest);

  const first = boot([]);
  process.stdout.write(first.out.replace(/^/gm, '  | '));
  check(first.code === 0, `first bootstrap exits 0 (${Math.round(first.ms / 1000)} s)`);
  check(/^READY$/m.test(first.stdout), 'first bootstrap prints READY');

  const envPath = join(dest, '.courseforge', 'environment.json');
  let status = 'missing';
  try {
    status = JSON.parse(readFileSync(envPath, 'utf8')).status;
  } catch {
    /* reported below */
  }
  check(status === 'ready', `.courseforge/environment.json status ready (got ${status})`);

  const second = boot(['--json']);
  let report = null;
  try {
    report = JSON.parse(second.stdout);
  } catch {
    /* reported below */
  }
  check(second.code === 0 && report?.ready === true, `second bootstrap ready (${Math.round(second.ms / 1000)} s)`);
  const heavy = (report?.steps ?? []).filter((s) => /npm ci|Chromium|tsc/.test(s.name));
  check(heavy.length === 3 && heavy.every((s) => s.status === 'skipped'), 'second run skips install, browser and build');
}

console.log(`\nFresh-clone smoke summary\n  ${summary.join('\n  ')}`);
if (keep) console.log(`Clone kept at ${dest}`);
else rmSync(dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
console.log(failures.length ? `FAILED (${failures.length})` : 'PASSED');
process.exit(failures.length ? 1 : 0);
