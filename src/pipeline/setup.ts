/**
 * Setup answers <-> course.yaml, the step-by-step instruction files for the parts an author must do by hand,
 * and build invalidation when tracking settings change.
 */
import { join } from 'node:path';
import { STAGES, type Stage } from '../core/enums.js';
import { acquireLock, ensureDir, exists, readText, removePath, writeAtomic } from '../core/fsx.js';
import { COURSE_FILES, configDir } from '../core/paths.js';
import {
  type CourseManifest,
  effectiveTracking,
  type GuidanceConfig,
  type TrackingDestination,
  trackingUnfinished,
} from '../core/schemas/index.js';
import type { ConfigureResult, ReviewChoice, SetupAnswers } from './api.js';
import { invalidateStages, loadManifest, loadState, logEvent, requireCourse, saveManifest, saveState } from './store.js';

/** Instruction templates (under `config/guidance/`) copied into `<course>/tracking/` per destination. */
const GUIDES: Record<TrackingDestination, string[]> = {
  none: [],
  lms: ['lms-upload.md'],
  sheet: ['google-sheet-setup.md', 'google-apps-script.gs.txt'],
  tracker: ['own-dashboard.md'],
};
const ALL_GUIDES = [...new Set(Object.values(GUIDES).flat())];

/** Stages whose output depends on tracking settings. */
const TRACKING_STAGES: readonly Stage[] = ['COURSE_BUILD', 'COURSE_QA', 'RELEASE'];

export function reviewChoice(manifest: CourseManifest): ReviewChoice {
  const entries = Object.values(manifest.human_review);
  if (entries.length === 0) return manifest.pipeline.review_level;
  // Courses configured before review levels existed stored "every step" as a human gate on all stages.
  if (entries.length === STAGES.length && entries.every((m) => m === 'human')) return 'every_step';
  // Hand-written entries only take effect with `recommended`; other levels ignore them.
  return manifest.pipeline.review_level === 'recommended' ? 'custom' : manifest.pipeline.review_level;
}

export function setupFromManifest(manifest: CourseManifest): SetupAnswers {
  return {
    language: manifest.course.language,
    audience: manifest.course.audience,
    review: reviewChoice(manifest),
    tracking: { ...manifest.tracking },
  };
}

/** Returns a copy of the manifest with the answers applied and `setup.configured_at` stamped. */
export function applySetup(manifest: CourseManifest, answers: SetupAnswers, now: string): CourseManifest {
  const level = answers.review;
  return {
    ...manifest,
    course: { ...manifest.course, language: answers.language, audience: answers.audience },
    pipeline: { ...manifest.pipeline, review_level: level === 'custom' ? 'recommended' : level },
    human_review: level === 'custom' ? manifest.human_review : {},
    tracking: { ...answers.tracking },
    setup: { configured_at: now },
  };
}

/** `{{name}}` substitution for instruction templates. Unknown names are left as they are. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);
}

/** `{name}` substitution for guidance messages. */
export function fillMessage(message: string, vars: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * Writes the instruction files for the chosen destination into `<course>/tracking/` and removes ones left over
 * from a previous choice. Returns the absolute paths written.
 */
export function writeGuides(dir: string, manifest: CourseManifest): string[] {
  const out = join(dir, 'tracking');
  const wanted = GUIDES[manifest.tracking.destination];
  for (const name of ALL_GUIDES) if (!wanted.includes(name) && exists(join(out, name))) removePath(join(out, name));
  if (!wanted.length) return [];
  ensureDir(out);
  const vars = {
    courseId: manifest.course.id,
    title: manifest.course.title,
    scriptFile: join(out, 'google-apps-script.gs.txt'),
    releaseFile: join(dir, COURSE_FILES.releaseHtml),
    scormFile: join(dir, COURSE_FILES.releaseScorm),
  };
  return wanted.map((name) => {
    const path = join(out, name);
    writeAtomic(path, fillTemplate(readText(join(configDir(), 'guidance', name)), vars));
    return path;
  });
}

/** Saves answers for an existing course; if the tracking a build would use changed, the build is invalidated. */
export function configureCourse(courseId: string, answers: SetupAnswers, now: string): ConfigureResult {
  const dir = requireCourse(courseId);
  const release = acquireLock(dir, 'configure');
  try {
    const before = loadManifest(dir);
    const after = applySetup(before, answers, now);
    saveManifest(dir, after);
    const guides = writeGuides(dir, after);
    const trackingChanged = JSON.stringify(effectiveTracking(before)) !== JSON.stringify(effectiveTracking(after));
    let invalidated: Stage[] = [];
    if (trackingChanged) {
      const state = loadState(dir);
      invalidated = invalidateStages(dir, state, TRACKING_STAGES, 'configure', now, null);
      saveState(dir, state, now);
    }
    logEvent(dir, {
      ts: now,
      runId: null,
      stage: null,
      event: 'course.configured',
      // The endpoint is a write capability: record only whether one is set.
      detail: { destination: after.tracking.destination, endpointSet: !!after.tracking.endpoint, trackingChanged, invalidated },
    });
    return {
      courseId,
      manifestPath: join(dir, COURSE_FILES.manifest),
      guides,
      trackingChanged,
      invalidated,
      unfinished: trackingUnfinished(after),
    };
  } finally {
    release();
  }
}

/** Plain-language setup reminders for `status`. */
export function setupNotices(manifest: CourseManifest, guidance: GuidanceConfig): string[] {
  const id = manifest.course.id;
  const out: string[] = [];
  if (!manifest.setup.configured_at) out.push(fillMessage(guidance.messages.unconfigured, { id }));
  if (trackingUnfinished(manifest)) out.push(fillMessage(guidance.messages.unfinished, { id }));
  return out;
}
