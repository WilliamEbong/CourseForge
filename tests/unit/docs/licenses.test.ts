/** Licences and attributions: every direct dependency is recorded, and embedded third-party material has its notice. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../src/core/paths.js';

const root = repoRoot();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('licences', () => {
  it('@L3 every dependency and devDependency appears in THIRD-PARTY.md with its pinned version', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const rows = read('THIRD-PARTY.md')
      .split('\n')
      .filter((l) => l.startsWith('|'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps).length).toBeGreaterThan(0);
    for (const [name, version] of Object.entries(deps)) {
      const row = rows.find((l) => l.includes(`\`${name}\``));
      expect(row, `THIRD-PARTY.md has no row for ${name}`).toBeDefined();
      expect(row, `THIRD-PARTY.md row for ${name} does not show version ${version}`).toContain(version.replace(/^[\^~]/, ''));
    }
  });

  it('@L3 LICENSE exists and is MIT', () => {
    expect(existsSync(join(root, 'LICENSE'))).toBe(true);
    expect(read('LICENSE')).toMatch(/^MIT License/);
    expect(read('LICENSE')).toMatch(/Copyright \(c\) \d{4} \S/);
  });

  it('@L3 the Lucide ISC licence is kept for icons embedded in released courses', () => {
    const p = 'vendor/LICENSES/lucide-ISC.txt';
    expect(existsSync(join(root, p))).toBe(true);
    expect(read(p)).toContain('ISC License');
  });
});
