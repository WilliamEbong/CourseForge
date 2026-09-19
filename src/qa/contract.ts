/**
 * Contract-driven QA for CourseForge-built courses: drives the documented DOM (`data-cf-*`) and `window.__cf`
 * runtime with answer keys from the course model.
 */
import type { Locator, Page } from 'playwright';
import type { Interaction } from '../core/schemas/content.js';
import type { Screen } from '../core/schemas/model.js';
import type { FunctionalReport } from '../core/schemas/reports.js';
import { TrackingEventSchema } from '../core/schemas/tracking.js';
import { type AxeScreen, runAxe } from './axe.js';
import { captureScreenshot, type QaSession, type ScreenshotItem } from './browser.js';
import { detectIssues, type FocusStep, tabThrough } from './detectors.js';

/** The part of a CourseModel the QA engine needs (a full CourseModel satisfies it). */
export interface QaModel {
  courseId: string;
  screens: Pick<Screen, 'id' | 'index' | 'moduleId' | 'kind' | 'component' | 'graded' | 'interaction' | 'citations'>[];
  glossary: readonly { id: string; term: string }[];
  references: readonly { id: string }[];
  assessment: { passingPercent: number; gradedScreenIds: string[] };
}

type QaScreen = QaModel['screens'][number];

interface CfState {
  index: number;
  visited: unknown[];
  answers: Record<string, { correct: boolean; attempts: number }>;
  graded: { answered: number; correct: number; total: number; percent: number; passed: boolean };
  progressPercent: number;
}
interface CfRuntime {
  version: number;
  screenCount(): number;
  screenIds(): string[];
  current(): { index: number; id: string };
  go(target: number | string): void;
  getState(): CfState;
  resetAssessment(): void;
}
type CfWindow = { __cf: CfRuntime };

export type ScreenResult = FunctionalReport['screens'][number];
export type InteractionResult = FunctionalReport['interactions'][number];

export interface ContractOptions {
  session: QaSession;
  viewport: number;
  outDir: string;
  /** Screen ids to traverse at this viewport (default: all). */
  screens?: string[];
  axe: ReadonlySet<string>;
  shots: ReadonlySet<string>;
  /** Run the behavioural checks (navigation, interactions, scoring, resources, keyboard, progress). */
  full: boolean;
}

export interface ContractResult {
  screens: ScreenResult[];
  axe: AxeScreen[];
  shots: ScreenshotItem[];
  behaviour: {
    interactions: InteractionResult[];
    scoring: FunctionalReport['scoring'];
    navigation: FunctionalReport['navigation'];
    resources: FunctionalReport['resources'];
    progress: FunctionalReport['progress'];
    keyboard: FunctionalReport['keyboard'];
  } | null;
}

const q = (v: string) => JSON.stringify(v);
const screenSel = (id: string) => `section.cf-screen[data-cf-screen=${q(id)}]`;
const errMsg = (e: unknown) => (e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));

export async function waitForCf(page: Page, timeout = 10_000): Promise<boolean> {
  return page
    .waitForFunction(() => typeof (window as unknown as Partial<CfWindow>).__cf?.screenCount === 'function', null, { timeout })
    .then(() => true)
    .catch(() => false);
}

const current = (page: Page) => page.evaluate(() => (window as unknown as CfWindow).__cf.current());
const cfState = (page: Page) => page.evaluate(() => (window as unknown as CfWindow).__cf.getState());

async function poll<T>(page: Page, read: () => Promise<T>, ok: (v: T) => boolean, ms = 2000): Promise<T> {
  const deadline = Date.now() + ms;
  let v = await read();
  while (!ok(v) && Date.now() < deadline) {
    await page.waitForTimeout(40);
    v = await read();
  }
  return v;
}

async function goTo(page: Page, id: string): Promise<boolean> {
  await page.evaluate((target) => (window as unknown as CfWindow).__cf.go(target), id);
  return page
    .locator(screenSel(id))
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
}

async function visibleFirst(page: Page, selector: string): Promise<Locator | null> {
  const loc = page.locator(`${selector} >> visible=true`).first();
  return (await loc.count()) > 0 ? loc : null;
}

