import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from '../../../src/core/paths.js';

export const DEMO_FIXTURES = join(repoRoot(), 'tests', 'fixtures', 'harness', 'demo');

/** Points CourseForge at a fresh temp courses dir + the fake harness. Returns the courses dir. */
export function useFakeEnv(fixtures = DEMO_FIXTURES): string {
  const dir = mkdtempSync(join(tmpdir(), 'cf-courses-'));
  process.env.COURSEFORGE_COURSES_DIR = dir;
  process.env.COURSEFORGE_HARNESS = 'fake';
  process.env.COURSEFORGE_FIXTURES = fixtures;
  process.env.COURSEFORGE_QA_PROFILE = 'smoke';
  return dir;
}

/** Copy of the demo fixtures with some files overridden (relative path → fixture envelope). */
export function fixturesWith(overrides: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'cf-fixtures-'));
  cpSync(DEMO_FIXTURES, dir, { recursive: true });
  for (const [rel, value] of Object.entries(overrides)) writeFileSync(join(dir, rel), JSON.stringify(value));
  return dir;
}
