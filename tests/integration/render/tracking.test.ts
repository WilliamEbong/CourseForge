/**
 * Tracked builds of the smoke course in a real browser (ADR 0013): QA's tracking contract check for each
 * destination, the learner's send/retry path, and an untracked build that makes no requests at all.
 * Run with --maxWorkers=1 on low-RAM machines.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Tracking, TrackingEventSchema, trackingOrigins } from '../../../src/core/schemas/index.js';
import { runQa } from '../../../src/qa/run.js';
import { checkSingleFile, renderCourse } from '../../../src/renderer/index.js';
import { loadSmoke } from './smoke.js';

const { model, visuals } = loadSmoke();
const SHEET = 'https://script.google.com/macros/s/AKfy-test/exec';
const dir = mkdtempSync(join(tmpdir(), 'cf-track-'));

async function build(name: string, tracking: Tracking | null): Promise<{ file: string; html: string }> {
  const { html, report } = await renderCourse(model, { visuals, mode: 'release', tracking });
  expect(report.checks.find((c) => c.id === 'single-file')?.pass).toBe(true);
  const file = join(dir, `${name}.html`);
  writeFileSync(file, html);
  return { file, html };
}

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser?.close();
});

describe('tracked builds @G2 @I8', () => {
  it('an untracked build has no record panel, no tracking data and forbids all connections', async () => {
    const { html } = await build('untracked', null);
    expect(html).not.toContain('class="cf-record"');
    expect(html).not.toContain('"tracking"');
    expect(checkSingleFile(html).pass).toBe(true);
  });

  it('QA completes a Google Sheet course, records one valid result and passes', async () => {
    const tracking: Tracking = { destination: 'sheet', endpoint: SHEET, identity: 'name_and_id', id_label: 'Payroll ID' };
    const { file, html } = await build('sheet', tracking);
    expect(html).toContain('connect-src https://script.google.com https://script.googleusercontent.com');
    expect(html).toContain('Payroll ID');
    const r = await runQa({
      htmlPath: file,
      model,
      outDir: join(dir, 'review-sheet'),
      profile: 'smoke',
      courseId: model.courseId,
      tracking,
    });
    expect(r.functional.summary.failures).toEqual([]);
    expect(r.functional.offline.blockedRequests).toEqual([]);
  }, 180_000);

  it('QA reports a result that is never sent', async () => {
    const tracking: Tracking = { destination: 'sheet', endpoint: SHEET, identity: 'name', id_label: null };
    const { file } = await build('sheet-broken', tracking);
    // The stub knows a different origin, so the course's request is blocked like any other.
    const r = await runQa({
      htmlPath: file,
      model,
      outDir: join(dir, 'review-broken'),
      profile: 'smoke',
      courseId: model.courseId,
      tracking: { ...tracking, destination: 'tracker', endpoint: 'https://elsewhere.example.org/api/events' },
    });
    expect(r.functional.summary.pass).toBe(false);
    expect(r.functional.summary.failures.join('\n')).toMatch(/tracking: .*expected sent|offline: 1 blocked/);
  }, 180_000);

  it('QA checks that an LMS receives status and score through SCORM 1.2', async () => {
    const tracking: Tracking = { destination: 'lms', endpoint: null, identity: 'name', id_label: null };
    const { file, html } = await build('lms', tracking);
    expect(checkSingleFile(html).pass).toBe(true);
    const r = await runQa({ htmlPath: file, model, outDir: join(dir, 'review-lms'), profile: 'smoke', courseId: model.courseId, tracking });
    expect(r.functional.summary.failures).toEqual([]);
  }, 180_000);

  it('a failed send is kept, retried by the learner, and recorded exactly once', async () => {
    const tracking: Tracking = { destination: 'sheet', endpoint: SHEET, identity: 'name_and_email', id_label: null };
    const { file } = await build('retry', tracking);
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const bodies: string[] = [];
    let fail = true;
    const others: string[] = [];
    await context.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file:') || u.startsWith('data:')) return route.continue();
      if (!trackingOrigins(tracking).includes(new URL(u).origin)) {
        others.push(u);
        return route.abort();
      }
      if (fail) return route.abort('internetdisconnected');
      bodies.push(route.request().postData() ?? '');
      return route.fulfill({ status: 200, body: '{"ok":true}' });
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href);
    await page.waitForFunction(() => Boolean(window.__cf));
    // Complete the assessment through the runtime's own state (answers are covered by the QA tests above).
    const graded = model.screens.filter((s) => s.graded && s.interaction);
    await page.evaluate(
      ({ key, ids }) => {
        const state = JSON.parse(localStorage.getItem(key) ?? '{"v":1,"version":"","index":0,"visited":[],"answers":{}}');
        for (const id of ids) state.answers[id] = { correct: true, attempts: 1, response: {} };
        localStorage.setItem(key, JSON.stringify(state));
      },
      { key: `cf:${model.courseId}:${model.version}`, ids: graded.map((s) => s.id) },
    );
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cf));
    const resultsId = model.screens.find((s) => s.component === 'results')!.id;
    await page.evaluate((id) => window.__cf!.go(id), resultsId);
    const panel = page.locator('[data-cf-record]');
    await expect.poll(() => panel.isVisible()).toBe(true);
    const axe = await new AxeBuilder({ page }).include('[data-cf-record]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    await panel.locator('[data-cf-record-send]').click();
    await expect.poll(() => panel.getAttribute('data-cf-record-state')).toBe('error');
    expect(await panel.locator('[data-cf-record-field="name"]').getAttribute('aria-invalid')).toBe('true');

    await panel.locator('[data-cf-record-field="name"]').fill('Test Learner');
    await panel.locator('[data-cf-record-field="email"]').fill('learner@example.com');
    await panel.locator('[data-cf-record-send]').click();
    await expect.poll(() => panel.getAttribute('data-cf-record-state')).toBe('error');
    expect(bodies).toEqual([]);

    fail = false;
    await panel.locator('[data-cf-record-send]').click();
    await expect.poll(() => panel.getAttribute('data-cf-record-state')).toBe('sent');
    expect(bodies).toHaveLength(1);
    const event = TrackingEventSchema.parse(JSON.parse(bodies[0]!));
    expect(event).toMatchObject({ courseId: model.courseId, percent: 100, passed: true, learner: { name: 'Test Learner' }, test: false });
    expect(await panel.locator('[data-cf-record-send]').isVisible()).toBe(false);

    // Reloading does not send again.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cf));
    await page.evaluate((id) => window.__cf!.go(id), resultsId);
    await expect.poll(() => panel.getAttribute('data-cf-record-state')).toBe('sent');
    expect(bodies).toHaveLength(1);
    expect(others).toEqual([]);
    await context.close();
  }, 120_000);
});
