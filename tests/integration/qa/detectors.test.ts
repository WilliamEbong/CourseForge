import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileUrl, withBrowser } from '../../../src/qa/browser.js';
import { detectIssues, tabThrough } from '../../../src/qa/detectors.js';

const fixture = (name: string) => fileUrl(join(import.meta.dirname, '../../fixtures/qa', name));

describe('QA detectors @I7 @J4', () => {
  it('finds exactly the seeded defects, and nothing on the clean page', async () => {
    await withBrowser(async (s) => {
      const page = await s.newPage(1440);
      await page.goto(fixture('detectors-bad.html'));
      const bad = await detectIssues(page);
      expect(bad.overflow).toHaveLength(2);
      expect(bad.overflow[0]).toMatch(/^document/);
      expect(bad.overflow[1]).toBe('div#wide');
      expect(bad.clipped).toEqual(['p#clip']);
      expect(bad.unnamedControls).toEqual(['button#noname']);
      expect(bad.brokenImages).toEqual(['img#broken']);
      expect(bad.tinyTargets).toEqual(['button#tiny (12×12)']);
      expect(bad.smallTargets).toEqual([]);

      const focus = await tabThrough(page, 3);
      expect(focus.steps.map((x) => [x.element.split(' ')[0], x.visible])).toEqual([
        ['button#noname', true],
        ['button#tiny', true],
        ['button#nofocus', false],
      ]);

      await page.goto(fixture('detectors-good.html'));
      const good = await detectIssues(page);
      expect(good).toEqual({ overflow: [], clipped: [], brokenImages: [], unnamedControls: [], tinyTargets: [], smallTargets: [] });
      const f2 = await tabThrough(page, 3, 'button#focus-ok');
      expect(f2.reached).toBe(true);
      expect(f2.steps.every((x) => x.visible)).toBe(true);
      expect(s.blocked).toEqual([]);
    });
  });
});
