/**
 * One lazily launched headless Chromium page shared by every in-browser renderer (Mermaid, SVG.js, D3)
 * and the visual QA. Script bundles are injected from node_modules once; all network is blocked.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';

export type BrowserLib = 'mermaid' | 'svgjs' | 'd3';

const require = createRequire(import.meta.url);

/** Resolve the browser (IIFE/UMD) bundle of each library; package `exports` hide dist paths for some. */
export function libPath(lib: BrowserLib): string {
  switch (lib) {
    case 'mermaid':
      return require.resolve('mermaid/dist/mermaid.min.js');
    case 'svgjs':
      return join(dirname(require.resolve('@svgdotjs/svg.js')), 'svg.min.js');
    case 'd3':
      return join(dirname(require.resolve('d3')), '..', 'dist', 'd3.min.js');
  }
}

const BLANK = '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"></body></html>';

export class GraphicsBrowser {
  private browser: Browser | null = null;
  private pagePromise: Promise<Page> | null = null;
  private readonly loaded = new Map<BrowserLib, Promise<void>>();

  /** The shared page (launches Chromium on first use). */
  page(): Promise<Page> {
    this.pagePromise ??= (async () => {
      this.browser = await chromium.launch({ headless: true });
      const page = await this.browser.newPage({ viewport: { width: 1024, height: 768 } });
      await page.route('**/*', (route) => route.abort());
      await page.setContent(BLANK);
      return page;
    })();
    return this.pagePromise;
  }

  async load(...libs: BrowserLib[]): Promise<Page> {
    const page = await this.page();
    for (const lib of libs) {
      let p = this.loaded.get(lib);
      if (!p) {
        p = page.addScriptTag({ path: libPath(lib) }).then(() => undefined);
        this.loaded.set(lib, p);
      }
      await p;
    }
    return page;
  }

  /**
   * Evaluate `fnSource` (a JS function expression, kept as a string so bundler helpers never leak into
   * the page) with one JSON-serialisable argument.
   */
  async call<T>(fnSource: string, arg: unknown, libs: BrowserLib[] = []): Promise<T> {
    const page = await this.load(...libs);
    return page.evaluate(`(${fnSource})(${JSON.stringify(arg ?? null)})`) as Promise<T>;
  }

  /** Batched text widths (px) for a CSS font shorthand, e.g. `600 15px system-ui`. */
  async measureText(texts: string[], font: string): Promise<number[]> {
    return this.call<number[]>(
      `({ texts, font }) => {
        const c = document.createElement('canvas').getContext('2d');
        c.font = font;
        return texts.map((t) => c.measureText(t).width);
      }`,
      { texts, font },
    );
  }

  async close(): Promise<void> {
    const b = this.browser;
    this.browser = null;
    this.pagePromise = null;
    this.loaded.clear();
    if (b) await b.close();
  }
}
