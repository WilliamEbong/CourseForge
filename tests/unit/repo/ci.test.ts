/** CI executes the quality gates (lint, typecheck, drift checks, unit/integration and e2e tests). */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../src/core/paths.js';

const root = repoRoot();

describe('continuous integration', () => {
  it('@L5 ci.yml runs typecheck, lint, schema and fixture drift checks, tests and e2e', () => {
    const p = join(root, '.github', 'workflows', 'ci.yml');
    expect(existsSync(p)).toBe(true);
    const ci = readFileSync(p, 'utf8');
    for (const step of [
      'npm ci',
      'npm run typecheck',
      'npm run lint',
      'scripts/gen-schemas.ts --check',
      'scripts/gen-demo-fixtures.ts --check',
      'npm test',
      'npm run test:e2e',
      'playwright install --with-deps chromium',
    ]) {
      expect(ci, `ci.yml does not run "${step}"`).toContain(step);
    }
  });

  it('@L5 scripts referenced by CI exist in package.json', () => {
    const scripts = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
    for (const s of ['typecheck', 'lint', 'test', 'test:e2e', 'test:acceptance', 'build', 'build-storybook'])
      expect(scripts[s], s).toBeDefined();
  });
});
