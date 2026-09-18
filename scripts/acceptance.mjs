#!/usr/bin/env node
/**
 * Acceptance matrix (`npm run test:acceptance`): runs vitest and Playwright with JSON reporters, collects the
 * spec-10 tags (`@A1` … `@L7`) from test titles and prints covered/passed/failed/missing per requirement ID.
 * Exit 1 if any tagged test failed or (unless --allow-missing) any ID has no test.
 * Flags: --allow-missing  --no-e2e  --out <file> (also write the matrix as Markdown)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const allowMissing = argv.includes('--allow-missing');
const noE2e = argv.includes('--no-e2e');
const outIdx = argv.indexOf('--out');
const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;

const GROUPS = { A: 7, B: 7, C: 8, D: 6, E: 6, F: 5, G: 9, H: 6, I: 8, J: 6, K: 7, L: 7 };
const IDS = Object.entries(GROUPS).flatMap(([g, n]) => Array.from({ length: n }, (_, i) => `${g}${i + 1}`));
const TAG = /@([A-L][1-9])\b/g;

const tmp = mkdtempSync(join(tmpdir(), 'cf-acceptance-'));
/** @type {{title: string, status: 'passed'|'failed'|'skipped', runner: string}[]} */
const tests = [];

function node(args, env = {}) {
  return spawnSync(process.execPath, args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ...env } });
}

// vitest: testResults[].assertionResults[] { ancestorTitles, title, status }
const vitestOut = join(tmp, 'vitest.json');
node([join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--reporter=json', `--outputFile=${vitestOut}`]);
if (existsSync(vitestOut)) {
  const report = JSON.parse(readFileSync(vitestOut, 'utf8'));
  for (const file of report.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      const status = t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped';
      tests.push({ title: [file.name ?? '', ...(t.ancestorTitles ?? []), t.title].join(' '), status, runner: 'vitest' });
    }
  }
} else {
  console.error('acceptance: vitest produced no JSON report');
}

// Playwright: nested suites → specs[] { title, tags, tests[] { status: expected|unexpected|flaky|skipped } }
if (!noE2e) {
  const pwOut = join(tmp, 'playwright.json');
  node([join(root, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--reporter=json'], { PLAYWRIGHT_JSON_OUTPUT_NAME: pwOut });
  if (existsSync(pwOut)) {
    const walk = (suite, trail) => {
      const here = [...trail, suite.title ?? ''];
      for (const spec of suite.specs ?? []) {
        const results = (spec.tests ?? []).map((t) => t.status);
        const status = results.includes('unexpected') ? 'failed' : results.every((s) => s === 'skipped') ? 'skipped' : 'passed';
        const tags = (spec.tags ?? []).map((t) => (t.startsWith('@') ? t : `@${t}`)).join(' ');
        tests.push({ title: [...here, spec.title, tags].join(' '), status, runner: 'playwright' });
      }
      for (const child of suite.suites ?? []) walk(child, here);
    };
    for (const s of JSON.parse(readFileSync(pwOut, 'utf8')).suites ?? []) walk(s, []);
  } else {
    console.error('acceptance: playwright produced no JSON report');
  }
}
rmSync(tmp, { recursive: true, force: true });

const rows = IDS.map((id) => {
  const tagged = tests.filter((t) => [...t.title.matchAll(TAG)].some((m) => m[1] === id));
  const passed = tagged.filter((t) => t.status === 'passed').length;
  const failed = tagged.filter((t) => t.status === 'failed').length;
  const state = !tagged.length ? 'missing' : failed ? 'failed' : passed ? 'passed' : 'skipped';
  return { id, tests: tagged.length, passed, failed, state };
});

const lines = [
  '| ID | tests | passed | failed | state |',
  '|---|---:|---:|---:|---|',
  ...rows.map((r) => `| ${r.id} | ${r.tests} | ${r.passed} | ${r.failed} | ${r.state} |`),
];
const count = (s) => rows.filter((r) => r.state === s).length;
const totals = `passed ${count('passed')}, failed ${count('failed')}, skipped-only ${count('skipped')}, missing ${count('missing')} of ${IDS.length}`;
console.log(`\nAcceptance matrix (spec 10)\n${lines.join('\n')}\n\n${totals}`);
if (outFile) writeFileSync(outFile, `# Acceptance matrix\n\n${lines.join('\n')}\n\n${totals}\n`);

const bad = count('failed') > 0 || (!allowMissing && count('missing') > 0);
process.exit(bad ? 1 : 0);
