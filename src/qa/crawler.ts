/**
 * Heuristic crawler for ARBITRARY imported HTML courses (no CourseForge contract). Controls are discovered by
 * role + accessible name; states are deduplicated by a hash of location.hash + visible main text + main control
 * names. Exploration: linear "next" traversal first (e-learning), then menu links (each followed by a linear
 * walk, bounded by maxDepth), then dialog openers. Reports reachability / errors / a11y, never answer correctness.
 */
import type { Page } from 'playwright';
import { sha256Hex } from '../core/hash.js';
import type { FunctionalReport } from '../core/schemas/reports.js';
import { type AxeScreen, runAxe } from './axe.js';
import { captureScreenshot, type QaSession, type ScreenshotItem } from './browser.js';
import type { ScreenResult } from './contract.js';
import { detectIssues, type FocusStep, focusedElementStyle } from './detectors.js';

export type ControlKind = 'next' | 'prev' | 'menu' | 'navlink' | 'dialog' | 'submit' | 'unsafe' | 'external' | 'other';

export interface Control {
  qid: string;
  name: string;
  kind: ControlKind;
  inMain: boolean;
  disabled: boolean;
}

export interface CrawlOptions {
  session: QaSession;
  viewport: number;
  outDir: string;
  maxStates?: number;
  maxDepth?: number;
  maxMs?: number;
  /** Full exploration (menu, dialogs, forms, keyboard) vs. a linear replay (secondary viewports). */
  explore: boolean;
  /** Number of states to run axe / screenshot on (evenly spread), or 'all'. */
  axeSample: number | 'all';
  shotSample: number | 'all';
  /** Expected number of states, used to spread samples (defaults to a detected SPA hook count, else 40). */
  expectedStates?: number;
}

export interface CrawlResult {
  screens: ScreenResult[];
  axe: AxeScreen[];
  shots: ScreenshotItem[];
  crawl: NonNullable<FunctionalReport['crawl']>;
  navigation: FunctionalReport['navigation'];
  resources: FunctionalReport['resources'];
  keyboard: FunctionalReport['keyboard'];
  /** Screen count from a detected SPA hook (`window.<x>.screenCount()`), for cross-checking reachability. */
  knownScreenCount: number | null;
  linearStates: number;
  failures: string[];
}

/** Names without digits: menu entries often carry live counters ("3/12") that change as screens are visited. */
const norm = (name: string) => name.replace(/\d+/g, '#');
const errMsg = (e: unknown) => (e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));

/** Marks visible controls with `data-cfqa` and classifies them by role + accessible name. */
export async function discoverControls(page: Page): Promise<Control[]> {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-cfqa]')) el.removeAttribute('data-cfqa');
    const main = document.querySelector('main, [role=main]');
    const sel = 'button, a[href], [role=button], [role=link], [role=tab], [role=menuitem], summary, input[type=button], input[type=submit]';
    const out: { qid: string; name: string; kind: string; inMain: boolean; disabled: boolean }[] = [];
    let n = 0;
    for (const el of document.querySelectorAll(sel)) {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || el.getClientRects().length === 0) continue;
      const name = (
        el.getAttribute('aria-label') ||
        (el as HTMLElement).innerText ||
        el.getAttribute('title') ||
        (el as HTMLInputElement).value ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      const href = el.getAttribute('href');
      const disabled = (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
      let kind = 'other';
      if (href && !href.startsWith('#') && !/^javascript:/i.test(href)) kind = 'external';
      else if (/\b(reset|restart|clear|delete|remove|erase|start over|log ?out|sign ?out)\b/i.test(name)) kind = 'unsafe';
      else if (
        el.getAttribute('rel') === 'next' ||
        (/\b(next|continue|forward|proceed)\b|→|›|»/i.test(name) && !/\bprev|\bback\b|←|‹|«/i.test(name))
      )
        kind = 'next';
      else if (el.getAttribute('rel') === 'prev' || /\bprev(ious)?\b|\bback\b|←|‹|«/i.test(name)) kind = 'prev';
      else if (el.hasAttribute('aria-expanded') && (el.hasAttribute('aria-controls') || /menu|contents|navigation|outline|☰/i.test(name)))
        kind = 'menu';
      else if (el.getAttribute('aria-haspopup') === 'dialog') kind = 'dialog';
      else if (el.closest('nav, [role=navigation], [role=tree], [role=tablist]')) kind = 'navlink';
      else if (name.length < 40 && /\b(glossary|references|resources|sources|about|help|information)\b/i.test(name)) kind = 'dialog';
      else if ((el as HTMLButtonElement).type === 'submit' || /^(check|submit|confirm|answer)\b/i.test(name)) kind = 'submit';
      else if (el.closest('aside')) kind = 'navlink';
      const qid = String(n++);
      el.setAttribute('data-cfqa', qid);
      out.push({ qid, name, kind, inMain: !!main?.contains(el), disabled });
    }
    return out;
  }) as Promise<Control[]>;
}

