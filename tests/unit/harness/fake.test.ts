import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from '../../../src/harness/factory.js';
import { FakeHarness, fixtureCandidates } from '../../../src/harness/fake.js';
import { findSecret, maybeRecord, RecordingHarness, recordPath, scrubText } from '../../../src/harness/record.js';
import type { AgentHarness, AgentTaskRequest } from '../../../src/harness/types.js';
import { makeRequest, tmp } from './helpers.js';

function fixtures(files: Record<string, unknown>): string {
  const dir = tmp('cf-fake-');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), JSON.stringify(body));
  }
  return dir;
}

afterEach(() => {
  delete process.env.COURSEFORGE_FAKE_MODE;
  delete process.env.COURSEFORGE_FIXTURES;
});

describe('fake harness fixture lookup', () => {
  const all = {
    'review/accuracy.c1.json': { output: 'subject-cycle' },
    'review/accuracy.json': { output: 'subject' },
    'review/default.c1.json': { output: 'default-cycle' },
    'review/default.json': { output: 'default' },
  };

  it.each([
    [{ subject: 'accuracy', cycle: 1 }, all, 'subject-cycle'],
    [{ subject: 'accuracy', cycle: 0 }, all, 'subject'],
    [{ subject: 'other', cycle: 1 }, all, 'default-cycle'],
    [{ subject: null, cycle: 2 }, all, 'default'],
  ] as const)('%j → %s', async (over, files, expected) => {
    const h = new FakeHarness({ fixturesDir: fixtures(files) });
    const res = await h.run(makeRequest(over as Partial<AgentTaskRequest>));
    expect(res).toMatchObject({ ok: true, output: expected, backend: 'fake' });
  });

  it('sanitises subject for filenames', () => {
    expect(fixtureCandidates('/f', { promptTemplate: 'review', subject: 'a/b c', cycle: 0 })[0]).toBe(
      join('/f', 'review', 'a_b_c.c0.json'),
    );
  });

  it('missing fixture → invalid_request naming every expected path', async () => {
    const dir = tmp();
    const res = await new FakeHarness({ fixturesDir: dir }).run(makeRequest());
    expect(res.ok).toBe(false);
    expect(res.failure?.class).toBe('invalid_request');
    expect(res.failure?.message).toContain(join(dir, 'review', 'accuracy.c0.json'));
    expect(res.failure?.message).toContain(join(dir, 'review', 'default.json'));
  });

  it('uses COURSEFORGE_FIXTURES when no dir is given', async () => {
    process.env.COURSEFORGE_FIXTURES = fixtures({ 'review/default.json': { output: { x: 1 } } });
    expect((await new FakeHarness().run(makeRequest())).output).toEqual({ x: 1 });
  });

  it('envelope failure and files (relative to first writable path, absolute as-is)', async () => {
    const out = tmp();
    const abs = join(tmp(), 'elsewhere.txt');
    const dir = fixtures({
      'review/default.json': { output: null, failure: { class: 'overloaded', message: 'busy' }, files: { 'a/b.md': 'hi', [abs]: 'x' } },
    });
    const res = await new FakeHarness({ fixturesDir: dir }).run(makeRequest({ writablePaths: [out] }));
    expect(res.failure).toEqual({ class: 'overloaded', message: 'busy', retryable: true });
    expect(readFileSync(join(out, 'a', 'b.md'), 'utf8')).toBe('hi');
    expect(existsSync(abs)).toBe(true);
  });

  it('responder overrides fixtures', async () => {
    const h = new FakeHarness({ fixturesDir: tmp(), responder: (req) => ({ output: { role: req.role } }) });
    expect((await h.run(makeRequest())).output).toEqual({ role: 'research-reviewer' });
  });
});

