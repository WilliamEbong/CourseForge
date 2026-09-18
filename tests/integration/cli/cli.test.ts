/** CLI → PipelineApi dispatch with an injected fake API (argument mapping, output, exit-code propagation). */
import { describe, expect, it } from 'vitest';
import { main } from '../../../src/cli/main.js';
import { CfError } from '../../../src/core/errors.js';
import type { PipelineApi, RunOutcome } from '../../../src/pipeline/api.js';

const outcome = (over: Partial<RunOutcome> = {}): RunOutcome => ({
  courseId: 'x',
  runId: 'r1',
  status: 'completed',
  stoppedAt: 'COURSE_BUILD',
  stages: [{ stage: 'COURSE_BUILD', status: 'LOCKED' }],
  message: 'done',
  exitCode: 0,
  ...over,
});

function fakeApi(next: Partial<RunOutcome> = {}) {
  const calls: { op: string; args: unknown }[] = [];
  const rec =
    <T>(op: string, result: T) =>
    async (args?: unknown) => {
      calls.push({ op, args });
      return result;
    };
  const api: PipelineApi = {
    newCourse: rec('newCourse', { courseId: 'x', courseDir: '/c/x', outcome: null }),
    ingest: async (args) => {
      calls.push({ op: 'ingest', args });
      throw new CfError('COURSE_LOCKED', 'locked by pid 1', { exitCode: 5 });
    },
    run: rec('run', outcome(next)),
    continueRun: rec('continueRun', outcome(next)),
    review: rec('review', outcome(next)),
    improve: rec('improve', outcome(next)),
    status: rec('status', {
      courseId: 'x',
      title: 'X',
      riskTier: 'standard',
      currentStage: 'CONCEPT',
      targetStage: 'RELEASE',
      activeRunId: null,
      stages: [],
      nextAction: 'run',
    }),
    gate: rec('gate', null),
    findings: rec('findings', []),
    versions: rec('versions', []),
    trace: rec('trace', { nodes: [] }),
    packageCourse: rec('packageCourse', { path: 'x.zip', bytes: 1 }),
    clean: rec('clean', { removed: [] }),
    listCourses: rec('listCourses', []),
    smoke: rec('smoke', { ok: true, steps: [] }),
  };
  return { api, calls };
}

const capture = () => {
  const out = { stdout: '', stderr: '' };
  return {
    out,
    io: { stdout: { write: (s: string) => (out.stdout += s) }, stderr: { write: (s: string) => (out.stderr += s) } },
  };
};

describe('cli dispatch', () => {
  it('run maps stage aliases and flags to api.run', async () => {
    const { api, calls } = fakeApi();
    const { io, out } = capture();
    const code = await main(
      ['run', '--course', 'x', '--from', 'storyboard', '--to', 'build', '--gate', 'required', '--backend', 'codex'],
      io,
      {
        api,
      },
    );
    expect(code).toBe(0);
    expect(calls[0]).toEqual({
      op: 'run',
      args: expect.objectContaining({
        courseId: 'x',
        from: 'STORYBOARD',
        to: 'COURSE_BUILD',
        gate: 'human',
        backend: 'codex',
        force: false,
      }),
    });
    expect(out.stdout).toContain('x: completed at COURSE_BUILD');
  });

  it('propagates RunOutcome.exitCode (waiting for human → 10) and prints JSON with --json', async () => {
    const { api } = fakeApi({ status: 'waiting', exitCode: 10 });
    const { io, out } = capture();
    expect(await main(['continue', '--course', 'x', '--json'], io, { api })).toBe(10);
    expect(JSON.parse(out.stdout)).toMatchObject({ status: 'waiting', exitCode: 10 });
  });

  it('build/qa/release are sugar for a single-stage run', async () => {
    const { api, calls } = fakeApi();
    await main(['release', '--course', 'x'], capture().io, { api });
    expect(calls[0]?.args).toMatchObject({ courseId: 'x', from: 'RELEASE', to: 'RELEASE' });
  });

  it('CfError exit codes are returned (course locked → 5)', async () => {
    const { api } = fakeApi();
    const { io, out } = capture();
    expect(await main(['ingest', 'file.md', '--stage', 'dossier', '--mode', 'improve'], io, { api })).toBe(5);
    expect(out.stderr).toContain('locked by pid 1');
  });

  it('unknown errors → exit 1 with message, no stack unless COURSEFORGE_DEBUG', async () => {
    const { api } = fakeApi();
    api.listCourses = async () => {
      throw new Error('boom');
    };
    const { io, out } = capture();
    expect(await main(['list'], io, { api })).toBe(1);
    expect(out.stderr).toBe('courseforge: internal error: boom\n');
  });

  it('status without --course lists courses; gate/findings parse actions and ids', async () => {
    const { api, calls } = fakeApi();
    await main(['status'], capture().io, { api });
    await main(['gate', 'lock', '--course', 'x', '--stage', 'design', '--ids', 'LO1,LO2'], capture().io, { api });
    await main(['findings', 'accept', '--course', 'x', '--ids', 'F1'], capture().io, { api });
    expect(calls.map((c) => c.op)).toEqual(['listCourses', 'gate', 'findings']);
    expect(calls[1]?.args).toMatchObject({ action: 'lock', stage: 'INSTRUCTIONAL_DESIGN', ids: ['LO1', 'LO2'] });
    expect(calls[2]?.args).toMatchObject({ action: 'accept', ids: ['F1'] });
    expect(await main(['gate', 'explode', '--course', 'x', '--stage', 'qa'], capture().io, { api })).toBe(2);
  });

  it('new passes options through and numeric flags are validated', async () => {
    const { api, calls } = fakeApi();
    expect(await main(['new', 'Chemical risk', '--duration', '90', '--to', 'research'], capture().io, { api })).toBe(0);
    expect(calls[0]?.args).toMatchObject({ title: 'Chemical risk', durationMinutes: 90, runTo: 'RESEARCH_DOSSIER' });
    expect(await main(['new', 'X', '--duration', 'soon'], capture().io, { api })).toBe(2);
  });

  it('setup prints READY only when doctor is ready and smoke passes', async () => {
    const { api } = fakeApi();
    const ready = { status: 'ready', checks: [], platform: 'linux', architecture: 'x64', node: { version: '24' } };
    const doctor = async () => ready as never;
    const ok = capture();
    expect(await main(['setup'], ok.io, { api, doctor })).toBe(0);
    expect(ok.out.stdout.trimEnd().endsWith('READY')).toBe(true);
    api.smoke = async () => ({ ok: false, steps: [{ name: 'axe', ok: false, detail: 'violations' }] });
    const bad = capture();
    expect(await main(['setup'], bad.io, { api, doctor })).toBe(3);
    expect(bad.out.stdout).not.toMatch(/^READY$/m);
  });
});
