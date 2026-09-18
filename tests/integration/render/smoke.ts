/** Shared loader for the smoke course fixture and its placeholder visuals. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../../src/core/paths.js';
import { type CourseModel, CourseModelSchema } from '../../../src/core/schemas/model.js';
import type { VisualInput } from '../../../src/renderer/index.js';

export const SMOKE_DIR = join(repoRoot(), 'tests', 'fixtures', 'courses', 'smoke');

export function loadSmoke(): { model: CourseModel; visuals: Map<string, VisualInput> } {
  const model = CourseModelSchema.parse(JSON.parse(readFileSync(join(SMOKE_DIR, 'course.json'), 'utf8')));
  const visuals = new Map<string, VisualInput>();
  for (const route of model.visualRoutes) {
    visuals.set(route.visualId, {
      svg: readFileSync(join(SMOKE_DIR, 'visuals', `${route.visualId}.svg`), 'utf8'),
      renderer: route.renderer,
    });
  }
  return { model, visuals };
}
