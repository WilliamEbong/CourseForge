/**
 * Repository hygiene: no machine-specific absolute user paths, no secrets, and the author's name only where it
 * belongs. Scans the text files that make up the public repository (source, config, prompts, docs, tests,
 * scripts, agent instructions, CI and root files); generated and ignored folders are skipped.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkFiles } from '../../../src/core/fsx.js';
import { repoRoot } from '../../../src/core/paths.js';

const root = repoRoot();

const TEXT = /\.(ts|mts|mjs|cjs|js|json|jsonl|md|ya?ml|txt|html?|css|ps1|sh|cmd|svg)$/i;
const ROOT_FILES = [
  'README.md',
  'CLAUDE.md',
  'AGENTS.md',
  'THIRD-PARTY.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'package.json',
  'setup.ps1',
  'setup.sh',
  'courseforge',
  'courseforge.cmd',
  'playwright.config.ts',
  'vitest.config.ts',
  'biome.json',
  'tsconfig.json',
  'tsconfig.build.json',
  '.gitignore',
  '.gitattributes',
  '.npmrc',
];
const DIRS: { dir: string; exclude: string[] }[] = [
  { dir: 'src', exclude: [] },
  { dir: 'components', exclude: ['node_modules/'] },
  { dir: 'config', exclude: [] },
  { dir: 'prompts', exclude: [] },
  { dir: 'schemas', exclude: [] },
  { dir: 'docs', exclude: ['bootstrap/'] },
  { dir: 'tests', exclude: ['fixtures/harness-raw/', '.tmp/'] },
  { dir: 'scripts', exclude: [] },
  { dir: 'bin', exclude: [] },
  { dir: '.claude', exclude: ['settings.local.json'] },
  { dir: '.github', exclude: [] },
  { dir: 'vendor', exclude: [] },
];

function scanned(): string[] {
  const files = ROOT_FILES.filter((f) => existsSync(join(root, f)));
  for (const { dir, exclude } of DIRS) {
    for (const f of walkFiles(join(root, dir), exclude)) if (TEXT.test(f)) files.push(`${dir}/${f}`);
  }
  return files;
}

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

/** Placeholder or system account names that are fine in examples and test vectors. */
const PLACEHOLDER_USERS = new Set([
  'ada',
  'alice',
  'bob',
  'carol',
  'user',
  'username',
  'name',
  'you',
  'me',
  'example',
  'runner',
  'public',
  'shared',
  'default',
]);
const USER_PATHS = [
  /\b[A-Za-z]:(?:\\\\|\\|\/)+Users(?:\\\\|\\|\/)+([A-Za-z0-9._-]+)/gi,
  /\/home\/([a-z_][a-z0-9_-]*)/g,
  /(?<![A-Za-z]:)\/Users\/([A-Za-z0-9._-]+)/g,
];
const SECRETS: [string, RegExp][] = [
  ['API key (sk-…)', /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/],
  ['GitHub token', /ghp_[A-Za-z0-9]{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['private key', /-----BEGIN (RSA |)PRIVATE KEY-----/],
];
/** Files that contain secret-shaped strings on purpose (recorder/scrubber test vectors). */
const SECRET_ALLOWLIST = new Set(['tests/unit/harness/fake.test.ts']);
/**
 * Known findings awaiting a scrub by the file's owner. Each entry must still contain the finding, so the
 * exception is removed as soon as the file is fixed.
 */
const PENDING_SCRUB: Record<string, RegExp> = {
  // The approved plan records the machine it was written on (§1 environment findings).
  'docs/exec-plans/active/courseforge-v1.md': /[A-Za-z]:\\Users\\/,
};

function userPathHits(text: string): string[] {
  const hits: string[] = [];
  for (const re of USER_PATHS) {
    for (const m of text.matchAll(re)) {
      const name = (m[1] ?? '').toLowerCase();
      // One- or two-letter names (`/home/a`) are test-vector placeholders, not real accounts.
      if (name.length > 2 && !PLACEHOLDER_USERS.has(name)) hits.push(m[0]);
    }
  }
  return hits;
}

describe('repository hygiene', () => {
  const files = scanned();

  it('scans the repository', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('README.md');
  });

  it('@L4 no absolute user paths in tracked text files', () => {
    const bad: string[] = [];
    for (const f of files) {
      if (PENDING_SCRUB[f]) continue;
      for (const h of userPathHits(read(f))) bad.push(`${f}: ${h}`);
    }
    expect(bad).toEqual([]);
  });

  it('@L4 no secret-shaped strings', () => {
    const bad: string[] = [];
    for (const f of files) {
      if (SECRET_ALLOWLIST.has(f)) continue;
      const text = read(f);
      for (const [label, re] of SECRETS) if (re.test(text)) bad.push(`${f}: ${label}`);
    }
    expect(bad).toEqual([]);
  });

  it('@L4 recorded CLI fixtures are scrubbed of user paths and email addresses', () => {
    const dir = join(root, 'tests', 'fixtures', 'harness-raw');
    const bad: string[] = [];
    for (const f of walkFiles(dir)) {
      const text = readFileSync(join(dir, f), 'utf8');
      if (/[A-Za-z]:(?:\\\\|\\|\/)+Users(?:\\\\|\\|\/)/i.test(text)) bad.push(`${f}: Windows user path`);
      if (/\/(home|Users)\/[A-Za-z]/.test(text)) bad.push(`${f}: POSIX user path`);
      if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.test(text)) bad.push(`${f}: email address`);
      for (const [label, re] of SECRETS) if (re.test(text)) bad.push(`${f}: ${label}`);
    }
    expect(bad).toEqual([]);
  });

  it("@L4 the author's name appears only in LICENSE and the example NOTICE", () => {
    const holder = /Copyright \(c\) \d{4} (.+)$/m.exec(read('LICENSE'))?.[1]?.trim();
    expect(holder, 'LICENSE copyright holder').toBeTruthy();
    const surname = (holder as string).split(/\s+/).at(-1) as string;
    const allowed = new Set(['LICENSE', 'examples/chemical-risk/NOTICE.md']);
    const examples = walkFiles(join(root, 'examples'))
      .filter((f) => TEXT.test(f))
      .map((f) => `examples/${f}`);
    const bad = [...files, ...examples].filter((f) => !allowed.has(f) && read(f).includes(surname));
    expect(bad).toEqual([]);
  });

  it('pending-scrub exceptions are still needed', () => {
    for (const [f, re] of Object.entries(PENDING_SCRUB)) {
      if (!existsSync(join(root, f))) continue;
      expect(re.test(read(f)), `${f} no longer needs its hygiene exception; remove it`).toBe(true);
    }
  });

  it('detects the patterns it is meant to catch', () => {
    // Built at runtime so this file does not trip its own scan.
    const win = ['C:', 'Users', 'jdoe', 'x'].join('\\');
    expect(userPathHits(win)).toEqual([win.slice(0, -2)]);
    expect(userPathHits(JSON.stringify(win))).toHaveLength(1);
    expect(userPathHits(`${['', 'home', 'jdoe', 'x'].join('/')} and ${['', 'Users', 'jdoe', 'y'].join('/')}`)).toHaveLength(2);
    expect(userPathHits('C:\\Users\\<you>\\x, /home/runner/work, C:/Users/ada/y, <HOME>/x')).toEqual([]);
    const fake = ['sk-', 'a'.repeat(24)].join('');
    expect(SECRETS.some(([, re]) => re.test(fake))).toBe(true);
    expect(SECRETS.some(([, re]) => re.test('risk-override-acknowledged-by-reviewer'))).toBe(false);
  });
});
