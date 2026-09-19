/** Setup answers: applied at creation, re-applied by configure, build invalidated only when tracking changes. */
import { beforeEach, describe, expect, it } from 'vitest';
import { courseDir } from '../../../src/core/paths.js';
import type { SetupAnswers } from '../../../src/pipeline/api.js';
import { pipelineApi as api } from '../../../src/pipeline/impl.js';
import { loadManifest, loadState, saveState } from '../../../src/pipeline/store.js';
import { useFakeEnv } from './helpers.js';

const answers = (over: Partial<SetupAnswers> = {}): SetupAnswers => ({
  language: 'en',
  audience: 'warehouse staff',
  review: 'recommended',
  tracking: { destination: 'none', endpoint: null, identity: 'name', id_label: null },
  ...over,
});

function lockDelivery(id: string): void {
  const dir = courseDir(id);
  const state = loadState(dir);
  for (const s of ['COURSE_MODEL', 'COURSE_BUILD', 'COURSE_QA', 'RELEASE'] as const) state.stages[s].status = 'LOCKED';
  saveState(dir, state, new Date().toISOString());
}

describe('course setup and configure', () => {
  beforeEach(() => {
    useFakeEnv();
  });

  it('a course created without answers is unconfigured and status says so', async () => {
    const { courseId } = await api.newCourse({ title: 'Plain course' });
    const m = loadManifest(courseDir(courseId));
    expect(m.setup.configured_at).toBeNull();
    expect(m.tracking.destination).toBe('none');
    const s = await api.status({ courseId });
    expect(s.notices.join('\n')).toContain(`courseforge configure --course ${courseId}`);
  });

  it('answers given at creation are written to course.yaml', async () => {
    const { courseId } = await api.newCourse({ title: 'Configured course', setup: answers({ language: 'fr', review: 'every_step' }) });
    const m = loadManifest(courseDir(courseId));
    expect(m.course.language).toBe('fr');
    expect(m.course.audience).toBe('warehouse staff');
    expect(m.pipeline.review_level).toBe('every_step');
    expect(m.human_review).toEqual({});
    expect(m.setup.configured_at).not.toBeNull();
    expect((await api.setupInfo({ courseId })).answers.review).toBe('every_step');
    expect((await api.status({ courseId })).notices).toEqual([]);
  });

  it('setupInfo for a course that does not exist returns the defaults', async () => {
    const info = await api.setupInfo({ courseId: 'not-yet', title: 'Not yet' });
    expect(info.exists).toBe(false);
    expect(info.answers).toEqual({
      language: 'en',
      audience: null,
      review: 'recommended',
      tracking: { destination: 'none', endpoint: null, identity: 'name', id_label: null },
    });
    expect(info.guidance.stages.COURSE_BUILD.name).toBeTruthy();
  });

  it('configure without a tracking change leaves a locked build alone', async () => {
    const { courseId } = await api.newCourse({ title: 'Stable course' });
    lockDelivery(courseId);
    const res = await api.configure({ courseId, answers: answers({ language: 'de' }) });
    expect(res.trackingChanged).toBe(false);
    expect(res.invalidated).toEqual([]);
    expect(loadState(courseDir(courseId)).stages.COURSE_BUILD.status).toBe('LOCKED');
    expect(loadManifest(courseDir(courseId)).course.language).toBe('de');
  });

  it('configure with a tracking change invalidates build, QA and release only', async () => {
    const { courseId } = await api.newCourse({ title: 'Tracked course' });
    lockDelivery(courseId);
    const res = await api.configure({
      courseId,
      answers: answers({ tracking: { destination: 'lms', endpoint: null, identity: 'name', id_label: null } }),
    });
    expect(res.trackingChanged).toBe(true);
    expect(res.invalidated).toEqual(['COURSE_BUILD', 'COURSE_QA', 'RELEASE']);
    const st = loadState(courseDir(courseId)).stages;
    expect(st.COURSE_MODEL.status).toBe('LOCKED');
    expect(st.COURSE_BUILD.status).toBe('SUPERSEDED');
    expect(st.COURSE_BUILD.stale?.because).toBe('configure');
  });

  it('an unfinished web destination does not change the build and is reported', async () => {
    const { courseId } = await api.newCourse({ title: 'Later course' });
    lockDelivery(courseId);
    const res = await api.configure({
      courseId,
      answers: answers({ tracking: { destination: 'sheet', endpoint: null, identity: 'name', id_label: null } }),
    });
    expect(res.unfinished).toBe(true);
    expect(res.trackingChanged).toBe(false);
    expect((await api.status({ courseId })).notices.join('\n')).toContain('not finished yet');
  });

  it('review levels round-trip; hand-written gates show as custom and survive "keep custom"', async () => {
    const { courseId } = await api.newCourse({ title: 'Levels course', setup: answers({ review: 'strict' }) });
    const dir = courseDir(courseId);
    expect((await api.setupInfo({ courseId })).answers.review).toBe('strict');
    const { effectiveRiskTier } = await import('../../../src/core/schemas/index.js');
    expect(effectiveRiskTier(loadManifest(dir))).toBe('high_stakes');
    await api.configure({ courseId, answers: answers({ review: 'one_shot' }) });
    expect(loadManifest(dir).pipeline.review_level).toBe('one_shot');
    expect(effectiveRiskTier(loadManifest(dir))).toBe('standard');
    const { saveManifest } = await import('../../../src/pipeline/store.js');
    saveManifest(dir, { ...loadManifest(dir), human_review: { STORYBOARD: 'human' } });
    expect((await api.setupInfo({ courseId })).answers.review).toBe('custom');
    await api.configure({ courseId, answers: answers({ review: 'custom' }) });
    expect(loadManifest(dir).human_review).toEqual({ STORYBOARD: 'human' });
  });

  it('configure refuses a course that does not exist', async () => {
    await expect(api.configure({ courseId: 'missing', answers: answers() })).rejects.toThrow(/not found/);
  });
});