/** Finds a visible control; opens the course menu first when it is hidden in a collapsed drawer. */
async function findControl(page: Page, selector: string): Promise<Locator | null> {
  const found = await visibleFirst(page, selector);
  if (found) return found;
  const toggle = await visibleFirst(page, 'button[data-cf-menu-toggle]');
  if (!toggle) return null;
  await toggle.click();
  await page.waitForTimeout(100);
  return visibleFirst(page, selector);
}

/* ------------------------------------------------------------------ traversal */

async function traverse(page: Page, model: QaModel, opts: ContractOptions): Promise<Pick<ContractResult, 'screens' | 'axe' | 'shots'>> {
  const screens: ScreenResult[] = [];
  const axe: AxeScreen[] = [];
  const shots: ScreenshotItem[] = [];
  const wanted = opts.screens ? new Set(opts.screens) : null;
  for (const s of model.screens) {
    if (wanted && !wanted.has(s.id)) continue;
    const errorsBefore = opts.session.pageErrors.length;
    const errors: string[] = [];
    const missingIds: string[] = [];
    const shown = await goTo(page, s.id);
    if (!shown) errors.push(`screen ${s.id} did not become visible via __cf.go`);
    if ((await page.locator(`[data-cf-block=${q(s.id)}]`).count()) === 0) missingIds.push(s.id);
    const det = await detectIssues(page, screenSel(s.id));
    // The page-level horizontal-scroll check is global; element-level ones are scoped to the screen.
    const overflow = [...det.overflow, ...det.clipped.map((c) => `clipped: ${c}`)];
    errors.push(
      ...det.brokenImages.map((b) => `broken image/svg: ${b}`),
      ...det.unnamedControls.map((c) => `control without accessible name: ${c}`),
      ...det.tinyTargets.map((t) => `advisory: target-size <24px: ${t}`),
    );
    if (opts.axe.has(s.id)) {
      try {
        axe.push({ id: s.id, viewport: opts.viewport, violations: await runAxe(page) });
      } catch (e) {
        errors.push(`axe failed: ${errMsg(e)}`);
      }
    }
    if (opts.shots.has(s.id)) shots.push(await captureScreenshot(page, opts.outDir, s.id, opts.viewport));
    errors.push(...opts.session.pageErrors.slice(errorsBefore).map((m) => `page error: ${m}`));
    const ok = errors.every((e) => e.startsWith('advisory:')) && overflow.length === 0 && missingIds.length === 0;
    screens.push({ id: s.id, index: s.index, viewport: opts.viewport, ok, errors, overflow, missingIds });
  }
  return { screens, axe, shots };
}

/* ----------------------------------------------------------------- navigation */

async function checkNavigation(page: Page, model: QaModel): Promise<FunctionalReport['navigation']> {
  const problems: string[] = [];
  const ids = await page.evaluate(() => (window as unknown as CfWindow).__cf.screenIds());
  const expected = model.screens.map((s) => s.id);
  if (ids.join('|') !== expected.join('|')) problems.push(`runtime screenIds (${ids.length}) differ from model (${expected.length})`);
  const n = expected.length;
  await goTo(page, expected[0] ?? '');
  let clicks = 0;
  for (let i = 1; i < Math.min(n, 200); i++) {
    const next = await visibleFirst(page, 'button[data-cf-nav=next]');
    if (!next) {
      problems.push(`no visible next button on screen index ${i - 1}`);
      break;
    }
    await next.click();
    clicks++;
    const cur = await poll(
      page,
      () => current(page),
      (c) => c.index === i,
      1500,
    );
    if (cur.index !== i) {
      problems.push(`next from index ${i - 1} landed on ${cur.index}`);
      break;
    }
  }
  if (n > 1 && problems.length === 0) {
    const prev = await visibleFirst(page, 'button[data-cf-nav=prev]');
    if (!prev) problems.push('no visible prev button on last screen');
    else {
      await prev.click();
      const cur = await poll(
        page,
        () => current(page),
        (c) => c.index === n - 2,
        1500,
      );
      if (cur.index !== n - 2) problems.push(`prev from last landed on ${cur.index}`);
    }
  }
  // Menu links: last screen and a middle one.
  const menuTargets = [...new Set([expected[n - 1], expected[Math.floor(n / 2)]])].filter((x): x is string => !!x);
  let menuOk = 0;
  for (const id of menuTargets) {
    await goTo(page, expected[0] ?? '');
    const link = await findControl(page, `[data-cf-nav-list] a[data-cf-goto=${q(id)}]`);
    if (!link) {
      problems.push(`menu link to ${id} not found`);
      continue;
    }
    await link.click();
    const cur = await poll(
      page,
      () => current(page),
      (c) => c.id === id,
      1500,
    );
    if (cur.id !== id) problems.push(`menu link to ${id} landed on ${cur.id}`);
    else menuOk++;
    await page.keyboard.press('Escape');
  }
  return {
    ok: problems.length === 0,
    detail: problems.length
      ? problems.join('; ')
      : `next traversed ${clicks + 1}/${n} screens first→last, prev ok, ${menuOk} menu links ok`,
  };
}

