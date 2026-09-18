/**
 * QA entry point: one browser, contract mode for CourseForge builds (window.__cf + model), crawl mode otherwise.
 * Writes only screenshots (under `<outDir>/screenshots/`); the pipeline persists the returned reports.
 */
import { dirname } from 'node:path';
import type { Page } from 'playwright';
import { relPath } from '../core/fsx.js';
import { hashFile } from '../core/hash.js';
import {
  type AccessibilityReport,
  AccessibilityReportSchema,
  type FunctionalReport,
  FunctionalReportSchema,
  type ScreenshotManifest,
} from '../core/schemas/reports.js';
import { type AxeScreen, buildAccessibilityReport } from './axe.js';
import { fileUrl, type QaSession, type ScreenshotItem, withBrowser } from './browser.js';
import { type ContractResult, type QaModel, runContractQa, type ScreenResult, waitForCf } from './contract.js';
import { type CrawlResult, runCrawlQa } from './crawler.js';

export type QaProfile = 'smoke' | 'dev' | 'release';

export interface RunQaOptions {
  htmlPath: string;
  /** Course model (a full CourseModel satisfies QaModel); null forces crawl mode. */
  model: QaModel | null;
  /** Absolute path of the course review dir; screenshots go to `<outDir>/screenshots/`. */
  outDir: string;
  profile: QaProfile;
  courseId: string;
  /** Override the crawl time budget (ms) for the primary viewport. */
  maxMs?: number;
}

export interface QaRunResult {
  functional: FunctionalReport;
  accessibility: AccessibilityReport;
  screenshots: ScreenshotManifest;
}

/** First screen of each module + first of each component type + first of each interaction mode (model order). */
export function representativeScreens(model: QaModel): string[] {
  const picked = new Set<string>();
  const seen = new Set<string>();
  for (const s of model.screens) {
    for (const key of [`m:${s.moduleId}`, `c:${s.component}`, s.interaction ? `i:${s.interaction.mode}` : null]) {
      if (key && !seen.has(key)) {
        seen.add(key);
        picked.add(s.id);
      }
    }
  }
  return model.screens.map((s) => s.id).filter((id) => picked.has(id));
}

async function openAt(session: QaSession, url: string, width: number): Promise<Page> {
  const page = await session.newPage(width);
  await page.goto(url, { waitUntil: 'load' });
  return page;
}

interface Collected {
  mode: 'contract' | 'crawl';
  viewports: number[];
  screens: ScreenResult[];
  axe: AxeScreen[];
  shots: ScreenshotItem[];
  primary: ContractResult['behaviour'] | CrawlResult;
  failures: string[];
}

async function contractRun(session: QaSession, page: Page, url: string, model: QaModel, o: RunQaOptions): Promise<Collected> {
  const all = model.screens.map((s) => s.id);
  const rep = representativeScreens(model);
  const p = o.profile;
  const main = await runContractQa(page, model, {
    session,
    viewport: 1440,
    outDir: o.outDir,
    full: true,
    axe: new Set(p === 'smoke' ? rep.slice(0, 3) : p === 'dev' ? rep : all),
    shots: new Set(p === 'smoke' ? rep.slice(0, 2) : p === 'dev' ? rep.slice(0, 8) : all),
  });
  const out: Collected = {
    mode: 'contract',
    viewports: [1440],
    screens: main.screens,
    axe: main.axe,
    shots: main.shots,
    primary: main.behaviour,
    failures: main.failures,
  };
  const extra: { width: number; screens: string[]; axe: string[]; shots: string[] }[] =
    p === 'dev'
      ? [{ width: 390, screens: rep.slice(0, 8), axe: [], shots: rep.slice(0, 8) }]
      : p === 'release'
        ? [
            { width: 768, screens: rep, axe: [], shots: rep },
            { width: 390, screens: all, axe: rep, shots: rep },
          ]
        : [];
  for (const e of extra) {
    const pg = await openAt(session, url, e.width);
    if (!(await waitForCf(pg))) {
      out.failures.push(`runtime missing at ${e.width}px`);
      continue;
    }
    const r = await runContractQa(pg, model, {
      session,
      viewport: e.width,
      outDir: o.outDir,
      full: false,
      screens: e.screens,
      axe: new Set(e.axe),
      shots: new Set(e.shots),
    });
    out.viewports.push(e.width);
    out.screens.push(...r.screens);
    out.axe.push(...r.axe);
    out.shots.push(...r.shots);
    await pg.context().close();
  }
  return out;
}