describe('fake harness modes', () => {
  const ok = () => fixtures({ 'review/default.json': { output: { ok: true } } });

  it('fail / fail:<class>', async () => {
    expect((await new FakeHarness({ fixturesDir: ok(), mode: 'fail' }).run(makeRequest())).failure?.class).toBe('process_error');
    process.env.COURSEFORGE_FAKE_MODE = 'fail:authentication_failed';
    expect((await new FakeHarness({ fixturesDir: ok() }).run(makeRequest())).failure?.class).toBe('authentication_failed');
  });

  it('invalid-json returns a non-JSON-object output for the schema check', async () => {
    const res = await new FakeHarness({ fixturesDir: ok(), mode: 'invalid-json' }).run(makeRequest());
    expect(res.ok).toBe(true);
    expect(typeof res.output).toBe('string');
  });

  it('timeout', async () => {
    expect((await new FakeHarness({ fixturesDir: ok(), mode: 'timeout' }).run(makeRequest())).failure).toMatchObject({
      class: 'timeout',
      retryable: true,
    });
  });

  it('slow:<ms> runs concurrently and calls[] records overlapping intervals', async () => {
    const h = new FakeHarness({ fixturesDir: ok(), mode: 'slow:60' });
    await Promise.all(['a', 'b', 'c'].map((s) => h.run(makeRequest({ taskId: s, subject: s }))));
    expect(h.calls.map((c) => c.taskId).sort()).toEqual(['a', 'b', 'c']);
    for (const c of h.calls) expect(c.endedAt - c.startedAt).toBeGreaterThanOrEqual(50);
    const latestStart = Math.max(...h.calls.map((c) => c.startedAt));
    const earliestEnd = Math.min(...h.calls.map((c) => c.endedAt));
    expect(latestStart).toBeLessThan(earliestEnd);
    expect(h.calls[0]).toMatchObject({ role: 'research-reviewer', promptTemplate: 'review', cycle: 0 });
  });
});

describe('factory and recorder', () => {
  it('createHarness returns the requested adapter', () => {
    expect(createHarness('fake').name).toBe('fake');
    expect(createHarness('claude').name).toBe('claude');
    expect(createHarness('codex').name).toBe('codex');
  });

  it('scrubs home paths, emails and tokens', () => {
    const home = 'C:\\Users\\alice';
    const text = scrubText(
      JSON.stringify({
        p: 'C:\\Users\\alice\\x',
        q: 'c:/Users/alice/y',
        e: 'a.b@example.com',
        k: 'sk-ant-abcdefghijklmnopqrstu',
        h: 'Bearer abcdefghijklmnopqrstuv',
      }),
      home,
    );
    expect(text).not.toMatch(/alice|example\.com|sk-ant|abcdefghijklmnop/);
    expect(text).toContain('<HOME>');
    expect(findSecret(text)).toBeNull();
    expect(findSecret('AKIAABCDEFGHIJKLMNOP')).not.toBeNull();
  });

  it('records envelopes at <dir>/<template>/<subject|default>.c<cycle>.json and refuses surviving secrets', async () => {
    const dir = tmp();
    const inner: AgentHarness = new FakeHarness({ responder: (req) => ({ output: { echo: req.subject } }) });
    const rec = new RecordingHarness(inner, dir);
    await rec.run(makeRequest({ subject: null, cycle: 2 }));
    expect(JSON.parse(readFileSync(join(dir, 'review', 'default.c2.json'), 'utf8'))).toEqual({ output: { echo: null } });

    const leaky = new RecordingHarness(new FakeHarness({ responder: () => ({ output: '-----BEGIN RSA PRIVATE KEY-----' }) }), dir);
    await leaky.run(makeRequest({ subject: 'x' }));
    expect(existsSync(recordPath(dir, { promptTemplate: 'review', subject: 'x', cycle: 0 }))).toBe(false);
    expect(leaky.refused).toHaveLength(1);
  });

  it('maybeRecord wraps real harnesses only when a dir is given', () => {
    const fake = new FakeHarness();
    expect(maybeRecord(fake, '/x')).toBe(fake);
    expect(maybeRecord(createHarness('codex'), '/x')).toBeInstanceOf(RecordingHarness);
    const c = createHarness('codex');
    expect(maybeRecord(c, undefined)).toBe(c);
  });
});
