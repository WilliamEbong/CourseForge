/**
 * In-page layout / markup detectors. Functions passed to page.evaluate must be self-contained.
 */
import type { Page } from 'playwright';

export interface DetectorResult {
  /** `document` when the page scrolls horizontally, else selectors of elements sticking out of the viewport. */
  overflow: string[];
  /** Elements whose text is cut off by overflow:hidden/clip. */
  clipped: string[];
  brokenImages: string[];
  unnamedControls: string[];
  /** Interactive targets smaller than 24×24 CSS px (WCAG 2.2 SC 2.5.8). */
  tinyTargets: string[];
  /** Targets between 24 and 44 px (advisory). */
  smallTargets: string[];
}

const LIMIT = 15;

export async function detectIssues(page: Page, rootSelector?: string): Promise<DetectorResult> {
  return page.evaluate(
    ({ rootSelector, limit }) => {
      const describe = (el: Element): string => {
        let s = el.tagName.toLowerCase();
        if (el.id) return `${s}#${el.id}`;
        for (const a of ['data-cf-block', 'data-cf-item', 'data-cf-visual', 'data-cf-nav', 'name', 'aria-label']) {
          const v = el.getAttribute(a);
          if (v) return `${s}[${a}="${v.slice(0, 40)}"]`;
        }
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        if (cls) s += `.${cls}`;
        const parent = el.parentElement;
        if (parent?.id) s = `#${parent.id} > ${s}`;
        return s;
      };
      const visible = (el: Element): boolean =>
        el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && el.getClientRects().length > 0;
      const push = (arr: string[], v: string) => {
        if (arr.length < limit && !arr.includes(v)) arr.push(v);
      };
      const nameOf = (el: Element): string => {
        const label = el.getAttribute('aria-label');
        if (label?.trim()) return label.trim();
        const by = el.getAttribute('aria-labelledby');
        if (by) {
          const t = by
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
            .trim();
          if (t) return t;
        }
        const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim();
        if (text) return text;
        const alt = el.querySelector('img[alt]')?.getAttribute('alt')?.trim();
        if (alt) return alt;
        const svgTitle = el.querySelector('svg title')?.textContent?.trim();
        if (svgTitle) return svgTitle;
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
          if (el.labels && [...el.labels].some((l) => l.textContent?.trim())) return 'label';
          if (el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type) && el.value) return el.value;
          if (el.getAttribute('placeholder')) return el.getAttribute('placeholder') ?? '';
        }
        return el.getAttribute('title')?.trim() ?? '';
      };

      const out = {
        overflow: [] as string[],
        clipped: [] as string[],
        brokenImages: [] as string[],
        unnamedControls: [] as string[],
        tinyTargets: [] as string[],
        smallTargets: [] as string[],
      };
      const doc = document.documentElement;
      const vw = doc.clientWidth;
      if (doc.scrollWidth > vw + 1) out.overflow.push(`document (scrollWidth ${doc.scrollWidth} > ${vw})`);

      const root = (rootSelector ? document.querySelector(rootSelector) : null) ?? document.body;
      const all = [root, ...root.querySelectorAll('*')].filter((el) => !el.closest('svg') || el.tagName.toLowerCase() === 'svg');
      const inScroller = (el: Element): boolean => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox !== 'visible') return true;
        }
        return false;
      };
      for (const el of all) {
        if (!visible(el)) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // Sticking out on the right (left overflow is not scrollable and is how off-canvas menus hide).
        if (r.width > 0 && r.right > vw + 1 && cs.position !== 'fixed' && !inScroller(el)) push(out.overflow, describe(el));
        // Clipped text: overflow hidden/clip with wider content, ignoring visually-hidden (sr-only) helpers.
        if (
          (cs.overflowX === 'hidden' || cs.overflowX === 'clip') &&
          el.scrollWidth > el.clientWidth + 1 &&
          el.clientWidth > 2 &&
          el.clientHeight > 2 &&
          cs.clip === 'auto' &&
          [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
        )
          push(out.clipped, describe(el));
      }
      for (const img of root.querySelectorAll('img')) {
        if (img.getAttribute('src') && img.complete && img.naturalWidth === 0) push(out.brokenImages, describe(img));
      }
      for (const svg of root.querySelectorAll('svg')) {
        if (svg.parentElement?.closest('svg') || !visible(svg)) continue;
        const r = svg.getBoundingClientRect();
        const sized = svg.hasAttribute('viewBox') || (svg.hasAttribute('width') && svg.hasAttribute('height'));
        if (!sized || r.width < 1 || r.height < 1 || svg.childElementCount === 0) push(out.brokenImages, describe(svg));
      }
      const controls = root.querySelectorAll(
        'button, a[href], [role=button], [role=link], [role=tab], [role=menuitem], input:not([type=hidden]), select, textarea, summary',
      );
      for (const el of controls) {
        if (!visible(el)) continue;
        if (!nameOf(el)) push(out.unnamedControls, describe(el));
        const cs = getComputedStyle(el);
        // Inline links inside text are exempt from target-size rules.
        if (el.tagName === 'A' && cs.display === 'inline') continue;
        const r = el.getBoundingClientRect();
        const min = Math.min(r.width, r.height);
        if (min < 24) push(out.tinyTargets, `${describe(el)} (${Math.round(r.width)}×${Math.round(r.height)})`);
        else if (min < 44) push(out.smallTargets, `${describe(el)} (${Math.round(r.width)}×${Math.round(r.height)})`);
      }
      return out;
    },
    { rootSelector: rootSelector ?? null, limit: LIMIT },
  );
}

export interface FocusStep {
  element: string;
  visible: boolean;
}

/** Style of the currently focused element: does it show an outline / box-shadow focus indicator? */
export async function focusedElementStyle(page: Page): Promise<FocusStep | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== 'none' && Number.parseFloat(cs.outlineWidth) > 0;
    const shadow = cs.boxShadow !== 'none' && cs.boxShadow !== '';
    const id = el.id ? `#${el.id}` : '';
    const label = (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? '').trim().slice(0, 30);
    return { element: `${el.tagName.toLowerCase()}${id}${label ? ` "${label}"` : ''}`, visible: outline || shadow };
  });
}

/**
 * Presses Tab up to `maxTabs` times (from the current focus), sampling the focus indicator at each stop.
 * Stops early when `stopWhen` matches the focused element.
 */
export async function tabThrough(page: Page, maxTabs: number, stopWhen?: string): Promise<{ steps: FocusStep[]; reached: boolean }> {
  const steps: FocusStep[] = [];
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const s = await focusedElementStyle(page);
    if (s) steps.push(s);
    if (stopWhen && (await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, stopWhen))) {
      return { steps, reached: true };
    }
  }
  return { steps, reached: !stopWhen };
}
