/**
 * End-to-end orchestration with the fake harness (no model calls): stage ranges, plan-first, review →
 * repair → re-review, human gates, locks, cycle caps, resume, versions and traceability.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { listArtifacts, loadRegistry } from '../../../src/artifacts/index.js';
import { STAGES } from '../../../src/core/enums.js';
import { readJsonl } from '../../../src/core/log.js';
import { courseDir } from '../../../src/core/paths.js';
import { StoryboardSchema } from '../../../src/core/schemas/index.js';
import { pipelineApi as api } from '../../../src/pipeline/impl.js';
import { loadManifest, loadState, saveManifest } from '../../../src/pipeline/store.js';
import { fixturesWith, useFakeEnv } from './helpers.js';

const TITLE = 'Spotting Phishing Emails';

function storyboard(id: string) {
  return StoryboardSchema.parse(JSON.parse(readFileSync(join(courseDir(id), 'storyboard/storyboard.json'), 'utf8')));
}

function events(id: string) {
  return readJsonl<{ event: string; stage: string | null; step: string | null; status: string | null }>(
    join(courseDir(id), 'logs/run-events.jsonl'),
  );
}

describe('pipeline with fake harness', () => {
  beforeEach(() => {
    useFakeEnv();
  });

  it('@C2 @D5 runs concept → instructional design and stops at the requested stage, plans saved before agent work', async () => {
    const { courseId, outcome } = await api.newCourse({ title: TITLE, runTo: 'INSTRUCTIONAL_DESIGN' });
    expect(outcome?.status).toBe('completed');
    const state = loadState(courseDir(courseId));
    for (const s of ['CONCEPT', 'RESEARCH_BRIEF', 'RESEARCH_DOSSIER', 'INSTRUCTIONAL_DESIGN'] as const)
      expect(state.stages[s].status).toBe('LOCKED');
    for (const s of ['STORYBOARD', 'EDITORIAL', 'RELEASE'] as const) expect(state.stages[s].status).toBe('NOT_STARTED');
    expect(existsSync(join(courseDir(courseId), 'storyboard/storyboard.json'))).toBe(false);
    // every stage has a saved plan, and the plan step precedes the first agent task of that stage
    const ev = events(courseId);
    for (const s of ['CONCEPT', 'RESEARCH_BRIEF', 'RESEARCH_DOSSIER', 'INSTRUCTIONAL_DESIGN']) {
      const planIdx = ev.findIndex((e) => e.stage === s && e.step === 'plan');
      const taskIdx = ev.findIndex((e) => e.stage === s && e.event === 'task.start');
      expect(planIdx, s).toBeGreaterThanOrEqual(0);
      expect(taskIdx, s).toBeGreaterThan(planIdx);
    }
    const decisions = readJsonl<{ kind: string }>(join(courseDir(courseId), 'logs/routing-decisions.jsonl'));
    expect(decisions.some((d) => d.kind === 'reviewer')).toBe(true);
    expect(decisions.some((d) => d.kind === 'backend')).toBe(true);
    // research artifacts: stable claim ids
    const claims = readFileSync(join(courseDir(courseId), 'research/claims.jsonl'), 'utf8');
    expect(claims).toContain('CLM-0001');
  });

  it('@E6 storyboard review raises a finding, repair applies it, the reviewer reruns', async () => {
    const { courseId } = await api.newCourse({ title: TITLE, runTo: 'RESEARCH_DOSSIER' });
    const outcome = await api.run({ courseId, to: 'VISUAL_DIRECTION', gate: 'auto' });
    expect(outcome.status).toBe('completed');
    const dir = courseDir(courseId);
    const state = loadState(dir);
    expect(state.stages.STORYBOARD.status).toBe('LOCKED');
    expect(state.stages.VISUAL_DIRECTION.status).toBe('LOCKED');
    const c0 = JSON.parse(readFileSync(join(dir, 'storyboard/review/storyboard/c0/findings.json'), 'utf8')) as {
      findingId: string;
      location: string;
      status: string;
    }[];
    expect(c0.some((f) => f.location === 'M1-F01')).toBe(true);
    const plan = JSON.parse(readFileSync(join(dir, 'storyboard/review/storyboard/c0/repair-plan.json'), 'utf8')) as {
      actions: { targetId: string }[];
    };
    expect(plan.actions.map((a) => a.targetId)).toContain('M1-F01');
    const sb = storyboard(courseId);
    const f01 = sb.modules.flatMap((m) => m.blocks).find((b) => b.id === 'M1-F01');
    expect(f01?.interaction?.feedbackIncorrect).toContain('fake sign-in page');
    // second cycle exists and only reran the reviewer whose finding was actioned (+ rerunMap)
    expect(existsSync(join(dir, 'storyboard/review/storyboard/c1/findings.json'))).toBe(true);
    const labels = listArtifacts(loadRegistry(dir), 'storyboard').map((a) => a.label);
    expect(labels.some((l) => l.includes('repaired'))).toBe(true);
  }, 600_000);

  it('@C4 continue resumes after an interrupted run without redoing completed generation', async () => {
    const { courseId } = await api.newCourse({ title: TITLE, runTo: 'RESEARCH_BRIEF' });
    const dir = courseDir(courseId);
    await api.run({ courseId, to: 'RESEARCH_DOSSIER' });
    // simulate a crash mid-review of the dossier stage
    const state = loadState(dir);
    state.stages.RESEARCH_DOSSIER.status = 'REVIEWING';
    state.stages.RESEARCH_DOSSIER.completedSteps = ['plan', 'generate'];
    const { saveState } = await import('../../../src/pipeline/store.js');
    saveState(dir, state, new Date().toISOString());
    const before = events(courseId).filter(
      (e) => e.stage === 'RESEARCH_DOSSIER' && e.event === 'task.start' && (e.step ?? '').includes(':gen'),
    ).length;
    const outcome = await api.continueRun({ courseId });
    expect(loadState(dir).stages.RESEARCH_DOSSIER.status).toBe('LOCKED');
    const after = events(courseId).filter(
      (e) => e.stage === 'RESEARCH_DOSSIER' && e.event === 'task.start' && (e.step ?? '').includes(':gen'),
    ).length;
    expect(after).toBe(before);
    expect(events(courseId).some((e) => e.event === 'stage.recovered')).toBe(true);
    expect(outcome.runId).toBeTruthy();
  }, 300_000);

  it('@C7 human gate pauses the run and approval resumes it', async () => {
    const { courseId } = await api.newCourse({ title: TITLE });
    const dir = courseDir(courseId);
    const m = loadManifest(dir);
    m.human_review = { RESEARCH_BRIEF: 'human' };
    saveManifest(dir, m);
    const first = await api.run({ courseId, to: 'RESEARCH_DOSSIER' });
    expect(first.status).toBe('waiting');
    expect(first.exitCode).toBe(10);
    expect(loadState(dir).stages.RESEARCH_BRIEF.status).toBe('WAITING_FOR_HUMAN');
    await expect(api.gate({ courseId, stage: 'RESEARCH_DOSSIER', action: 'approve' })).rejects.toThrow();
    await api.gate({ courseId, stage: 'RESEARCH_BRIEF', action: 'approve', by: 'tester' });
    const second = await api.continueRun({ courseId });
    // RESEARCH_BRIEF gets locked and the run moves on
    expect(loadState(dir).stages.RESEARCH_BRIEF.status).toBe('LOCKED');
    expect(second.stages.find((s) => s.stage === 'RESEARCH_DOSSIER')?.status).not.toBe('NOT_STARTED');
    const labels = listArtifacts(loadRegistry(dir), 'research-brief').map((a) => a.label);
    expect(labels.some((l) => l.includes('human-approved'))).toBe(true);
  }, 300_000);

  it('@C5 @E5 locked content is never silently replaced: a finding on a locked block becomes a conflict', async () => {
    const { courseId } = await api.newCourse({ title: TITLE, runTo: 'INSTRUCTIONAL_DESIGN' });
    const dir = courseDir(courseId);
    const m = loadManifest(dir);
    m.human_review = { STORYBOARD: 'auto' };
    saveManifest(dir, m);
    // Generate the storyboard with the review gate held (human), lock M1-F01, then re-review.
    m.human_review = { STORYBOARD: 'human' };
    saveManifest(dir, m);
    const r1 = await api.run({ courseId, to: 'STORYBOARD' });
    expect(r1.status).toBe('waiting');
    const before = storyboard(courseId)
      .modules.flatMap((x) => x.blocks)
      .find((b) => b.id === 'M1-F01');
    await api.gate({ courseId, stage: 'STORYBOARD', action: 'lock', ids: ['M1-F01'] });
    m.human_review = { STORYBOARD: 'auto' };
    saveManifest(dir, m);
    await api.gate({ courseId, stage: 'STORYBOARD', action: 'rereview' });
    const r2 = await api.continueRun({ courseId });
    const after = storyboard(courseId)
      .modules.flatMap((x) => x.blocks)
      .find((b) => b.id === 'M1-F01');
    expect(after).toEqual(before);
    const st = loadState(dir).stages.STORYBOARD;
    expect(st.status).toBe('WAITING_FOR_HUMAN');
    expect(st.gate?.reason).toBe('lock_conflict');
    expect(r2.status).toBe('waiting');
  }, 300_000);

  it('@C6 repair cycles are capped and escalate to a human', async () => {
    const demoDir = process.env.COURSEFORGE_FIXTURES as string;
    const repair = JSON.parse(readFileSync(join(demoDir, 'repair/default.json'), 'utf8'));
    const perCycle = (c: number) => ({
      output: {
        ...repair.output,
        replacements: repair.output.replacements.map((r: { actionIds: string[] }) => ({ ...r, actionIds: [`A${c}-01`] })),
      },
    });
    const fixtures = fixturesWith({
      'repair/repairer.c1.json': perCycle(1),
      'repair/repairer.c2.json': perCycle(2),
      'repair/repairer.c3.json': perCycle(3),
      'review/assessment.json': JSON.parse(readFileSync(join(demoDir, 'review/assessment.c0.json'), 'utf8')),
    });
    process.env.COURSEFORGE_FIXTURES = fixtures;
    const { courseId } = await api.newCourse({ title: TITLE, runTo: 'STORYBOARD' });
    const st = loadState(courseDir(courseId)).stages.STORYBOARD;
    expect(st.status).toBe('WAITING_FOR_HUMAN');
    expect(st.gate?.reason).toBe('cycle_cap');
    expect(st.cyclesUsed).toBe(3);
  }, 300_000);

  it('@C8 @F1 versions are tracked inside the course folder and every stage has a status', async () => {
    const { courseId } = await api.newCourse({ title: TITLE, runTo: 'RESEARCH_BRIEF' });
    const dir = courseDir(courseId);
    const reg = loadRegistry(dir);
    for (const a of listArtifacts(reg)) {
      expect(existsSync(join(dir, a.path))).toBe(true);
      if (a.snapshotPath) expect(existsSync(join(dir, a.snapshotPath))).toBe(true);
      expect(a.hash).toMatch(/^sha256:/);
    }
    const status = await api.status({ courseId });
    expect(status.stages.map((s) => s.stage)).toEqual([...STAGES]);
    expect(status.nextAction).toContain('continue');
  }, 300_000);
});