/* --------------------------------------------------------------- interactions */

async function setChecked(loc: Locator, value: boolean): Promise<void> {
  try {
    await loc.setChecked(value, { timeout: 1500 });
  } catch {
    if ((await loc.isChecked()) !== value) await loc.dispatchEvent('click');
  }
}

async function readOrder(list: Locator): Promise<string[]> {
  return list.locator('li[data-cf-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cf-key') ?? ''));
}

async function reorder(page: Page, form: Locator, target: string[]): Promise<boolean> {
  const list = form.locator('ol[data-cf-sequence]').first();
  for (let i = 0; i < target.length; i++) {
    for (let guard = 0; guard < target.length + 2; guard++) {
      const order = await readOrder(list);
      const pos = order.indexOf(target[i] ?? '');
      if (pos < 0) return false;
      if (pos <= i) break;
      await list.locator(`li[data-cf-key=${q(target[i] ?? '')}] button[data-cf-move=up]`).click();
      await poll(
        page,
        () => readOrder(list),
        (o) => o.indexOf(target[i] ?? '') === pos - 1,
        800,
      );
    }
  }
  return (await readOrder(list)).join('|') === target.join('|');
}

/** Drives one answer through real controls. Returns null when an incorrect answer cannot be constructed. */
async function applyAnswer(page: Page, form: Locator, it: Interaction, correct: boolean): Promise<string | null> {
  switch (it.mode) {
    case 'single': {
      const key = correct ? it.correctKeys[0] : it.options.find((o) => !it.correctKeys.includes(o.key))?.key;
      if (!key) return null;
      await setChecked(form.locator(`input[type=radio][value=${q(key)}]`), true);
      return `chose ${key}`;
    }
    case 'multiple': {
      const flip = it.options[0]?.key;
      for (const o of it.options) {
        let on = it.correctKeys.includes(o.key);
        if (!correct && o.key === flip) on = !on;
        await setChecked(form.locator(`input[type=checkbox][value=${q(o.key)}]`), on);
      }
      return correct ? `checked ${it.correctKeys.join(',')}` : `flipped ${flip}`;
    }
    case 'matching':
    case 'categorization': {
      const first = it.mapping[0];
      const wrong = first ? it.targets.find((t) => t.key !== first.target)?.key : undefined;
      if (!correct && !wrong) return null;
      for (const m of it.mapping) {
        const target = !correct && m === first ? (wrong ?? m.target) : m.target;
        await form.locator(`select[data-cf-key=${q(m.key)}]`).selectOption(target);
      }
      return correct ? 'mapped all per key' : `mapped ${first?.key}→${wrong}`;
    }
    case 'sequencing': {
      if (it.order.length < 2 && !correct) return null;
      if (!(await reorder(page, form, it.order))) return 'could not reach target order';
      if (!correct) {
        const list = form.locator('ol[data-cf-sequence]').first();
        await list.locator(`li[data-cf-key=${q(it.order[0] ?? '')}] button[data-cf-move=down]`).click();
        return `swapped ${it.order[0]}/${it.order[1]}`;
      }
      return `ordered ${it.order.join(',')}`;
    }
    case 'reveal':
      return correct ? 'reveal' : null;
  }
}

