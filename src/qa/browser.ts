/**
 * One headless Chromium per QA run. Every page gets: reduced motion, offline routing (only file:/data:/about:/blob:
 * allowed; everything else aborted and recorded), console/page-error capture, and auto-accepted dialogs. A tracked
 * course's declared result origins (ADR 0013) are answered by a local stub and recorded instead of blocked.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';
import { writeFileRaw } from '../core/fsx.js';
import { sha256 } from '../core/hash.js';
import type { ScreenshotManifest } from '../core/schemas/reports.js';

export const VIEWPORT_HEIGHT: Record<number, number> = { 1440: 900, 768: 1024, 390: 844 };
const ALLOWED_SCHEMES = new Set(['file:', 'data:', 'about:', 'blob:']);

export interface QaSession {
  readonly browser: Browser;
  /** Every request aborted by the offline router (URL). */
  readonly blocked: string[];
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  /** `type: message` of every window.alert/confirm/prompt (all accepted). */
  readonly dialogs: string[];
  /** Requests to the tracking stub origins (never leave the machine). */
  readonly tracked: { url: string; method: string; body: string }[];
  /** Opens a fresh context + page at the given viewport width. Closed with the session. */
  newPage(width: number): Promise<Page>;
}

export function fileUrl(path: string): string {
  return pathToFileURL(path).href;
}

function schemeOf(url: string): string {
  const m = /^([a-z][a-z0-9+.-]*:)/i.exec(url);
  return m?.[1]?.toLowerCase() ?? '';
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export type ScreenshotItem = ScreenshotManifest['items'][number];

export function screenshotName(screenId: string, viewport: number): string {
  const safe =
    screenId
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'screen';
  return `${safe}-${viewport}.png`;
}

/** Full-page PNG at `<outDir>/screenshots/<screenId>-<viewport>.png`; manifest path is outDir-relative. */
export async function captureScreenshot(page: Page, outDir: string, screenId: string, viewport: number): Promise<ScreenshotItem> {
  const rel = `screenshots/${screenshotName(screenId, viewport)}`;
  const buf = await page.screenshot({ fullPage: true, animations: 'disabled' });
  writeFileRaw(join(outDir, rel), buf);
  return { screenId, viewport, path: rel, sha256: sha256(buf), bytes: buf.byteLength };
}

export async function withBrowser<T>(fn: (session: QaSession) => Promise<T>, opts: { stubOrigins?: readonly string[] } = {}): Promise<T> {
  const stub = new Set(opts.stubOrigins ?? []);
  const browser = await chromium.launch({ headless: true });
  const contexts: BrowserContext[] = [];
  const session: QaSession = {
    browser,
    blocked: [],
    consoleErrors: [],
    pageErrors: [],
    dialogs: [],
    tracked: [],
    async newPage(width: number) {
      const context = await browser.newContext({
        viewport: { width, height: VIEWPORT_HEIGHT[width] ?? 900 },
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      contexts.push(context);
      // esbuild/tsx may wrap functions passed to page.evaluate with __name(); make that a no-op in the page.
      await context.addInitScript('globalThis.__name = globalThis.__name || ((f) => f);');
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (ALLOWED_SCHEMES.has(schemeOf(url))) return route.continue();
        if (stub.size && stub.has(originOf(url))) {
          const req = route.request();
          session.tracked.push({ url, method: req.method(), body: req.postData() ?? '' });
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        }
        session.blocked.push(url);
        return route.abort('blockedbyclient');
      });
      // Imported courses open external references in new tabs; QA never follows them. (Pages without an
      // opener, e.g. the blank page axe uses for finishRun, are left alone.)
      context.on('page', (p) => {
        void p
          .opener()
          .then((o) => (o ? p.close() : undefined))
          .catch(() => undefined);
      });
      const page = await context.newPage();
      page.on('console', (msg) => {
        if (msg.type() === 'error') session.consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => session.pageErrors.push(err.message));
      page.on('dialog', (d) => {
        session.dialogs.push(`${d.type()}: ${d.message()}`);
        void d.accept().catch(() => undefined);
      });
      return page;
    },
  };
  try {
    return await fn(session);
  } finally {
    for (const c of contexts) await c.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
