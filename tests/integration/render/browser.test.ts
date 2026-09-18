/**
 * Browser behaviour of the built smoke course (one Chromium, file:// URL, all non-file requests aborted).
 * Run with --maxWorkers=1 on low-RAM machines.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repoRoot } from '../../../src/core/paths.js';
import type { Interaction } from '../../../src/core/schemas/content.js';
import { renderCourse } from '../../../src/renderer/index.js';
import { loadSmoke } from './smoke.js';

const { model, visuals } = loadSmoke();
const byId = new Map(model.screens.map((s) => [s.id, s]));
const items = model.screens.filter((s) => s.interaction);
const formative = items.filter((s) => !s.graded);
const graded = items.filter((s) => s.graded);
const resultsId = model.screens.find((s) => s.component === 'results')!.id;
const SHOTS = join(repoRoot(), 'tests', '.tmp', 'screens');

let browser: Browser;
let dir: string;
let url: string;
const blocked: string[] = [];
const consoleErrors: string[] = [];

async function open(width = 1440, ctxOpts: { storage?: BrowserContext } = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context =
    ctxOpts.storage ??
    (await browser.newContext({ viewport: { width, height: width > 800 ? 900 : 844 }, reducedMotion: 'reduce', colorScheme: 'light' }));
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:')) return route.continue();
    blocked.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.__cf));
  return { context, page };
}

const go = (page: Page, id: string) => page.evaluate((i) => window.__cf!.go(i), id);
const form = (id: string) => `form[data-cf-item="${id}"]`;

async function answer(page: Page, id: string, i: Interaction, correct: boolean): Promise<void> {
  const f = form(id);
  switch (i.mode) {
    case 'single': {
      const key = correct ? i.correctKeys[0]! : i.options.find((o) => !i.correctKeys.includes(o.key))!.key;
      await page.check(`${f} input[value="${key}"]`);
      break;
    }
    case 'multiple': {
      const keys = correct ? i.correctKeys : [i.options.find((o) => !i.correctKeys.includes(o.key))!.key];
      for (const k of keys) await page.check(`${f} input[value="${k}"]`);
      break;
    }
    case 'matching':
    case 'categorization': {
      const targets = i.targets.map((t) => t.key);
      for (const m of i.mapping) {
        const wrong = targets.find((t) => t !== m.target)!;
        await page.selectOption(`${f} select[data-cf-key="${m.key}"]`, correct ? m.target : wrong);
      }
      break;
    }
    case 'sequencing': {
      const target = correct ? i.order : [...i.order].reverse();
      for (let pos = 0; pos < target.length; pos++) {
        for (;;) {
          const keys = await page.$$eval(`${f} [data-cf-sequence] > li`, (els) => els.map((e) => (e as HTMLElement).dataset.cfKey));
          if (keys.indexOf(target[pos]) <= pos) break;
          await page.click(`${f} li[data-cf-key="${target[pos]}"] [data-cf-move="up"]`);
        }
      }
      break;
    }
    case 'reveal':
      await page.click(`${f} [data-cf-reveal]`);
      return;
  }
  await page.click(`${f} [data-cf-submit]`);
}

const result = (page: Page, id: string) => page.getAttribute(`${form(id)} [data-cf-feedback]`, 'data-cf-result');

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cf-render-'));
  const { html } = await renderCourse(model, { visuals, mode: 'release' });
  const file = join(dir, 'course.html');
  writeFileSync(file, html);
  url = pathToFileURL(file).href;
  browser = await chromium.launch();
  mkdirSync(SHOTS, { recursive: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('built course in Chromium', () => {
  it('@G3 @G5 traverses every screen with the Next button, offline, focusing each heading', async () => {
    const { context, page } = await open();
    expect(await page.evaluate(() => window.__cf!.screenCount())).toBe(model.screens.length);
    for (let i = 0; i < model.screens.length; i++) {
      const s = model.screens[i]!;
      expect(await page.evaluate(() => window.__cf!.current().id)).toBe(s.id);
      expect(await page.isVisible(`#screen-${s.id}`)).toBe(true);
      expect(await page.locator('section.cf-screen:not([hidden])').count()).toBe(1);
      if (i > 0) expect(await page.evaluate(() => document.activeElement?.classList.contains('cf-screen-title'))).toBe(true);
      if (i < model.screens.length - 1) await page.click('button[data-cf-nav="next"]');
    }
    expect(await page.isDisabled('button[data-cf-nav="next"]')).toBe(true);
    expect(page.url()).toContain(`#/s/${model.screens.at(-1)!.id}`);
    await page.click('button[data-cf-nav="prev"]');
    expect(await page.evaluate(() => window.__cf!.current().index)).toBe(model.screens.length - 2);
    const state = await page.evaluate(() => window.__cf!.getState());
    expect(state.progressPercent).toBe(100);
    expect(blocked).toEqual([]);
    await context.close();
  }, 120_000);

  it('@G5 every formative item gives correct and incorrect feedback through real controls', async () => {
    const { context, page } = await open();
    for (const s of formative) {
      const i = s.interaction!;
      await go(page, s.id);
      if (i.mode === 'reveal') {
        await answer(page, s.id, i, true);
        expect(await result(page, s.id)).toBe('correct');
        expect(await page.getAttribute(`${form(s.id)} [data-cf-reveal]`, 'aria-expanded')).toBe('true');
        continue;
      }
      if (i.mode !== 'sequencing') {
        // incomplete submit is not graded (a sequence is always complete)
        await page.click(`${form(s.id)} [data-cf-submit]`);
        expect(await result(page, s.id)).toBeNull();
        expect(await page.isVisible(`${form(s.id)} [data-cf-fb="incomplete"]`)).toBe(true);
      }

      await answer(page, s.id, i, false);
      expect(await result(page, s.id), `${s.id} incorrect`).toBe('incorrect');
      expect(await page.isVisible(`${form(s.id)} [data-cf-fb="incorrect"]`)).toBe(true);
      await page.click(`${form(s.id)} [data-cf-retry]`);
      expect(await result(page, s.id)).toBeNull();
      await answer(page, s.id, i, true);
      expect(await result(page, s.id), `${s.id} correct`).toBe('correct');
      expect(await page.isVisible(`${form(s.id)} [data-cf-fb="correct"]`)).toBe(true);
    }
    const answers = (await page.evaluate(() => window.__cf!.getState())).answers;
    for (const s of formative) expect(answers[s.id]?.correct, s.id).toBe(true);
    expect(answers[formative.find((s) => s.interaction!.mode !== 'reveal')!.id]!.attempts).toBe(2);
    await context.close();
  }, 120_000);

  it('@G6 graded assessment: all correct scores 100%, all wrong scores 0% after retake via in-page confirm', async () => {
    const { context, page } = await open();
    for (const s of graded) {
      await go(page, s.id);
      await answer(page, s.id, s.interaction!, true);
      expect(await page.isVisible(`${form(s.id)} [data-cf-fb="recorded"]`)).toBe(true);
      expect(await page.isVisible(`${form(s.id)} [data-cf-retry]`)).toBe(false);
    }
    await go(page, resultsId);
    const results = page.locator('[data-cf-results]');
    expect(await results.getAttribute('data-cf-score')).toBe('100');
    expect(await results.getAttribute('data-cf-passed')).toBe('true');
    expect(await page.textContent('[data-cf-results-verdict]')).toBe('Passed');
    expect(await page.locator('[data-cf-review-item][data-cf-state="correct"]').count()).toBe(graded.length);
    await page.screenshot({ path: join(SHOTS, 'results-1440.png') });

    await page.click('[data-cf-results] button[data-cf-action="reset-assessment"]');
    expect(await page.isVisible('dialog#cf-confirm')).toBe(true);
    await page.click('button[data-cf-confirm="yes"]');
    await page.waitForFunction((id) => window.__cf!.current().id === id, graded[0]!.id);
    for (const s of graded) {
      await go(page, s.id);
      await answer(page, s.id, s.interaction!, false);
    }
    await go(page, resultsId);
    expect(await results.getAttribute('data-cf-score')).toBe('0');
    expect(await results.getAttribute('data-cf-passed')).toBe('false');
    const g = (await page.evaluate(() => window.__cf!.getState())).graded;
    expect(g).toEqual({ answered: graded.length, correct: 0, total: graded.length, percent: 0, passed: false });
    await context.close();
  }, 120_000);

  it('@G7 glossary, references and citation dialogs open, search, and close with Escape returning focus', async () => {
    const { context, page } = await open();
    await page.click('button[data-cf-open="glossary"]');
    expect(await page.isVisible('dialog#cf-glossary')).toBe(true);
    expect(await page.locator('#cf-glossary [data-cf-term]').count()).toBe(model.glossary.length);
    await page.fill('#cf-glossary [data-cf-filter]', 'exposure');
    expect(await page.locator('#cf-glossary [data-cf-term]:visible').count()).toBe(1);
    await page.keyboard.press('Escape');
    expect(await page.isVisible('dialog#cf-glossary')).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-cf-open'))).toBe('glossary');

    await page.click('button[data-cf-open="references"]');
    expect(await page.locator('#cf-references [data-cf-ref]').count()).toBe(model.references.length);
    await page.click('#cf-references [data-cf-close]');
    expect(await page.isVisible('dialog#cf-references')).toBe(false);

    const cited = model.screens.find((s) => s.citations.some((c) => c.locator))!;
    await go(page, cited.id);
    const chip = page.locator(`#screen-${cited.id} button[data-cf-cite]`).first();
    await chip.click();
    expect(await page.isVisible('dialog#cf-source')).toBe(true);
    const ref = model.references.find((r) => r.id === cited.citations[0]!.sourceId)!;
    expect(await page.textContent('#cf-source [data-cf-source-body]')).toContain(ref.title);
    expect(await page.textContent('[data-cf-source-locator-text]')).toBe(cited.citations[0]!.locator);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-cf-cite'))).toBe(true);

    const term = page.locator('button[data-cf-term-link]:visible').first();
    await go(page, 'SDS-02');
    await term.click();
    expect(await page.isVisible('dialog#cf-glossary')).toBe(true);
    expect(await page.locator('#cf-glossary [data-cf-highlight]').count()).toBe(1);
    await page.keyboard.press('Escape');
    await context.close();
  }, 120_000);

  it('@G8 progress persists across reload and resets through the confirm dialog', async () => {
    const { context, page } = await open();
    for (const id of ['SDS-02', 'SDS-03', 'SDS-05']) await go(page, id);
    await answer(page, 'SDS-05', byId.get('SDS-05')!.interaction!, true);
    const before = await page.evaluate(() => window.__cf!.getState());
    expect(before.progressPercent).toBeGreaterThan(0);
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__cf));
    const after = await page.evaluate(() => window.__cf!.getState());
    expect(after.index).toBe(before.index);
    expect(after.visited).toEqual(before.visited);
    expect(after.answers['SDS-05']).toEqual({ correct: true, attempts: 1 });
    expect(await result(page, 'SDS-05')).toBe('correct');
    expect(Number(await page.getAttribute('[data-cf-progress]', 'aria-valuenow'))).toBe(before.progressPercent);

    await page.click('[data-cf-nav-list] button[data-cf-action="reset-course"]');
    await page.click('button[data-cf-confirm="no"]');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    expect((await page.evaluate(() => window.__cf!.getState())).visited.length).toBe(before.visited.length);
    await page.click('[data-cf-nav-list] button[data-cf-action="reset-course"]');
    await page.click('button[data-cf-confirm="yes"]');
    await page.waitForFunction(() => window.__cf!.getState().visited.length === 1);
    const reset = await page.evaluate(() => window.__cf!.getState());
    expect(reset.index).toBe(0);
    expect(reset.visited).toEqual([model.screens[0]!.id]);
    expect(reset.answers).toEqual({});
    expect(await result(page, 'SDS-05')).toBeNull();
    await context.close();
  }, 120_000);

  it('@J3 @J4 keyboard reaches navigation with a visible focus indicator; arrows navigate outside controls', async () => {
    const { context, page } = await open();
    let found = false;
    for (let n = 0; n < 80 && !found; n++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement?.getAttribute('data-cf-nav') === 'next');
    }
    expect(found).toBe(true);
    const focus = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth), shadow: s.boxShadow };
    });
    expect(focus.style !== 'none' && focus.width >= 2).toBe(true);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__cf!.current().index)).toBe(1);
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => window.__cf!.current().index)).toBe(2);
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => window.__cf!.current().index)).toBe(1);

    // sequencing is fully keyboard operable
    const seq = formative.find((s) => s.interaction!.mode === 'sequencing')!;
    await go(page, seq.id);
    const firstKey = await page.getAttribute(`${form(seq.id)} [data-cf-sequence] > li:nth-child(2)`, 'data-cf-key');
    await page.focus(`${form(seq.id)} [data-cf-sequence] > li:nth-child(2) [data-cf-move="up"]`);
    await page.keyboard.press('Enter');
    expect(await page.getAttribute(`${form(seq.id)} [data-cf-sequence] > li:nth-child(1)`, 'data-cf-key')).toBe(firstKey);
    await page.keyboard.press('ArrowRight'); // inside a form: must not navigate
    expect(await page.evaluate(() => window.__cf!.current().id)).toBe(seq.id);

    // mobile drawer is a modal dialog with focus inside and Escape to close
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('button[data-cf-menu-toggle]');
    expect(await page.isVisible('dialog#cf-nav-dialog')).toBe(true);
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog#cf-nav-dialog')))).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-cf-menu-toggle'))).toBe(true);
    await page.click('button[data-cf-menu-toggle]');
    await page.click('#cf-nav-dialog a[data-cf-goto="SDS-03"]');
    expect(await page.isVisible('dialog#cf-nav-dialog')).toBe(false);
    expect(await page.evaluate(() => window.__cf!.current().id)).toBe('SDS-03');
    await context.close();
  }, 120_000);

  it('@J1 @J2 axe finds no serious or critical violations on any screen at 1440 and 390 px', async () => {
    const violations: string[] = [];
    for (const width of [1440, 390]) {
      const { context, page } = await open(width);
      for (const s of model.screens) {
        await go(page, s.id);
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        for (const v of res.violations) {
          if (v.impact === 'serious' || v.impact === 'critical')
            violations.push(`${width} ${s.id} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        }
      }
      // dialogs too
      await page.click('button[data-cf-open="glossary"]');
      const dlg = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      for (const v of dlg.violations) if (v.impact === 'serious' || v.impact === 'critical') violations.push(`${width} glossary ${v.id}`);
      for (const [id, name] of [
        ['SDS-01', 'landing'],
        ['SDS-08', 'process'],
        ['SDS-13', 'matching'],
      ] as const) {
        await page.keyboard.press('Escape');
        await go(page, id);
        await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`) });
      }
      await context.close();
    }
    expect(violations).toEqual([]);
  }, 300_000);

  it('@G9 CSP holds for graphics that carry style attributes, entities and SVG <style> blocks', async () => {
    // Shapes typical of Mermaid / D3 output: quoted fonts, single-quoted attributes, escaped selectors.
    const tricky = new Map(visuals);
    tricky.set('V-01', {
      renderer: 'mermaid',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" role="img"><title>t</title><style>.cf-t-a &gt; rect{fill:var(--cf-viz-1)} text{font-family:"trebuchet ms"}</style><g class="cf-t-a"><rect width="40" height="20" style="stroke: var(--cf-border); font-family: &quot;Segoe UI&quot;, sans-serif;"/></g><text x="50" y="20" style='fill:var(--cf-fg);opacity:.9'>A &amp; B</text><rect x="80" width="5" height="5" style=""/></svg>`,
    });
    const { html } = await renderCourse(model, { visuals: tricky, mode: 'release' });
    const file = join(dir, 'tricky.html');
    writeFileSync(file, html);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(pathToFileURL(file).href);
    await page.waitForFunction(() => Boolean(window.__cf));
    await go(page, 'SDS-08');
    await page.waitForTimeout(100);
    expect(errors).toEqual([]);
    await context.close();
  }, 60_000);

  it('@G9 produced no console errors and attempted no network requests', () => {
    expect(consoleErrors).toEqual([]);
    expect(blocked).toEqual([]);
  });
});