async function readResult(page: Page, section: Locator, expected: string): Promise<string | null> {
  const fb = section.locator('[data-cf-feedback]').first();
  return poll(
    page,
    () => fb.getAttribute('data-cf-result', { timeout: 500 }).catch(() => null),
    (v) => v === expected,
    2000,
  );
}

/** Makes the item answerable: uses the retry control, or resets the assessment if a graded item is locked. */
async function prepare(page: Page, s: QaScreen, form: Locator, isolate: boolean): Promise<void> {
  // Graded items are single-attempt by design: when testing an item in isolation, reset the assessment first.
  if (s.graded && isolate) {
    await page.evaluate(() => (window as unknown as CfWindow).__cf.resetAssessment());
    await goTo(page, s.id);
    return;
  }
  const retry = await visibleFirst(page, `${screenSel(s.id)} [data-cf-retry]`);
  if (retry) {
    await retry.click();
    return;
  }
  const submit = form.locator('[data-cf-submit]').first();
  if ((await submit.count()) && (await submit.isDisabled())) {
    await page.evaluate(() => (window as unknown as CfWindow).__cf.resetAssessment());
    await goTo(page, s.id);
  }
}

interface PathOutcome {
  status: 'pass' | 'fail' | 'skipped';
  detail: string;
}

async function answerItem(page: Page, s: QaScreen, correct: boolean, isolate = true): Promise<PathOutcome> {
  const it = s.interaction;
  if (!it) return { status: 'skipped', detail: 'no interaction' };
  if (!(await goTo(page, s.id))) return { status: 'fail', detail: 'screen not shown' };
  const section = page.locator(screenSel(s.id));
  if (it.mode === 'reveal') {
    if (!correct) return { status: 'skipped', detail: 'reveal has no incorrect path' };
    const btn = section.locator('button[data-cf-reveal]').first();
    if (!(await btn.count())) return { status: 'fail', detail: 'no [data-cf-reveal] button' };
    await btn.click();
    const expanded = await btn.getAttribute('aria-expanded');
    return expanded === 'false' ? { status: 'fail', detail: 'reveal stayed collapsed' } : { status: 'pass', detail: 'revealed' };
  }
  const form = section.locator('form.cf-question').first();
  if (!(await form.count())) return { status: 'fail', detail: 'no form.cf-question' };
  const itemId = (await form.getAttribute('data-cf-item')) ?? s.id;
  try {
    await prepare(page, s, form, isolate);
    const how = await applyAnswer(page, form, it, correct);
    if (how === null) return { status: 'skipped', detail: 'no incorrect answer constructible' };
    await form.locator('[data-cf-submit]').first().click();
    const want = correct ? 'correct' : 'incorrect';
    const got = await readResult(page, section, want);
    if (got !== want) return { status: 'fail', detail: `${how}: feedback ${got ?? 'missing'}, expected ${want}` };
    const recorded = (await cfState(page)).answers[itemId];
    if (!recorded || recorded.correct !== correct) {
      return { status: 'fail', detail: `${how}: state.answers[${itemId}] = ${JSON.stringify(recorded ?? null)}` };
    }
    return { status: 'pass', detail: how };
  } catch (e) {
    return { status: 'fail', detail: errMsg(e) };
  }
}

async function checkInteractions(page: Page, model: QaModel): Promise<InteractionResult[]> {
  const out: InteractionResult[] = [];
  for (const s of model.screens) {
    if (!s.interaction) continue;
    const ok = await answerItem(page, s, true);
    const bad = await answerItem(page, s, false);
    out.push({
      id: s.id,
      mode: s.interaction.mode,
      correctPath: ok.status,
      incorrectPath: bad.status,
      detail: `correct: ${ok.detail}; incorrect: ${bad.detail}`,
    });
  }
  return out;
}

/* -------------------------------------------------------------------- scoring */

