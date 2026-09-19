/**
 * One-shot review (ADR 0014) through the offline pipeline: `make` takes a prompt and a folder of documents, runs
 * unattended to one sign-off before release, and releases after approval. A stage whose findings cannot be fixed
 * does not pause the run: it is carried to the release sign-off.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { STAGES } from '../../../src/core/enums.js';
import { courseDir } from '../../../src/core/paths.js';
import type { SetupAnswers } from '../../../src/pipeline/api.js';
import { pipelineApi as api } from '../../../src/pipeline/impl.js';
import { classifyInputs, titleFrom } from '../../../src/pipeline/make.js';
import { loadState } from '../../../src/pipeline/store.js';
import { fixturesWith, useFakeEnv } from './helpers.js';

const oneShot: SetupAnswers = {
  language: 'en',
  audience: null,
  review: 'one_shot',
  tracking: { destination: 'none', endpoint: null, identity: 'name', id_label: null },
};

function docsFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cf-docs-'));
  mkdirSync(join(dir, 'policies'));
  writeFileSync(join(dir, 'policies', 'chemical-storage.md'), '# Chemical storage policy\n\nStore flammables in the yellow cabinet.\n');
  writeFileSync(join(dir, 'induction-notes.txt'), 'Induction notes: every new starter reads the SDS for products they use.\n');
  writeFileSync(join(dir, '.hidden.md'), 'ignored');
  return dir;
}

describe('make and one-shot review', () => {
  beforeEach(() => {
    useFakeEnv();
  });

  it('classifies what it is given', () => {
    const dir = docsFolder();
    expect(classifyInputs([])).toEqual({ kind: 'prompt' });
    expect(classifyInputs([dir])).toMatchObject({ kind: 'documents' });
    expect((classifyInputs([dir]) as { files: string[] }).files).toHaveLength(2);
    const html = join(dir, 'draft.html');
    writeFileSync(html, '<html></html>');
    expect(classifyInputs([html])).toEqual({ kind: 'course', file: html });
    expect(classifyInputs([html, join(dir, 'induction-notes.txt')]).kind).toBe('documents');
    expect(() => classifyInputs([join(dir, 'missing.md')])).toThrow(/Not found/);
    expect(titleFrom('Chemical safety data sheets for new staff.\nMore detail here', '')).toBe('Chemical safety data sheets for new staff');
    expect(titleFrom('', 'Chemical storage policy')).toBe('Chemical storage policy');
  });

  it('prompt + documents: runs unattended to one sign-off before release, then releases on approval', async () => {
    const res = await api.make({
      prompt: 'Chemical safety data sheets for new warehouse staff',
      paths: [docsFolder()],
      setup: oneShot,
    });
    expect(res.input).toBe('documents');
    const dir = courseDir(res.courseId);
    expect(res.outcome.status).toBe('waiting');
    expect(res.outcome.stoppedAt).toBe('RELEASE');
    const state = loadState(dir);
    for (const s of STAGES.filter((x) => x !== 'RELEASE')) expect(state.stages[s].status).toBe('LOCKED');
    expect(state.stages.RELEASE.gate?.mode).toBe('human');

    const material = readFileSync(join(dir, 'input/source-material.md'), 'utf8');
    expect(material).toContain('Store flammables in the yellow cabinet');
    expect(material).toContain('every new starter reads the SDS');
    expect(material).not.toContain('ignored');
    expect(readFileSync(join(dir, 'input/concept-request.md'), 'utf8')).toContain('Chemical safety data sheets for new warehouse staff');
    const plans = readdirSync(join(dir, 'logs/execution-plans')).map((f) => readFileSync(join(dir, 'logs/execution-plans', f), 'utf8'));
    const withSources = plans.filter((p) => p.includes('input/source-material.md')).map((p) => JSON.parse(p).stage);
    expect(new Set(withSources)).toEqual(new Set(['CONCEPT', 'RESEARCH_BRIEF', 'RESEARCH_DOSSIER']));

    await api.gate({ courseId: res.courseId, stage: 'RELEASE', action: 'approve', by: 'Test Author' });
    const done = await api.continueRun({ courseId: res.courseId });
    expect(done.status).toBe('completed');
    expect(existsSync(join(dir, 'release/course.html'))).toBe(true);
  }, 900_000);

  it('findings that cannot be fixed are carried to the release sign-off instead of pausing mid-way', async () => {
    const demoDir = process.env.COURSEFORGE_FIXTURES as string;
    const repair = JSON.parse(readFileSync(join(demoDir, 'repair/default.json'), 'utf8'));
    const perCycle = (c: number) => ({
      output: {
        ...repair.output,
        replacements: repair.output.replacements.map((r: { actionIds: string[] }) => ({ ...r, actionIds: [`A${c}-01`] })),
      },
    });
    process.env.COURSEFORGE_FIXTURES = fixturesWith({
      'repair/repairer.c1.json': perCycle(1),
      'repair/repairer.c2.json': perCycle(2),
      'repair/repairer.c3.json': perCycle(3),
      'review/assessment.json': JSON.parse(readFileSync(join(demoDir, 'review/assessment.c0.json'), 'utf8')),
    });
    // The same fixtures make a recommended-level run stop at STORYBOARD with reason cycle_cap (@C6).
    const res = await api.make({ prompt: 'Chemical safety data sheets', paths: [], setup: oneShot });
    const state = loadState(courseDir(res.courseId));
    expect(state.stages.STORYBOARD.status).toBe('LOCKED');
    expect(state.stages.STORYBOARD.cyclesUsed).toBe(3);
    expect(res.outcome.status).toBe('waiting');
    expect(res.outcome.stoppedAt).toBe('RELEASE');
  }, 900_000);

  it('make --course continues an existing course and refuses extra input', async () => {
    const { courseId } = await api.newCourse({ title: 'Existing course', setup: { ...oneShot } });
    await expect(api.make({ courseId, prompt: 'more', paths: [] })).rejects.toThrow(/continues an existing course/);
  });
});
