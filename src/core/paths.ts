/**
 * Repository and course-folder layout (spec 11). Everything course-specific lives under `courses/<id>/`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Stage } from './enums.js';
import { CfError } from './errors.js';

let cachedRoot: string | null = null;

/** Repo root = nearest ancestor containing a package.json named `courseforge`. Overridable via COURSEFORGE_ROOT. */
export function repoRoot(): string {
  if (process.env.COURSEFORGE_ROOT) return resolve(process.env.COURSEFORGE_ROOT);
  if (cachedRoot) return cachedRoot;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if ((JSON.parse(readFileSync(pkg, 'utf8')) as { name?: string }).name === 'courseforge') {
          cachedRoot = dir;
          return dir;
        }
      } catch {
        /* keep walking */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new CfError('NO_REPO_ROOT', 'Cannot locate the CourseForge repository root (package.json named "courseforge").');
}

/** Courses directory; overridable via COURSEFORGE_COURSES_DIR (tests use temp dirs). */
export function coursesDir(): string {
  const env = process.env.COURSEFORGE_COURSES_DIR;
  if (env) return isAbsolute(env) ? env : resolve(env);
  return join(repoRoot(), 'courses');
}

export function courseDir(courseId: string): string {
  return join(coursesDir(), courseId);
}

export const configDir = () => join(repoRoot(), 'config');
export const schemasDir = () => join(repoRoot(), 'schemas');
export const promptsDir = () => join(repoRoot(), 'prompts');
export const localStateDir = () => join(repoRoot(), '.courseforge');

/** Course-relative paths of well-known files. */
export const COURSE_FILES = {
  manifest: 'course.yaml',
  state: 'state.json',
  artifacts: 'artifacts.json',
  readme: 'README.md',
  originals: 'input/originals',
  intakeReport: 'input/intake-report.json',
  conceptMd: 'input/concept.md',
  conceptJson: 'input/concept.json',
  researchBriefMd: 'research/research-brief.md',
  researchBriefJson: 'research/research-brief.json',
  dossierMd: 'research/research-dossier.md',
  dossierJson: 'research/research-dossier.json',
  sources: 'research/sources.jsonl',
  claims: 'research/claims.jsonl',
  designMd: 'design/instructional-design.md',
  designJson: 'design/instructional-design.json',
  storyboardMd: 'storyboard/storyboard.md',
  storyboardJson: 'storyboard/storyboard.json',
  storyboardEditedMd: 'storyboard/storyboard-edited.md',
  storyboardEditedJson: 'storyboard/storyboard-edited.json',
  editorialDiff: 'storyboard/editorial-diff.json',
  designBrief: 'visual/design-brief.md',
  designTokens: 'visual/design-tokens.json',
  componentPlan: 'visual/component-plan.json',
  visualSpecs: 'visual/visual-specs.json',
  direction: 'visual/direction.json',
  courseModel: 'model/course.json',
  buildManifest: 'model/build-manifest.json',
  trace: 'model/trace.json',
  buildHtml: 'build/index.html',
  buildReport: 'build/build-report.json',
  qaDir: 'review',
  screenshots: 'review/screenshots',
  functional: 'review/functional-tests.json',
  accessibility: 'review/accessibility-review.json',
  consolidated: 'review/consolidated-review.md',
  repairPlan: 'review/repair-plan.json',
  regression: 'review/regression-report.json',
  versions: 'versions',
  logs: 'logs',
  environment: 'logs/environment.json',
  executionPlans: 'logs/execution-plans',
  routingDecisions: 'logs/routing-decisions.jsonl',
  runEvents: 'logs/run-events.jsonl',
  tasks: 'logs/tasks',
  releaseHtml: 'release/course.html',
  qaReport: 'release/qa-report.md',
  sourceReport: 'release/source-report.md',
  releaseManifest: 'release/release-manifest.json',
} as const;

/** Directory holding a stage's review findings (`<dir>/review/c<cycle>/<reviewer>.json`). */
export const STAGE_DIRS: Record<Stage, string> = {
  CONCEPT: 'input',
  RESEARCH_BRIEF: 'research',
  RESEARCH_DOSSIER: 'research',
  INSTRUCTIONAL_DESIGN: 'design',
  STORYBOARD: 'storyboard',
  EDITORIAL: 'storyboard',
  VISUAL_DIRECTION: 'visual',
  COURSE_MODEL: 'model',
  COURSE_BUILD: 'build',
  COURSE_QA: 'review',
  RELEASE: 'release',
};

export function findingsDir(stage: Stage, cycle: number): string {
  const base = STAGE_DIRS[stage];
  return stage === 'COURSE_QA' ? `review/findings/c${cycle}` : `${base}/review/${stage.toLowerCase()}/c${cycle}`;
}

/** Expands `{course}` in a registry path template to a course-relative (`.`) or absolute prefix. */
export function expandTemplate(template: string, courseRoot: string): string {
  return template.replaceAll('{course}', courseRoot);
}

/** True when `rel` (course-relative, forward slashes) matches a glob-ish pattern with `**` / `*` suffixes. */
export function matchesPattern(rel: string, pattern: string): boolean {
  const p = pattern.replace(/^\.\//, '');
  if (p.endsWith('/**')) return rel === p.slice(0, -3) || rel.startsWith(p.slice(0, -2));
  if (p.includes('*')) {
    const re = new RegExp(
      `^${p
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '§')
        .replace(/\*/g, '[^/]*')
        .replace(/§/g, '.*')}$`,
    );
    return re.test(rel);
  }
  return rel === p;
}
