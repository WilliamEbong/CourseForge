/** Self-hosted results server: accepts valid results only, protects the dashboard, escapes everything learners type. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { TrackingEvent } from '../../../src/core/schemas/tracking.js';
import { createTrackerServer } from '../../../src/tracker/server.js';
import { eventsFile, readResults, resultsCsv, summarizeResults } from '../../../src/tracker/store.js';

const PASSWORD = 'correct horse';
const auth = (p = PASSWORD) => ({ Authorization: `Basic ${Buffer.from(`anyone:${p}`).toString('base64')}` });
const event = (over: Partial<TrackingEvent> = {}): TrackingEvent => ({
  v: 1,
  courseId: 'forklift',
  courseTitle: 'Forklift safety',
  courseVersion: '1.0.0',
  learner: { name: 'Test Learner', id: 'S-001', email: null },
  percent: 80,
  passed: true,
  correct: 4,
  total: 5,
  completedAt: '2026-09-18T10:00:00.000Z',
  attempt: 1,
  test: false,
  ...over,
});

let server: Server | null = null;
async function start(opts: { perMinute?: number } = {}): Promise<{ base: string; dataDir: string }> {
  const dataDir = mkdtempSync(join(tmpdir(), 'cf-tracker-'));
  server = createTrackerServer({ dataDir, password: PASSWORD, now: () => new Date('2026-09-18T10:05:00Z'), ...opts });
  await new Promise<void>((ok) => server!.listen(0, '127.0.0.1', ok));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, dataDir };
}
afterEach(async () => {
  await new Promise<void>((ok) => (server ? server.close(() => ok()) : ok()));
  server = null;
});

const post = (base: string, body: string) =>
  fetch(`${base}/api/events`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });

describe('results server', () => {
  it('stores a valid result sent as a simple cross-origin request', async () => {
    const { base, dataDir } = await start();
    const res = await post(base, JSON.stringify(event()));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({ ok: true });
    expect(readResults(dataDir)).toEqual([{ ...event(), receivedAt: '2026-09-18T10:05:00.000Z' }]);
    const pre = await fetch(`${base}/api/events`, { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
  });

  it('rejects malformed, foreign and oversized results without storing them', async () => {
    const { base, dataDir } = await start();
    expect((await post(base, 'not json')).status).toBe(400);
    expect((await post(base, JSON.stringify({ ...event(), extra: 1 }))).status).toBe(400);
    expect((await post(base, JSON.stringify({ ...event(), percent: 101 }))).status).toBe(400);
    expect((await post(base, JSON.stringify(event({ learner: { name: 'x'.repeat(9000), id: null, email: null } })))).status).toBe(413);
    expect(readResults(dataDir)).toEqual([]);
  });

  it('limits results per client address per minute', async () => {
    const { base } = await start({ perMinute: 2 });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await post(base, JSON.stringify(event()))).status);
    expect(codes).toEqual([200, 200, 429]);
  });

  it('the dashboard, JSON and CSV need the password', async () => {
    const { base } = await start();
    await post(base, JSON.stringify(event()));
    for (const path of ['/', '/api/events', '/api/events.csv']) {
      expect((await fetch(`${base}${path}`)).status).toBe(401);
      expect((await fetch(`${base}${path}`, { headers: auth('wrong') })).status).toBe(401);
      expect((await fetch(`${base}${path}`, { headers: auth() })).status).toBe(200);
    }
    const unknown = await fetch(`${base}/secret`, { headers: auth() });
    expect(unknown.status).toBe(404);
    const data = (await (await fetch(`${base}/api/events?course=forklift`, { headers: auth() })).json()) as {
      results: unknown[];
      summaries: { people: number }[];
    };
    expect(data.results).toHaveLength(1);
    expect(data.summaries[0]?.people).toBe(1);
  });

  it('learner-typed text is escaped on the dashboard, and the page runs no script', async () => {
    const { base } = await start();
    const evil = '<img src=x onerror=alert(1)>';
    await post(base, JSON.stringify(event({ learner: { name: evil, id: '"><script>x</script>', email: null }, courseTitle: evil })));
    const res = await fetch(`${base}/`, { headers: auth() });
    const html = await res.text();
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(res.headers.get('content-security-policy')).toMatch(/default-src 'none'; style-src 'nonce-[^']+'/);
  });
});

describe('results store', () => {
  it('summaries count each person once, use their best result and ignore setup tests', () => {
    const at = (receivedAt: string, over: Partial<TrackingEvent>) => ({ ...event(over), receivedAt });
    const results = [
      at('2026-09-18T09:00:00Z', { percent: 40, passed: false }),
      at('2026-09-18T09:30:00Z', { percent: 90, passed: true, attempt: 2 }),
      at('2026-09-18T09:40:00Z', { learner: { name: 'Other Person', id: 'S-002', email: null }, percent: 60, passed: false }),
      at('2026-09-18T09:50:00Z', { test: true, courseId: 'courseforge-setup-test' }),
    ];
    expect(summarizeResults(results)).toEqual([
      {
        courseId: 'forklift',
        courseTitle: 'Forklift safety',
        people: 2,
        passed: 1,
        passRate: 50,
        averageBest: 75,
        lastResult: '2026-09-18T09:40:00Z',
      },
    ]);
  });

  it('CSV cells are quoted and never start a spreadsheet formula', () => {
    const csv = resultsCsv([
      { ...event({ learner: { name: '=HYPERLINK("http://x")', id: '+1', email: '@me' } }), receivedAt: '2026-09-18T10:05:00Z' },
    ]);
    const row = csv.split('\r\n')[1]!;
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(row).toContain(`"'+1"`);
    expect(row).toContain(`"'@me"`);
  });

  it('a damaged line in the results file is skipped', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cf-tracker-'));
    writeFileSync(eventsFile(dir), `${JSON.stringify({ ...event(), receivedAt: 'x' })}\n{"torn": \n`);
    expect(readResults(dir)).toHaveLength(1);
  });
});
