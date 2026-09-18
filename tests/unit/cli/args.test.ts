import { describe, expect, it } from 'vitest';
import { optList, parseCommand, resolveStage } from '../../../src/cli/args.js';
import { main } from '../../../src/cli/main.js';

const capture = () => {
  const out = { stdout: '', stderr: '' };
  return {
    out,
    io: {
      stdout: { write: (s: string) => (out.stdout += s) },
      stderr: { write: (s: string) => (out.stderr += s) },
    },
  };
};

describe('cli args', () => {
  it('resolves canonical stage names in any case and the short aliases', () => {
    expect(resolveStage('storyboard')).toBe('STORYBOARD');
    expect(resolveStage('course-build')).toBe('COURSE_BUILD');
    expect(resolveStage('Research_Dossier')).toBe('RESEARCH_DOSSIER');
    expect(resolveStage('research')).toBe('RESEARCH_DOSSIER');
    expect(resolveStage('dossier')).toBe('RESEARCH_DOSSIER');
    expect(resolveStage('brief')).toBe('RESEARCH_BRIEF');
    expect(resolveStage('design')).toBe('INSTRUCTIONAL_DESIGN');
    expect(resolveStage('visual')).toBe('VISUAL_DIRECTION');
    expect(resolveStage('model')).toBe('COURSE_MODEL');
    expect(resolveStage('qa')).toBe('COURSE_QA');
    expect(resolveStage('RELEASE')).toBe('RELEASE');
    expect(() => resolveStage('publish')).toThrow(/unknown stage/);
  });

  it('parses flags and rejects unknown options as usage errors', () => {
    const p = parseCommand(['--course', 'x', '--force', 'extra'], { course: { type: 'string' }, force: { type: 'boolean' } }, 1, 'run');
    expect(p.values).toMatchObject({ course: 'x', force: true });
    expect(p.positionals).toEqual(['extra']);
    expect(() => parseCommand(['--nope'], {}, 0, 'run')).toThrow(expect.objectContaining({ exitCode: 2 }));
    expect(() => parseCommand(['a', 'b'], {}, 1, 'run')).toThrow(/unexpected argument "b"/);
    expect(optList({ ids: 'a, b,,c' }, 'ids')).toEqual(['a', 'b', 'c']);
  });

  it('unknown command → exit 2 with a message', async () => {
    const { io, out } = capture();
    expect(await main(['frobnicate'], io)).toBe(2);
    expect(out.stderr).toContain('unknown command "frobnicate"');
  });

  it('bad stage / missing --course → exit 2; --json adds a machine-readable error', async () => {
    const { io, out } = capture();
    expect(await main(['run', '--course', 'c', '--to', 'nowhere', '--json'], io)).toBe(2);
    expect(JSON.parse(out.stdout)).toMatchObject({ ok: false, error: { code: 'USAGE', exitCode: 2 } });
    expect(await main(['continue'], capture().io)).toBe(2);
  });

  it('help lists every command; per-command help works', async () => {
    const { io, out } = capture();
    expect(await main(['help'], io)).toBe(0);
    for (const cmd of ['setup', 'doctor', 'ingest', 'gate', 'findings', 'trace', 'package', 'clean']) expect(out.stdout).toContain(cmd);
    const one = capture();
    expect(await main(['gate', '--help'], one.io)).toBe(0);
    expect(one.out.stdout).toContain('Usage: courseforge gate');
    expect(await main([], capture().io)).toBe(2);
  });
});
