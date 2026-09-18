/**
 * Contract-mode QA against a hand-written stand-in for a CourseForge build (tests/fixtures/qa/contract-mini.html),
 * so the engine is testable independently of the renderer.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AccessibilityReportSchema, FunctionalReportSchema, ScreenshotManifestSchema } from '../../../src/core/schemas/reports.js';
import type { QaModel } from '../../../src/qa/contract.js';
import { qaIssues } from '../../../src/qa/issues.js';
import { compareQaRuns } from '../../../src/qa/regression.js';
import { representativeScreens, runQa } from '../../../src/qa/run.js';

const fixture = join(import.meta.dirname, '../../fixtures/qa/contract-mini.html');
const html = readFileSync(fixture, 'utf8');
const model = JSON.parse(/<script id="cf-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? 'null') as QaModel;

const tmpCourse = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cf-qa-'));
  return { dir, review: join(dir, 'review') };
};

describe('contract QA on contract-mini @G3 @G5 @G6 @G7 @G8 @G9 @I1 @I2 @I3 @I4 @I5 @I6 @I7 @I8 @J1 @J3 @J4', () => {
  it('passes every check in the dev profile', async () => {
    const { review } = tmpCourse();
    const t0 = Date.now();
    const r = await runQa({ htmlPath: fixture, model, outDir: review, profile: 'dev', courseId: 'contract-mini' });
    const f = FunctionalReportSchema.parse(r.functional);
    AccessibilityReportSchema.parse(r.accessibility);
    ScreenshotManifestSchema.parse(r.screenshots);
    console.log(`contract dev run: ${Date.now() - t0} ms`);

    expect(f.mode).toBe('contract');
    expect(f.viewports).toEqual([1440, 390]);
    expect(f.summary.failures).toEqual([]);
    expect(f.summary.pass).toBe(true);
    // @I1 traversal: all 5 screens at 1440 + representative sample at 390, every block id present
    expect(f.screens.filter((s) => s.viewport === 1440).map((s) => s.id)).toEqual(model.screens.map((s) => s.id));
    expect(f.screens.every((s) => s.missingIds.length === 0 && s.overflow.length === 0)).toBe(true);
    // @I2 @I3 @G5 correct + incorrect paths through real controls
    expect(f.interactions.map((i) => [i.id, i.mode, i.correctPath, i.incorrectPath])).toEqual([
      ['q-single', 'single', 'pass', 'pass'],
      ['q-seq', 'sequencing', 'pass', 'pass'],
    ]);
    // @I4 @G6 scoring: all-correct, all-wrong, mixed (1 of 2 → 50)
    expect(f.scoring).toEqual({ checked: true, expectedPercent: 50, actualPercent: 50, ok: true });
    // @I5 navigation
    expect(f.navigation.ok).toBe(true);
    expect(f.navigation.detail).toMatch(/5\/5 screens first→last/);
    // @G7 resources
    expect(f.resources).toMatchObject({ glossary: 2, references: 2, ok: true });
    // @G8 progress + reset
    expect(f.progress).toEqual({ persisted: true, resetOk: true });
    // @J3 @J4 keyboard + focus
    expect(f.keyboard.ok).toBe(true);
    expect(f.keyboard.focusVisible).toBe(true);
    // @G3 offline, @G9 no console errors
    expect(f.offline.blockedRequests).toEqual([]);
    expect(f.consoleErrors).toEqual([]);
    // @J1 axe ran on the representative sample
    expect(r.accessibility.screens.map((s) => s.id)).toEqual(representativeScreens(model));
    // @I6 screenshots at 1440 and 390, sha256 recorded, files on disk
    expect(new Set(r.screenshots.items.map((i) => i.viewport))).toEqual(new Set([1440, 390]));
    for (const it of r.screenshots.items) {
      expect(it.path).toMatch(/^screenshots\/[\w-]+-(1440|390)\.png$/);
      expect(it.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(existsSync(join(review, it.path))).toBe(true);
    }
  });

  it('detects seeded defects (scoring, focus, network) and maps them to issues @J2 @K7', async () => {
    const { dir, review } = tmpCourse();
    const broken = join(dir, 'broken.html');
    writeFileSync(
      broken,
      html
        .replace('Math.round((100 * correct) / ids.length)', 'Math.round((100 * correct) / (ids.length + 1))')
        .replace(':focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }', ':focus { outline: none; }')
        .replace('<main id="cf-main"></main>', '<main id="cf-main"></main><img src="https://example.invalid/pixel.png" alt="">'),
    );
    const good = await runQa({ htmlPath: fixture, model, outDir: review, profile: 'smoke', courseId: 'contract-mini' });
    const bad = await runQa({ htmlPath: broken, model, outDir: review, profile: 'smoke', courseId: 'contract-mini' });
    const f = bad.functional;
    expect(good.functional.summary.pass).toBe(true);
    expect(f.summary.pass).toBe(false);
    expect(f.scoring.ok).toBe(false);
    expect(f.keyboard.focusVisible).toBe(false);
    expect(f.offline.blockedRequests).toEqual(['https://example.invalid/pixel.png']);

    const issues = qaIssues(f, bad.accessibility, { axeBlockingImpacts: ['serious', 'critical'] });
    const problems = issues.map((i) => `${i.severity}/${i.category}/${i.checkId}: ${i.problem}`);
    expect(problems).toContain('critical/assessment/qa-functional: Graded scoring does not match the expected result');
    expect(problems).toContain('critical/accessibility/qa-accessibility: Keyboard focus is not visible on some controls');
    expect(problems).toContain('critical/functional/qa-functional: Course makes network requests (not self-contained/offline)');

    const reg = compareQaRuns(good, bad);
    expect(reg.verdict).toBe('regressed');
    expect(reg.newFailures.length).toBeGreaterThan(0);
  });
});