async function checkScoring(page: Page, model: QaModel): Promise<{ scoring: FunctionalReport['scoring']; problems: string[] }> {
  const graded = model.screens.filter((s) => s.graded && s.interaction && s.interaction.mode !== 'reveal');
  if (!graded.length) return { scoring: { checked: false, expectedPercent: null, actualPercent: null, ok: true }, problems: [] };
  const problems: string[] = [];
  const resultsHost = await page
    .locator('[data-cf-results]')
    .first()
    .evaluate((el) => el.closest('[data-cf-screen]')?.getAttribute('data-cf-screen') ?? null)
    .catch(() => null);
  let expectedPercent: number | null = null;
  let actualPercent: number | null = null;
  const scenarios: [string, (i: number) => boolean][] = [
    ['all-correct', () => true],
    ['all-wrong', () => false],
  ];
  if (graded.length > 1) scenarios.push(['mixed', (i) => i < Math.ceil(graded.length / 2)]);
  for (const [name, pick] of scenarios) {
    await page.evaluate(() => (window as unknown as CfWindow).__cf.resetAssessment());
    let correctCount = 0;
    for (const [i, s] of graded.entries()) {
      let want = pick(i);
      let r = await answerItem(page, s, want, false);
      if (!want && r.status === 'skipped') {
        want = true;
        r = await answerItem(page, s, true, false);
      }
      if (r.status === 'fail') problems.push(`${name}: ${s.id} ${r.detail}`);
      if (want) correctCount++;
    }
    const exact = (100 * correctCount) / graded.length;
    const g = (await cfState(page)).graded;
    expectedPercent = Math.round(exact);
    actualPercent = g.percent;
    if (Math.abs(g.percent - exact) >= 1) problems.push(`${name}: percent ${g.percent}, expected ${expectedPercent}`);
    if (g.total !== graded.length) problems.push(`${name}: graded total ${g.total}, expected ${graded.length}`);
    if (g.passed !== g.percent >= model.assessment.passingPercent) problems.push(`${name}: passed=${g.passed} at ${g.percent}%`);
    if (name === 'all-correct' && !g.passed) problems.push('all-correct did not pass');
    if (name === 'all-wrong' && correctCount === 0 && g.passed && model.assessment.passingPercent > 0) problems.push('all-wrong passed');
    if (resultsHost && (await goTo(page, resultsHost))) {
      const res = page.locator('[data-cf-results]').first();
      const score = Number(await res.getAttribute('data-cf-score'));
      const passed = await res.getAttribute('data-cf-passed');
      if (Math.abs(score - g.percent) >= 1 || passed !== String(g.passed)) {
        problems.push(`${name}: results screen shows ${score}%/passed=${passed}, state ${g.percent}%/passed=${g.passed}`);
      }
    }
  }
  await page.evaluate(() => (window as unknown as CfWindow).__cf.resetAssessment());
  return { scoring: { checked: true, expectedPercent, actualPercent, ok: problems.length === 0 }, problems };
}

/* ------------------------------------------------------------------ resources */

async function checkDialog(
  page: Page,
  kind: string,
  dialogSel: string,
  entrySel: string,
  expected: number,
  term: string | undefined,
): Promise<{ count: number | null; problems: string[] }> {
  const problems: string[] = [];
  const openerSel = `button[data-cf-open=${kind}]`;
  const opener = await findControl(page, openerSel);
  if (!opener) return { count: null, problems: [`${kind}: no visible ${openerSel}`] };
  await opener.click();
  const dialog = page.locator(dialogSel);
  if (
    !(await dialog.waitFor({ state: 'visible', timeout: 3000 }).then(
      () => true,
      () => false,
    ))
  ) {
    return { count: null, problems: [`${kind}: ${dialogSel} did not open`] };
  }
  const count = await dialog.locator(entrySel).count();
  if (count !== expected) problems.push(`${kind}: ${count} entries, model has ${expected}`);
  const search = dialog.locator('input[type=search], input[data-cf-search]').first();
  if (term && (await search.count())) {
    await search.fill(term);
    await page.waitForTimeout(150);
    const shown = await dialog.locator(`${entrySel} >> visible=true`).count();
    if (shown < 1 || shown > count) problems.push(`${kind}: search "${term}" shows ${shown}/${count}`);
    await search.fill('');
  }
  await page.keyboard.press('Escape');
  if (
    !(await dialog.waitFor({ state: 'hidden', timeout: 2000 }).then(
      () => true,
      () => false,
    ))
  ) {
    problems.push(`${kind}: Escape did not close the dialog`);
  } else if (!(await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, openerSel))) {
    problems.push(`${kind}: focus did not return to the opener`);
  }
  return { count, problems };
}

