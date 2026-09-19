/**
 * The whole offline pipeline with tracking chosen at creation: a Google Sheet course passes build checks, QA's
 * tracking check and the release gate; an LMS course also gets its SCORM package; reconfiguring back to
 * untracked invalidates the delivery stages and the rebuild is offline again.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { courseDir } from '../../../src/core/paths.js';
import type { SetupAnswers } from '../../../src/pipeline/api.js';
import { pipelineApi as api } from '../../../src/pipeline/impl.js';
import { loadState } from '../../../src/pipeline/store.js';
import { useFakeEnv } from './helpers.js';

const TITLE = 'Chemical safety data sheets';
const setup = (tracking: SetupAnswers['tracking']): SetupAnswers => ({ language: 'en', audience: null, review: 'recommended', tracking });

describe('tracked courses through release @G2 @I8', () => {
  beforeEach(() => {
    useFakeEnv();
  });

  it('a Google Sheet course releases with the connection; reconfiguring to untracked rebuilds it offline', async () => {
    const endpoint = 'https://script.google.com/macros/s/AKfy-test/exec';
    const { courseId, outcome, guides } = await api.newCourse({
      title: TITLE,
      runTo: 'RELEASE',
      gate: 'auto',
      setup: setup({ destination: 'sheet', endpoint, identity: 'name_and_id', id_label: null }),
    });
    expect(outcome?.status).toBe('completed');
    expect(guides.map((g) => g.replace(/\\/g, '/').split('/').pop())).toEqual(['google-sheet-setup.md', 'google-apps-script.gs.txt']);
    const dir = courseDir(courseId);
    const released = readFileSync(join(dir, 'release/course.html'), 'utf8');
    expect(released).toContain('connect-src https://script.google.com https://script.googleusercontent.com');
    const functional = JSON.parse(readFileSync(join(dir, 'review/functional-tests.json'), 'utf8'));
    expect(functional.summary.failures).toEqual([]);
    expect(existsSync(join(dir, 'release/course-scorm.zip'))).toBe(false);

    const res = await api.configure({
      courseId,
      answers: setup({ destination: 'none', endpoint: null, identity: 'name', id_label: null }),
    });
    expect(res.invalidated).toEqual(['COURSE_BUILD', 'COURSE_QA', 'RELEASE']);
    expect(existsSync(join(dir, 'tracking/google-sheet-setup.md'))).toBe(false);
    const rerun = await api.run({ courseId, gate: 'auto' });
    expect(rerun.status).toBe('completed');
    expect(loadState(dir).stages.RELEASE.status).toBe('LOCKED');
    expect(readFileSync(join(dir, 'release/course.html'), 'utf8')).not.toContain('script.google.com');
  }, 600_000);

  it('an LMS course releases with its SCORM package', async () => {
    const { courseId, outcome } = await api.newCourse({
      title: TITLE,
      runTo: 'RELEASE',
      gate: 'auto',
      setup: setup({ destination: 'lms', endpoint: null, identity: 'name', id_label: null }),
    });
    expect(outcome?.status).toBe('completed');
    const dir = courseDir(courseId);
    expect(existsSync(join(dir, 'release/course-scorm.zip'))).toBe(true);
    expect(existsSync(join(dir, 'tracking/lms-upload.md'))).toBe(true);
    const pkg = await api.packageCourse({ courseId, scorm: true });
    expect(pkg.bytes).toBeGreaterThan(1000);
  }, 600_000);
});