/** sha256 of location.hash + normalised visible main text (first 2 KB) + sorted visible main control names. */
export async function stateHash(page: Page): Promise<string> {
  const raw = await page.evaluate(() => {
    const main = document.querySelector('main, [role=main]') ?? document.body;
    const text = ((main as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2048);
    const names = [...main.querySelectorAll('button, a[href], [role=button], input, select')]
      .filter((el) => el.checkVisibility())
      .map((el) => (el.getAttribute('aria-label') || (el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim())
      .sort();
    const dialog = document.querySelector('dialog[open], [role=dialog]:not([hidden]), [role=alertdialog]:not([hidden])');
    const dlg = dialog?.checkVisibility() ? ((dialog as HTMLElement).innerText || '').slice(0, 200) : '';
    return `${location.hash}\n${text}\n${names.join('|')}\n${dlg}`;
  });
  return sha256Hex(raw);
}

/** Screen count exposed by a known SPA hook (any `window.<x>` with a `screenCount()` function). */
async function knownHookCount(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    for (const k of Object.keys(w)) {
      const v = w[k] as { screenCount?: unknown } | null;
      if (v && typeof v === 'object' && typeof v.screenCount === 'function' && k !== '__cf') {
        const n = (v.screenCount as () => unknown)();
        if (typeof n === 'number') return n;
      }
    }
    return null;
  });
}

const pickNext = (controls: Control[]): Control | undefined => {
  const nexts = controls.filter((c) => c.kind === 'next' && !c.disabled);
  return nexts.find((c) => c.inMain && /^next\b/i.test(c.name)) ?? nexts.find((c) => c.inMain) ?? nexts[0];
};

export async function runCrawlQa(page: Page, opts: CrawlOptions): Promise<CrawlResult> {
  const maxStates = opts.maxStates ?? 200;
  const maxDepth = opts.maxDepth ?? 40;
  const deadline = Date.now() + (opts.maxMs ?? 10 * 60_000);
  const { session, viewport } = opts;
  const screens: ScreenResult[] = [];
  const axe: AxeScreen[] = [];
  const shots: ScreenshotItem[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  const controlNames = new Set<string>();
  let truncated = false;
  let deepest = 0;

  await page.waitForTimeout(200);
  const knownScreenCount = await knownHookCount(page).catch(() => null);
  const expected = opts.expectedStates ?? knownScreenCount ?? 40;
  const sampled = (idx: number, sample: number | 'all') => {
    if (sample === 'all') return true;
    if (sample <= 0) return false;
    const stride = Math.max(1, Math.ceil(expected / sample));
    return idx % stride === 0 && idx / stride < sample;
  };
  const budgetLeft = () => {
    if (seen.size >= maxStates || Date.now() > deadline) truncated = true;
    return !truncated;
  };

  const click = async (c: Control) => {
    await page.locator(`[data-cfqa="${c.qid}"]`).click({ timeout: 3000 });
  };
  const waitChange = async (before: string) => {
    const end = Date.now() + 1500;
    let h = await stateHash(page);
    while (h === before && Date.now() < end) {
      await page.waitForTimeout(40);
      h = await stateHash(page);
    }
    return h;
  };

  const tryForms = async (): Promise<string[]> => {
    const touched = await page.evaluate(() => {
      const main = document.querySelector('main, [role=main]') ?? document.body;
      const vis = (el: Element) => el.checkVisibility();
      let n = 0;
      const groups = new Set<string>();
      for (const r of main.querySelectorAll<HTMLInputElement>('input[type=radio]')) {
        if (!vis(r) && !vis(r.closest('label') ?? r)) continue;
        if (groups.has(r.name)) continue;
        groups.add(r.name);
        r.click();
        n++;
      }
      const cb = [...main.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find((c) => vis(c) || vis(c.closest('label') ?? c));
      if (cb && !cb.checked) {
        cb.click();
        n++;
      }
      for (const s of main.querySelectorAll('select')) {
        if (!vis(s) || s.options.length < 2) continue;
        s.selectedIndex = 1;
        s.dispatchEvent(new Event('input', { bubbles: true }));
        s.dispatchEvent(new Event('change', { bubbles: true }));
        n++;
      }
      return n;
    });
    if (!touched) return [];
    const submit = (await discoverControls(page)).find((c) => c.kind === 'submit' && c.inMain && !c.disabled);
    if (!submit) return [`form: ${touched} inputs set, no submit control`];
    try {
      await click(submit);
      await page.waitForTimeout(120);
      return [];
    } catch (e) {
      return [`form submit "${submit.name}" failed: ${errMsg(e)}`];
    }
  };

  /** Records a new state: detectors, sampled axe + screenshot, page errors since `errorsBefore`. */
  const record = async (hash: string, errorsBefore: number, depth: number) => {
    seen.add(hash);
    deepest = Math.max(deepest, depth);
    const idx = screens.length;
    const id = `state-${String(idx + 1).padStart(3, '0')}`;
    const errors: string[] = [];
    const det = await detectIssues(page).catch((e: unknown) => {
      errors.push(`detectors failed: ${errMsg(e)}`);
      return null;
    });
    const overflow = det ? [...det.overflow, ...det.clipped.map((c) => `clipped: ${c}`)] : [];
    if (det) {
      errors.push(
        ...det.brokenImages.map((b) => `broken image/svg: ${b}`),
        ...det.unnamedControls.map((c) => `control without accessible name: ${c}`),
        ...det.tinyTargets.map((t) => `advisory: target-size <24px: ${t}`),
      );
    }
    if (sampled(idx, opts.axeSample)) {
      try {
        axe.push({ id, viewport, violations: await runAxe(page) });
      } catch (e) {
        errors.push(`axe failed: ${errMsg(e)}`);
      }
    }
    if (sampled(idx, opts.shotSample)) shots.push(await captureScreenshot(page, opts.outDir, id, viewport));
    if (opts.explore) {
      errors.push(...(await tryForms()));
      seen.add(await stateHash(page)); // post-answer rendering of the same screen is not a new state
    }
    errors.push(...session.pageErrors.slice(errorsBefore).map((m) => `page error: ${m}`));
    const ok = errors.every((e) => e.startsWith('advisory:')) && overflow.length === 0;
    screens.push({ id, index: idx, viewport, ok, errors, overflow, missingIds: [] });
  };

  /** Follows "next" until it stops changing state, hits a seen state, or the budget runs out. */
  const linearWalk = async (startDepth: number, depthLimit: number): Promise<number> => {
    let depth = startDepth;
    let added = 0;
    for (;;) {
      const before = session.pageErrors.length;
      const h = await stateHash(page);
      if (!seen.has(h)) {
        if (!budgetLeft()) break;
        await record(h, before, depth);
        added++;
      }
      if (depth >= depthLimit) break;
      const controls = await discoverControls(page);
      for (const c of controls) controlNames.add(`${c.kind}: ${norm(c.name)}`);
      const next = pickNext(controls);
      if (!next) break;
      try {
        await click(next);
      } catch {
        break;
      }
      const h2 = await waitChange(h);
      if (h2 === h || seen.has(h2)) break;
      depth++;
    }
    return added;
  };

  /* keyboard: Tab to a next control from the top, activate with Enter */
  const focusSteps: FocusStep[] = [];
  let keyboard: FunctionalReport['keyboard'] = { ok: null, focusVisible: null, detail: 'not checked (linear replay)' };
  const startHash = await stateHash(page);
  if (opts.explore) {
    const before = session.pageErrors.length;
    await record(startHash, before, 0);
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press('Tab');
      const s = await focusedElementStyle(page);
      if (s) focusSteps.push(s);
      reached = await page.evaluate(() => {
        const el = document.activeElement;
        const name = (el?.getAttribute('aria-label') || (el as HTMLElement | null)?.innerText || '').trim();
        return !!el && /\b(next|continue|forward)\b|→|›|»/i.test(name) && !/\bprev|\bback\b|←/i.test(name);
      });
    }
    let moved = false;
    if (reached) {
      const h0 = await stateHash(page);
      await page.keyboard.press('Enter');
      moved = (await waitChange(h0)) !== h0;
    }
    const invisible = [...new Set(focusSteps.filter((s) => !s.visible).map((s) => s.element))];
    keyboard = {
      ok: reached && moved,
      focusVisible: focusSteps.length ? invisible.length === 0 : null,
      detail: [
        reached
          ? moved
            ? 'Tab reached next control, Enter advanced'
            : 'Enter on next control did not change state'
          : 'Tab never reached a next control',
        invisible.length
          ? `no visible focus indicator on: ${invisible.slice(0, 5).join(', ')}`
          : `${focusSteps.length} focus stops, all visible`,
      ].join('; '),
    };
  }

  const linearStates = (opts.explore ? 1 : 0) + (await linearWalk(opts.explore ? 1 : 0, Number.POSITIVE_INFINITY));
  const navDetail = [`linear next traversal: ${linearStates} states`];

  let dialogDetail = 'not explored';
  let dialogsOk = true;
  if (opts.explore && budgetLeft()) {
    /* menu links: each click, then a bounded linear walk from there */
    const openMenu = async () => {
      const menu = (await discoverControls(page)).find((c) => c.kind === 'menu');
      if (menu) {
        await click(menu).catch(() => undefined);
        await page.waitForTimeout(100);
      }
    };
    let links = (await discoverControls(page)).filter((c) => c.kind === 'navlink');
    if (!links.length) {
      await openMenu();
      links = (await discoverControls(page)).filter((c) => c.kind === 'navlink');
    }
    const names = [...new Set(links.map((l) => norm(l.name)))].slice(0, 80);
    let clicked = 0;
    let menuStates = 0;
    for (const name of names) {
      if (!budgetLeft()) break;
      let link = (await discoverControls(page)).find((c) => c.kind === 'navlink' && norm(c.name) === name);
      if (!link) {
        await openMenu();
        link = (await discoverControls(page)).find((c) => c.kind === 'navlink' && norm(c.name) === name);
      }
      if (!link) continue;
      const before = await stateHash(page);
      try {
        await click(link);
        clicked++;
      } catch {
        continue;
      }
      await waitChange(before);
      menuStates += await linearWalk(1, maxDepth);
    }
    navDetail.push(`menu/nav links: ${clicked}/${names.length} clicked, ${menuStates} new states`);

    /* dialog openers */
    const results: string[] = [];
    const openers = [...new Set((await discoverControls(page)).filter((c) => c.kind === 'dialog').map((c) => norm(c.name)))].slice(0, 8);
    for (const name of openers) {
      const c = (await discoverControls(page)).find((x) => x.kind === 'dialog' && norm(x.name) === name);
      if (!c) continue;
      const before = session.pageErrors.length;
      await click(c).catch(() => undefined);
      const open = await page
        .waitForFunction(() => !!document.querySelector('dialog[open], [role=dialog]:not([hidden]), [aria-modal=true]'), null, {
          timeout: 1000,
        })
        .then(
          () => true,
          () => false,
        );
      if (!open) {
        results.push(`"${name}": no dialog`);
        continue;
      }
      await page.keyboard.press('Escape');
      const closed = await page
        .waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 1000 })
        .then(
          () => true,
          () => false,
        );
      if (!closed) dialogsOk = false;
      if (session.pageErrors.length > before) dialogsOk = false;
      results.push(`"${name}": opened, ${closed ? 'Escape closed' : 'Escape did NOT close'}`);
    }
    dialogDetail = results.length ? results.join('; ') : 'no dialog openers found';
  }

  const hasPageErrors = screens.some((s) => s.errors.some((e) => e.startsWith('page error')));
  if (knownScreenCount !== null && linearStates < knownScreenCount && !truncated && opts.explore) {
    failures.push(`reachability: linear traversal reached ${linearStates} of ${knownScreenCount} screens reported by the page`);
  }
  if (truncated) failures.push(`crawl truncated at ${screens.length} states (budget)`);
  if (hasPageErrors) failures.push('page errors during crawl');
  const navOk = screens.length > 1;
  return {
    screens,
    axe,
    shots,
    crawl: { states: screens.length, maxDepth: deepest, controls: [...controlNames].sort().slice(0, 150), truncated },
    navigation: {
      ok: navOk,
      detail: `${navDetail.join('; ')}${knownScreenCount !== null ? `; page hook reports ${knownScreenCount} screens` : ''}`,
    },
    resources: { glossary: null, references: null, ok: dialogsOk, detail: dialogDetail },
    keyboard,
    knownScreenCount,
    linearStates,
    failures,
  };
}