async function checkResources(page: Page, model: QaModel): Promise<FunctionalReport['resources']> {
  const problems: string[] = [];
  const g = await checkDialog(page, 'glossary', 'dialog#cf-glossary', '[data-cf-term]', model.glossary.length, model.glossary[0]?.term);
  const r = await checkDialog(page, 'references', 'dialog#cf-references', '[data-cf-ref]', model.references.length, undefined);
  problems.push(...g.problems, ...r.problems);
  const cited = model.screens.find((s) => s.citations.length > 0);
  let citeOk = 'no cited screens';
  if (cited && (await goTo(page, cited.id))) {
    const chip = page.locator(`${screenSel(cited.id)} button[data-cf-cite]`).first();
    if (!(await chip.count())) problems.push(`citation: ${cited.id} has citations but no [data-cf-cite] chip`);
    else {
      await chip.click();
      const dlg = page.locator('dialog#cf-source');
      if (
        !(await dlg.waitFor({ state: 'visible', timeout: 3000 }).then(
          () => true,
          () => false,
        ))
      )
        problems.push('citation: #cf-source did not open');
      else {
        await dlg.locator('[data-cf-close]').first().click();
        if (
          !(await dlg.waitFor({ state: 'hidden', timeout: 2000 }).then(
            () => true,
            () => false,
          ))
        )
          problems.push('citation: close did not close #cf-source');
        else citeOk = `citation dialog ok on ${cited.id}`;
      }
    }
  }
  return {
    glossary: g.count,
    references: r.count,
    ok: problems.length === 0,
    detail: problems.length ? problems.join('; ') : `glossary ${g.count}, references ${r.count}, ${citeOk}`,
  };
}

/* ------------------------------------------------------------------- keyboard */

async function checkKeyboard(page: Page, model: QaModel): Promise<FunctionalReport['keyboard']> {
  const problems: string[] = [];
  const steps: FocusStep[] = [];
  const n = model.screens.length;
  const focusHeading = async () => {
    await page
      .locator('section.cf-screen h1.cf-screen-title >> visible=true')
      .first()
      .focus()
      .catch(() => undefined);
  };
  const pressOnNext = async (key: string, expectIndex: number) => {
    await focusHeading();
    const t = await tabThrough(page, 40, 'button[data-cf-nav=next]');
    steps.push(...t.steps);
    if (!t.reached) return problems.push(`Tab never reached the next button (${t.steps.length} stops)`);
    await page.keyboard.press(key);
    const cur = await poll(
      page,
      () => current(page),
      (c) => c.index === expectIndex,
      1500,
    );
    if (cur.index !== expectIndex) problems.push(`${key} on next button → index ${cur.index}, expected ${expectIndex}`);
  };
  await goTo(page, model.screens[0]?.id ?? '');
  if (n > 1) await pressOnNext('Enter', 1);
  if (n > 2) await pressOnNext('Space', 2);
  if (n > 1) {
    const from = (await current(page)).index;
    await focusHeading();
    await page.keyboard.press('ArrowLeft');
    const back = await poll(
      page,
      () => current(page),
      (c) => c.index === from - 1,
      1500,
    );
    if (back.index !== from - 1) problems.push(`ArrowLeft → index ${back.index}, expected ${from - 1}`);
    await focusHeading();
    await page.keyboard.press('ArrowRight');
    const fwd = await poll(
      page,
      () => current(page),
      (c) => c.index === from,
      1500,
    );
    if (fwd.index !== from) problems.push(`ArrowRight → index ${fwd.index}, expected ${from}`);
  }
  const invisible = steps.filter((s) => !s.visible).map((s) => s.element);
  const focusVisible = steps.length ? invisible.length === 0 : null;
  const detail = [
    ...problems,
    invisible.length
      ? `no visible focus indicator on: ${[...new Set(invisible)].slice(0, 5).join(', ')}`
      : `${steps.length} focus stops, all visible`,
  ].join('; ');
  return { ok: problems.length === 0, focusVisible, detail };
}

/* ------------------------------------------------------------------- progress */