async function crawlRun(session: QaSession, page: Page, url: string, o: RunQaOptions): Promise<Collected> {
  const p = o.profile;
  const primaryMs = o.maxMs ?? (p === 'smoke' ? 30_000 : p === 'dev' ? 180_000 : 600_000);
  const main = await runCrawlQa(page, {
    session,
    viewport: 1440,
    outDir: o.outDir,
    explore: true,
    maxMs: primaryMs,
    axeSample: p === 'smoke' ? 3 : p === 'dev' ? 8 : 'all',
    shotSample: p === 'smoke' ? 2 : p === 'dev' ? 8 : 'all',
  });
  const out: Collected = {
    mode: 'crawl',
    viewports: [1440],
    screens: main.screens,
    axe: main.axe,
    shots: main.shots,
    primary: main,
    failures: main.failures,
  };
  const extra: { width: number; axe: number; shots: number }[] =
    p === 'dev'
      ? [{ width: 390, axe: 3, shots: 8 }]
      : p === 'release'
        ? [
            { width: 768, axe: 0, shots: 8 },
            { width: 390, axe: 12, shots: 12 },
          ]
        : [];
  for (const e of extra) {
    const pg = await openAt(session, url, e.width);
    const r = await runCrawlQa(pg, {
      session,
      viewport: e.width,
      outDir: o.outDir,
      explore: false,
      maxStates: main.screens.length + 5,
      maxMs: Math.max(60_000, primaryMs / 2),
      axeSample: e.axe,
      shotSample: e.shots,
      expectedStates: main.screens.length,
    });
    out.viewports.push(e.width);
    out.screens.push(...r.screens);
    out.axe.push(...r.axe);
    out.shots.push(...r.shots);
    out.failures.push(...r.failures.map((f) => `${e.width}px: ${f}`));
    if (r.screens.length < main.linearStates) {
      out.failures.push(`${e.width}px: linear replay reached ${r.screens.length} of ${main.linearStates} states`);
    }
    await pg.context().close();
  }
  return out;
}

const uniq = (xs: string[]) => [...new Set(xs)];

export async function runQa(o: RunQaOptions): Promise<QaRunResult> {
  const started = Date.now();
  const url = fileUrl(o.htmlPath);
  const target = relPath(dirname(o.outDir), o.htmlPath);
  const targetHash = hashFile(o.htmlPath);
  return withBrowser(async (session) => {
    const page = await openAt(session, url, 1440);
    const isContract = o.model !== null && (await waitForCf(page, 2500));
    const c = isContract && o.model ? await contractRun(session, page, url, o.model, o) : await crawlRun(session, page, url, o);

    const noBehaviour = {
      interactions: [] as FunctionalReport['interactions'],
      scoring: { checked: false, expectedPercent: null, actualPercent: null, ok: true },
      navigation: { ok: false, detail: 'not checked' },
      resources: { glossary: null, references: null, ok: true, detail: 'not checked' },
      progress: { persisted: null, resetOk: null },
      keyboard: { ok: null, focusVisible: null, detail: 'not checked' },
    };
    const crawl = c.mode === 'crawl' ? (c.primary as CrawlResult) : null;
    const b =
      c.mode === 'contract'
        ? ((c.primary as ContractResult['behaviour']) ?? noBehaviour)
        : {
            ...noBehaviour,
            navigation: crawl?.navigation ?? noBehaviour.navigation,
            resources: crawl?.resources ?? noBehaviour.resources,
            keyboard: crawl?.keyboard ?? noBehaviour.keyboard,
          };

    const consoleErrors = uniq([...session.consoleErrors, ...session.pageErrors.map((e) => `pageerror: ${e}`)]).slice(0, 100);
    const blocked = uniq(session.blocked);
    const failures = [
      ...c.screens
        .filter((s) => !s.ok)
        .map(
          (s) =>
            `screen ${s.id}@${s.viewport}: ${[...s.missingIds.map((m) => `missing ${m}`), ...s.overflow, ...s.errors.filter((e) => !e.startsWith('advisory:'))].slice(0, 3).join('; ')}`,
        ),
      ...b.interactions
        .filter((i) => i.correctPath === 'fail' || i.incorrectPath === 'fail')
        .map((i) => `interaction ${i.id} (${i.mode}): ${i.detail}`),
      ...c.failures,
      ...(b.navigation.ok ? [] : [`navigation: ${b.navigation.detail}`]),
      ...(b.resources.ok ? [] : [`resources: ${b.resources.detail}`]),
      ...(b.keyboard.ok === false ? [`keyboard: ${b.keyboard.detail}`] : []),
      ...(b.keyboard.focusVisible === false ? ['focus: no visible focus indicator on some controls'] : []),
      ...(blocked.length ? [`offline: ${blocked.length} blocked network request(s)`] : []),
      ...(consoleErrors.length ? [`console: ${consoleErrors.length} console/page error(s)`] : []),
    ];

    const functional = FunctionalReportSchema.parse({
      schemaVersion: 1,
      courseId: o.courseId,
      mode: c.mode,
      target,
      targetHash,
      profile: o.profile,
      viewports: c.viewports,
      durationMs: Date.now() - started,
      screens: c.screens,
      interactions: b.interactions,
      scoring: b.scoring,
      navigation: b.navigation,
      resources: b.resources,
      progress: b.progress,
      keyboard: b.keyboard,
      offline: { blockedRequests: blocked },
      consoleErrors,
      crawl: crawl?.crawl ?? null,
      summary: { pass: failures.length === 0, failures: uniq(failures) },
    });
    const accessibility = AccessibilityReportSchema.parse(buildAccessibilityReport(o.courseId, target, c.axe));
    return { functional, accessibility, screenshots: { schemaVersion: 1, items: c.shots } };
  });
}
