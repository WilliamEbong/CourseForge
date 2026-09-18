/**
 * Setup smoke fixture (spec 06): build a small course → render structured diagrams → launch Chromium →
 * exercise interactions → run axe → capture screenshots → verify artifacts. READY is printed only if this passes.
 */
import { join } from 'node:path';
import { ensureDir, exists, readJson, removePath, writeAtomic } from '../core/fsx.js';
import { localStateDir, repoRoot } from '../core/paths.js';
import { CourseModelSchema } from '../core/schemas/index.js';
import { GraphicsBrowser, renderAll } from '../graphics/index.js';
import { runQa } from '../qa/index.js';
import { checkSingleFile, renderCourse } from '../renderer/index.js';

export const SMOKE_FIXTURE = 'tests/fixtures/courses/smoke/course.json';

export async function runSmoke(outDir?: string): Promise<{ ok: boolean; steps: { name: string; ok: boolean; detail: string }[] }> {
  const steps: { name: string; ok: boolean; detail: string }[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    steps.push({ name, ok, detail });
    return ok;
  };
  const dir = outDir ?? join(localStateDir(), 'smoke');
  try {
    removePath(dir);
    ensureDir(dir);
    const fixture = join(repoRoot(), SMOKE_FIXTURE);
    if (!record('fixture', exists(fixture), SMOKE_FIXTURE)) return { ok: false, steps };
    const model = readJson(fixture, CourseModelSchema);

    const browser = new GraphicsBrowser();
    let visuals: Awaited<ReturnType<typeof renderAll>>;
    try {
      visuals = await renderAll(model.visuals, new Map(model.visualRoutes.map((r) => [r.visualId, r])), {
        browser,
        theme: { figureStyle: model.theme.figureStyle, corner: model.theme.corner },
        maxSemanticRepairs: 0,
      });
    } finally {
      await browser.close();
    }
    const svgCount = [...visuals.values()].filter((v) => v.svg).length;
    record(
      'diagrams',
      svgCount > 0,
      `${svgCount}/${visuals.size} visuals rendered to inline SVG (${[...visuals.values()].map((v) => v.renderer).join(', ')})`,
    );

    const map = new Map(
      [...visuals].map(([id, v]) => [id, { svg: v.svg ?? '', renderer: v.renderer, fallbackUsed: v.fallbackUsed, html: v.html }]),
    );
    const { html } = await renderCourse(model, { visuals: map, mode: 'release' });
    const htmlPath = join(dir, 'index.html');
    writeAtomic(htmlPath, html);
    const single = checkSingleFile(html);
    record('build', single.pass, `single-file course ${(html.length / 1024).toFixed(0)} KB — ${single.detail}`);

    const qa = await runQa({ htmlPath, model, outDir: dir, profile: 'smoke', courseId: model.courseId });
    const interactions = qa.functional.interactions;
    record(
      'browser',
      qa.functional.summary.pass,
      `${qa.functional.screens.length} screen checks, ${interactions.filter((i) => i.correctPath === 'pass').length}/${interactions.length} interactions correct-path ok${qa.functional.summary.failures.length ? `; failures: ${qa.functional.summary.failures.slice(0, 3).join('; ')}` : ''}`,
    );
    const blocking = qa.accessibility.totals.critical + qa.accessibility.totals.serious;
    record('axe', blocking === 0, `serious/critical violations: ${blocking} (moderate ${qa.accessibility.totals.moderate})`);
    record(
      'screenshot',
      qa.screenshots.items.length > 0 && qa.screenshots.items.every((i) => exists(join(dir, i.path)) || exists(i.path)),
      `${qa.screenshots.items.length} screenshot(s)`,
    );
  } catch (err) {
    record('error', false, (err as Error).message);
  }
  return { ok: steps.every((s) => s.ok), steps };
}