async function checkProgress(page: Page, model: QaModel): Promise<{ progress: FunctionalReport['progress']; problems: string[] }> {
  const problems: string[] = [];
  const k = Math.min(2, model.screens.length - 1);
  await goTo(page, model.screens[k]?.id ?? '');
  await page.waitForTimeout(100);
  await page.reload();
  let persisted: boolean | null = null;
  if (await waitForCf(page)) {
    persisted = (await current(page)).index === k;
    if (!persisted) problems.push(`after reload index ${(await current(page)).index}, expected ${k}`);
  } else problems.push('runtime missing after reload');

  let resetOk: boolean | null = false;
  const host = await page
    .locator('button[data-cf-action=reset-course]')
    .first()
    .evaluate((el) => el.closest('[data-cf-screen]')?.getAttribute('data-cf-screen') ?? null)
    .catch(() => undefined);
  if (host === undefined) problems.push('no button[data-cf-action=reset-course]');
  else {
    if (host) await goTo(page, host);
    const btn = await findControl(page, 'button[data-cf-action=reset-course]');
    if (!btn) problems.push('reset-course button not visible');
    else {
      await btn.click();
      const yes = page.locator('dialog#cf-confirm button[data-cf-confirm=yes]');
      if (
        !(await yes.waitFor({ state: 'visible', timeout: 3000 }).then(
          () => true,
          () => false,
        ))
      )
        problems.push('#cf-confirm did not open');
      else {
        await yes.click();
        const st = await poll(
          page,
          () => cfState(page),
          (s) => s.index === 0,
          2000,
        );
        resetOk = st.index === 0 && Object.keys(st.answers).length === 0 && st.visited.length <= 1;
        if (!resetOk)
          problems.push(`after reset: index ${st.index}, answers ${Object.keys(st.answers).length}, visited ${st.visited.length}`);
      }
    }
  }
  return { progress: { persisted, resetOk }, problems };
}

/* ------------------------------------------------------------------- tracking */

interface TrackingData {
  destination: 'lms' | 'sheet' | 'tracker';
  identity: 'name' | 'name_and_id' | 'name_and_email';
  recordScreen: string;
}

/** Completes the course as a learner would: every graded question answered correctly, every screen visited. */
async function completeCourse(page: Page, model: QaModel): Promise<string[]> {
  const problems: string[] = [];
  for (const s of model.screens) {
    if (s.graded && s.interaction) {
      const r = await answerItem(page, s, true, false);
      if (r.status === 'fail') problems.push(`could not answer ${s.id}: ${r.detail}`);
    } else await goTo(page, s.id);
  }
  return problems;
}

/** A stand-in for an LMS's SCORM 1.2 `API` object that records every call. */
const FAKE_SCORM_API = `(() => {
  const calls = [];
  let status = 'not attempted';
  window.__scormCalls = calls;
  const log = (...c) => { calls.push(c); return 'true'; };
  window.API = {
    LMSInitialize: (a) => log('LMSInitialize', a),
    LMSFinish: (a) => log('LMSFinish', a),
    LMSGetValue: (n) => { calls.push(['LMSGetValue', n]); return n === 'cmi.core.lesson_status' ? status : ''; },
    LMSSetValue: (n, v) => { if (n === 'cmi.core.lesson_status') status = v; return log('LMSSetValue', n, v); },
    LMSCommit: (a) => log('LMSCommit', a),
    LMSGetLastError: () => '0',
  };
})();`;

