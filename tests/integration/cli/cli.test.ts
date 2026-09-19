/** CLI → PipelineApi dispatch with an injected fake API (argument mapping, output, exit-code propagation). */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { type AddressInfo, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { main } from '../../../src/cli/main.js';
import { CfError } from '../../../src/core/errors.js';
import type { PipelineApi, RunOutcome, SetupAnswers } from '../../../src/pipeline/api.js';
import { loadRegistries } from '../../../src/routing/registries.js';

const defaultAnswers = (): SetupAnswers => ({
  language: 'en',
  audience: null,
  review: 'recommended',
  tracking: { destination: 'none', endpoint: null, identity: 'name', id_label: null },
});

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

function fakeApi(next: Partial<RunOutcome> = {}, courseExists = false) {
  const calls: { op: string; args: unknown }[] = [];
  const rec =
    <T>(op: string, result: T) =>
    async (args?: unknown) => {
      calls.push({ op, args });
      return result;
    };
  const api: PipelineApi = {
    newCourse: rec('newCourse', { courseId: 'x', courseDir: '/c/x', outcome: null, guides: [] }),
    ingestTarget: rec('ingestTarget', { courseId: 'x', title: 'X', isNew: true }),
    make: rec('make', {
      courseId: 'x',
      input: 'prompt',
      created: true,
      outcome: outcome({ ...next, status: 'waiting', stoppedAt: 'RELEASE', exitCode: 10 }),
      guides: [],
    }),
    setupInfo: async (args) => {
      calls.push({ op: 'setupInfo', args });
      return {
        courseId: 'x',
        title: 'X',
        exists: courseExists,
        configured: courseExists,
        answers: defaultAnswers(),
        guidance: loadRegistries().guidance,
      };
    },
    configure: rec('configure', {
      courseId: 'x',
      manifestPath: '/c/x/course.yaml',
      guides: [],
      trackingChanged: false,
      invalidated: [],
      unfinished: false,
    }),
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
      notices: [],
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

  it('the setup wizard never runs without a terminal, with --json or with --defaults', async () => {
    const { api, calls } = fakeApi();
    // capture() has no stdin, like redirected input.
    expect(await main(['new', 'Plain'], capture().io, { api })).toBe(0);
    const asked: string[] = [];
    const ask = async (q: string) => {
      asked.push(q);
      return '';
    };
    expect(await main(['new', 'Json', '--json'], capture().io, { api, ask })).toBe(0);
    expect(await main(['new', 'Quiet', '--defaults'], capture().io, { api, ask })).toBe(0);
    expect(asked).toEqual([]);
    expect(calls.map((c) => c.op)).toEqual(['newCourse', 'newCourse', 'newCourse']);
    expect(calls.every((c) => (c.args as { setup?: unknown }).setup === undefined)).toBe(true);
  });

  it('new asks the setup questions first and passes the answers to newCourse', async () => {
    const { api, calls } = fakeApi();
    const replies = ['fr', 'new warehouse staff', '3'];
    const ask = async () => replies.shift() ?? '';
    const { io, out } = capture();
    expect(await main(['new', 'Forklift safety', '--id', 'forklift'], io, { api, ask })).toBe(0);
    expect(calls.map((c) => c.op)).toEqual(['setupInfo', 'newCourse']);
    expect(calls[0]?.args).toEqual({ courseId: 'forklift', title: 'Forklift safety' });
    expect(calls[1]?.args).toMatchObject({
      setup: { language: 'fr', audience: 'new warehouse staff', review: 'every_step', tracking: { destination: 'none' } },
    });
    expect(out.stdout).toContain('This takes about a minute');
  });

  it('configure needs a terminal, then saves the wizard answers', async () => {
    const { api, calls } = fakeApi({}, true);
    const plain = capture();
    expect(await main(['configure', '--course', 'x'], plain.io, { api })).toBe(2);
    expect(plain.out.stderr).toContain('interactive terminal');
    const { io, out } = capture();
    expect(await main(['reconfigure', '--course', 'x'], io, { api, ask: async () => '' })).toBe(0);
    expect(calls.map((c) => c.op)).toEqual(['setupInfo', 'setupInfo', 'configure']);
    expect(calls[2]?.args).toEqual({ courseId: 'x', answers: defaultAnswers() });
    expect(out.stdout).toContain('Settings saved in /c/x/course.yaml');
  });

  it('make splits files from the prompt, applies --review without a terminal, and explains the sign-off', async () => {
    const { api, calls } = fakeApi();
    const { io, out } = capture();
    const here = import.meta.dirname;
    const code = await main(['make', 'Forklift', 'safety', here, '--review', 'one-shot'], io, { api });
    expect(code).toBe(10);
    const make = calls.find((c) => c.op === 'make')?.args as { prompt: string; paths: string[]; setup?: SetupAnswers };
    expect(make.prompt).toBe('Forklift safety');
    expect(make.paths).toEqual([here]);
    expect(make.setup?.review).toBe('one_shot');
    expect(out.stdout).toContain('waiting for your approval');
    expect(out.stdout).toContain('courseforge gate approve --course x --stage release');
    expect(await main(['make', 'x', '--review', 'sometimes'], capture().io, { api })).toBe(2);
  });

  it('make asks the setup questions first in a terminal; without one and without --review it uses the course defaults', async () => {
    const { api, calls } = fakeApi();
    const replies = ['', '', '1'];
    await main(['make', 'Ladder safety'], capture().io, { api, ask: async () => replies.shift() ?? '' });
    const made = (xs: { op: string; args: unknown }[]) => xs.find((c) => c.op === 'make')?.args as { setup?: SetupAnswers } | undefined;
    expect(made(calls)?.setup?.review).toBe('one_shot');
    const quiet = fakeApi();
    await main(['make', 'Ladder safety'], capture().io, { api: quiet.api });
    expect(made(quiet.calls)).toBeDefined();
    expect(made(quiet.calls)?.setup).toBeUndefined();
  });

  it('make tells the wizard the id it will create, and refuses --review for an existing course', async () => {
    const { api, calls } = fakeApi();
    await main(['make', 'Ladder safety for night shifts'], capture().io, { api, ask: async () => '' });
    expect(calls.find((c) => c.op === 'setupInfo')?.args).toMatchObject({ courseId: 'ladder-safety-for-night-shifts' });
    expect(calls.find((c) => c.op === 'make')?.args).toMatchObject({ id: 'ladder-safety-for-night-shifts' });
    // A course file keeps its import id (not a numbered free id), so make can report an existing course.
    const file = fakeApi();
    const html = join(mkdtempSync(join(tmpdir(), 'cf-make-')), 'draft.html');
    writeFileSync(html, '<html></html>');
    await main(['make', html], capture().io, { api: file.api });
    expect(file.calls.map((c) => c.op)).toEqual(['ingestTarget', 'setupInfo', 'make']);
    expect(file.calls.find((c) => c.op === 'make')?.args).toMatchObject({ id: 'x' });
    const { io, out } = capture();
    expect(await main(['make', '--course', 'x', '--review', 'one-shot'], io, { api })).toBe(2);
    expect(out.stderr).toContain('courseforge configure --course x');
  });

  it('the connection test accepts only a JSON {"ok":true} reply', async () => {
    const replies = (url: string) => ['', '', '', '4', '', url];
    const probe = async (body: string) => {
      vi.stubGlobal('fetch', async () => new Response(body));
      const r = replies('https://results.example/api/events');
      const { io, out } = capture();
      await main(['new', 'Probe', '--id', 'probe'], io, { api: fakeApi().api, ask: async () => r.shift() ?? '' });
      vi.unstubAllGlobals();
      return out.stdout;
    };
    expect(await probe('{"ok":true}')).toContain('It worked');
    expect(await probe('<p>"ok": true</p>')).toContain('not like a results connection');
  });

  it('tracker: a bad port is a usage error; a port in use is an environment error', async () => {
    vi.stubEnv('COURSEFORGE_TRACKER_PASSWORD', 'test-password');
    const data = mkdtempSync(join(tmpdir(), 'cf-tracker-'));
    try {
      expect(await main(['tracker', '--port', '70000', '--data', data], capture().io)).toBe(2);
      const busy = createServer();
      await new Promise<void>((ok) => busy.listen(0, '127.0.0.1', ok));
      const { port } = busy.address() as AddressInfo;
      const { io, out } = capture();
      expect(await main(['tracker', '--port', String(port), '--data', data], io)).toBe(3);
      expect(out.stderr).toContain('could not start');
      expect(out.stderr).not.toContain('internal error');
      await new Promise((done) => busy.close(done));
    } finally {
      vi.unstubAllEnvs();
      rmSync(data, { recursive: true, force: true });
    }
  });
});
