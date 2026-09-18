/**
 * Crawl-mode QA of the imported example course (examples/chemical-risk/06_interactive_course.html) run on a
 * temp copy; the original must stay byte-identical.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { hashFile } from '../../../src/core/hash.js';
import { AccessibilityReportSchema, FunctionalReportSchema, ScreenshotManifestSchema } from '../../../src/core/schemas/reports.js';
import { qaIssues } from '../../../src/qa/issues.js';
import { runQa } from '../../../src/qa/run.js';

const original = join(import.meta.dirname, '../../../examples/chemical-risk/06_interactive_course.html');

test('@K2 @I1 @I7 @I8 crawl QA browser-runs the example course offline and reaches every screen', async () => {
  test.setTimeout(420_000);
  const before = hashFile(original);
  const course = mkdtempSync(join(tmpdir(), 'cf-crawl-'));
  mkdirSync(join(course, 'input'));
  const html = join(course, 'input', 'course.html');
  copyFileSync(original, html);
  const review = join(course, 'review');

  const t0 = Date.now();
  const r = await runQa({ htmlPath: html, model: null, outDir: review, profile: 'dev', courseId: 'chemical-risk' });
  const ms = Date.now() - t0;
  const f = FunctionalReportSchema.parse(r.functional);
  AccessibilityReportSchema.parse(r.accessibility);
  ScreenshotManifestSchema.parse(r.screenshots);

  expect(f.mode).toBe('crawl');
  expect(f.target).toBe('input/course.html');
  // Reachability: the Next button walks all 133 screens (cross-checked against the page's own screen count).
  const desktop = f.screens.filter((s) => s.viewport === 1440);
  expect(desktop.length).toBeGreaterThanOrEqual(133);
  expect(f.navigation.detail).toContain('linear next traversal: 133 states');
  expect(f.crawl?.truncated).toBe(false);
  // Mobile replay reaches the same screens.
  expect(f.screens.filter((s) => s.viewport === 390).length).toBeGreaterThanOrEqual(133);
  // @I8 no page errors / console errors; @G3-style offline proof.
  expect(f.consoleErrors).toEqual([]);
  expect(f.screens.flatMap((s) => s.errors.filter((e) => e.startsWith('page error')))).toEqual([]);
  expect(f.offline.blockedRequests).toEqual([]);
  // Dialog openers and keyboard were exercised.
  expect(f.resources.detail).toMatch(/Glossary.*opened/);
  expect(f.keyboard.ok).toBe(true);
  // @I6 screenshots at 1440 and 390 exist on disk with hashes.
  expect(new Set(r.screenshots.items.map((i) => i.viewport))).toEqual(new Set([1440, 390]));
  for (const it of r.screenshots.items) expect(existsSync(join(review, it.path))).toBe(true);
  // axe ran on the sample; totals are recorded (whatever they are — issues are expected for imported courses).
  expect(r.accessibility.screens.length).toBeGreaterThan(0);
  const issues = qaIssues(f, r.accessibility, { axeBlockingImpacts: ['serious', 'critical'] });

  console.log(
    `crawl dev: ${ms} ms, states ${f.crawl?.states}, a11y totals ${JSON.stringify(r.accessibility.totals)}, ` +
      `screens not ok ${f.screens.filter((s) => !s.ok).length}, issues ${issues.length}`,
  );
  expect(hashFile(original)).toBe(before);
});