async function checkLmsTracking(page: Page, model: QaModel, session: QaSession, t: TrackingData, graded: boolean): Promise<string[]> {
  const lms = await session.newPage(1440);
  try {
    await lms.addInitScript(FAKE_SCORM_API);
    await lms.goto(page.url().replace(/#.*$/, ''), { waitUntil: 'load' });
    if (!(await waitForCf(lms))) return ['runtime missing on the SCORM test page'];
    await lms.evaluate(() => (window as unknown as CfWindow).__cf.resetAssessment());
    const problems = await completeCourse(lms, model);
    await goTo(lms, t.recordScreen);
    const calls = await lms.evaluate(() => (window as unknown as { __scormCalls: string[][] }).__scormCalls);
    const last = (name: string) => calls.filter((c) => c[0] === 'LMSSetValue' && c[1] === name).at(-1)?.[2] ?? 'never set';
    const want = graded ? 'passed' : 'completed';
    if (!calls.some((c) => c[0] === 'LMSInitialize')) problems.push('LMSInitialize was not called');
    if (last('cmi.core.lesson_status') !== want) problems.push(`lesson_status ${last('cmi.core.lesson_status')}, expected ${want}`);
    if (graded && last('cmi.core.score.raw') !== '100') problems.push(`score.raw ${last('cmi.core.score.raw')}, expected 100`);
    if (!calls.some((c) => c[0] === 'LMSCommit')) problems.push('LMSCommit was not called');
    return problems;
  } finally {
    await lms.context().close();
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Tracked builds only (ADR 0013). Web destinations: completing the course and pressing "Record my result" sends
 * exactly one well-formed result to the stubbed origin. LMS: a fake SCORM 1.2 API receives status and score.
 */
async function checkTracking(page: Page, model: QaModel, session: QaSession): Promise<string[]> {
  const t = (await page
    .evaluate(() => (JSON.parse(document.getElementById('cf-data')?.textContent ?? '{}') as { tracking?: unknown }).tracking ?? null)
    .catch(() => null)) as TrackingData | null;
  if (!t) return [];
  const graded = model.screens.some((s) => s.graded && s.interaction);
  if (t.destination === 'lms') return checkLmsTracking(page, model, session, t, graded);

  await page.evaluate(() => (window as unknown as CfWindow).__cf.resetAssessment());
  const problems = await completeCourse(page, model);
  if (!(await goTo(page, t.recordScreen))) return [...problems, `record screen ${t.recordScreen} not shown`];
  const panel = page.locator('[data-cf-record]');
  if (!(await panel.isVisible())) return [...problems, 'record panel not shown on the record screen after completion'];
  const before = session.tracked.length;
  await panel.locator('[data-cf-record-field="name"]').fill('QA Learner');
  if (t.identity === 'name_and_id') await panel.locator('[data-cf-record-field="id"]').fill('QA-001');
  if (t.identity === 'name_and_email') await panel.locator('[data-cf-record-field="email"]').fill('qa.learner@example.com');
  await panel.locator('[data-cf-record-send]').click();
  const state = await poll(
    page,
    () => panel.getAttribute('data-cf-record-state'),
    (s) => s === 'sent' || s === 'error',
    5000,
  );
  if (state !== 'sent') problems.push(`record status ${state ?? 'none'}, expected sent`);
  const sent = session.tracked.slice(before);
  if (sent.length !== 1) return [...problems, `${sent.length} result request(s) sent, expected 1`];
  if (sent[0]!.method !== 'POST') problems.push(`result sent with ${sent[0]!.method}, expected POST`);
  const parsed = TrackingEventSchema.safeParse(parseJson(sent[0]!.body));
  if (!parsed.success) problems.push(`result is not a valid tracking event: ${parsed.error.issues[0]?.message ?? ''}`);
  else if (graded && parsed.data.percent !== 100) problems.push(`result percent ${parsed.data.percent}, expected 100`);
  return problems;
}

/* ----------------------------------------------------------------------- main */

/**
 * Runs contract QA on a page that already shows the course (window.__cf present). Failures are returned in
 * `failures` alongside the structured results; nothing is thrown for course defects.
 */
export async function runContractQa(page: Page, model: QaModel, opts: ContractOptions): Promise<ContractResult & { failures: string[] }> {
  const t = await traverse(page, model, opts);
  if (!opts.full) return { ...t, behaviour: null, failures: [] };
  const failures: string[] = [];
  const navigation = await checkNavigation(page, model);
  const interactions = await checkInteractions(page, model);
  const { scoring, problems: scoringProblems } = await checkScoring(page, model);
  failures.push(...scoringProblems.map((p) => `scoring: ${p}`));
  const resources = await checkResources(page, model);
  const keyboard = await checkKeyboard(page, model);
  const { progress, problems: progressProblems } = await checkProgress(page, model);
  failures.push(...progressProblems.map((p) => `progress: ${p}`));
  failures.push(...(await checkTracking(page, model, opts.session)).map((p) => `tracking: ${p}`));
  return { ...t, behaviour: { interactions, scoring, navigation, resources, progress, keyboard }, failures };
}
