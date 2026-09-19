/**
 * SCORM 1.2 package: the single-file course as `index.html` plus an `imsmanifest.xml` (template in
 * `config/guidance/`), zipped at the archive root as LMSs expect. Only meaningful for a course built with
 * `tracking.destination: lms`, whose runtime reports status and score to the LMS.
 */
import { join } from 'node:path';
import { usageError } from '../core/errors.js';
import { exists, readJson, readText } from '../core/fsx.js';
import { COURSE_FILES, configDir } from '../core/paths.js';
import { type CourseManifest, CourseModelSchema } from '../core/schemas/index.js';
import { fillTemplate } from './setup.js';
import { zipEntries } from './zip.js';

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The tracking block embedded in a built course (null when untracked). */
function builtTracking(html: string): { destination: string } | null {
  const m = /<script type="application\/json" id="cf-data">([\s\S]*?)<\/script>/.exec(html);
  try {
    return (JSON.parse(m?.[1] ?? '{}') as { tracking?: { destination: string } }).tracking ?? null;
  } catch {
    return null;
  }
}

/** Title, version and pass mark for the manifest, from the compiled course model when there is one. */
export function scormInfo(
  dir: string,
  manifest: CourseManifest,
): { courseId: string; title: string; version: string; passingPercent: number | null } {
  const path = join(dir, COURSE_FILES.courseModel);
  const model = exists(path) ? readJson(path, CourseModelSchema) : null;
  return {
    courseId: manifest.course.id,
    title: model?.title ?? manifest.course.title,
    version: model?.version ?? '1.0.0',
    passingPercent: model?.assessment.gradedScreenIds.length ? model.assessment.passingPercent : null,
  };
}

export function scormManifest(o: { courseId: string; title: string; version: string; passingPercent: number | null }): string {
  return fillTemplate(readText(join(configDir(), 'guidance', 'imsmanifest.xml.tmpl')), {
    identifier: xml(`courseforge-${o.courseId}`),
    version: xml(o.version),
    title: xml(o.title),
    masteryScore: o.passingPercent === null ? '' : `\n        <adlcp:masteryscore>${o.passingPercent}</adlcp:masteryscore>`,
  });
}

/**
 * Builds the SCORM zip from a built or released course file. Refuses a course whose build does not report to an
 * LMS, because an LMS would then never see it completed.
 */
export function scormPackage(o: {
  htmlPath: string;
  courseId: string;
  title: string;
  version: string;
  /** Pass mark of the graded assessment, or null when the course has no graded questions. */
  passingPercent: number | null;
  now: Date;
}): Buffer {
  if (!exists(o.htmlPath))
    throw usageError(`No built course at ${o.htmlPath}. Build the course first: courseforge run --course ${o.courseId}`);
  const html = readText(o.htmlPath);
  if (builtTracking(html)?.destination !== 'lms')
    throw usageError(
      `This course was not built to report to a training system (LMS), so the LMS could not record completion. Run \`courseforge configure --course ${o.courseId}\`, choose the training system option, then rebuild.`,
    );
  return zipEntries([
    { name: 'imsmanifest.xml', data: Buffer.from(scormManifest(o), 'utf8'), mtime: o.now },
    { name: 'index.html', data: Buffer.from(html, 'utf8'), mtime: o.now },
  ]);
}
