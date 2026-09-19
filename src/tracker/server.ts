/**
 * `courseforge tracker`: a small results server for organisations without an LMS or Google account.
 *
 * - `POST /api/events`: tracked courses send one result here (no login; validated, size- and rate-limited).
 * - `GET /`, `GET /api/events`, `GET /api/events.csv`: the dashboard, JSON and CSV, behind a password (HTTP Basic,
 *   from COURSEFORGE_TRACKER_PASSWORD).
 *
 * Plain HTTP only: to use it over the internet, put it behind an HTTPS reverse proxy (docs/user-guide/tracking.md).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { TrackingEventSchema } from '../core/schemas/tracking.js';
import { dashboardHtml } from './dashboard.js';
import { appendResult, readResults, resultsCsv, summarizeResults } from './store.js';

export interface TrackerOptions {
  dataDir: string;
  password: string;
  now?: () => Date;
  /** Results accepted per client address per minute. */
  perMinute?: number;
}

const MAX_BODY = 8 * 1024;
const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Courses post from any page (including file://), so results may be sent cross-origin; nothing is readable back. */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' };

function send(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}
const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) =>
  send(res, status, JSON.stringify(body), { 'Content-Type': 'application/json; charset=utf-8', ...headers });

/** The request body as text, or null as soon as it exceeds MAX_BODY (the rest is not read). */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (c: Buffer) => {
      size += c.length;
      if (size <= MAX_BODY) return void chunks.push(c);
      req.off('data', onData);
      req.pause();
      resolve(null);
    };
    req.on('data', onData);
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createTrackerServer(o: TrackerOptions): Server {
  if (!o.password) throw new Error('a dashboard password is required');
  const now = o.now ?? (() => new Date());
  const perMinute = o.perMinute ?? 60;
  const expected = digest(o.password);
  const hits = new Map<string, { windowStart: number; count: number }>();

  const authorised = (req: IncomingMessage) => {
    const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization ?? '');
    if (!m) return false;
    const decoded = Buffer.from(m[1]!, 'base64').toString('utf8');
    const password = decoded.slice(decoded.indexOf(':') + 1);
    return timingSafeEqual(digest(password), expected);
  };
  const limited = (req: IncomingMessage) => {
    const key = req.socket.remoteAddress ?? '';
    const t = now().getTime();
    const h = hits.get(key);
    if (!h || t - h.windowStart >= 60_000) {
      if (hits.size > 10_000) hits.clear(); // ponytail: crude cap; a real deployment sits behind a proxy that rate-limits
      hits.set(key, { windowStart: t, count: 1 });
      return false;
    }
    h.count++;
    return h.count > perMinute;
  };

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://tracker.local');
      if (url.pathname === '/api/events' && req.method === 'OPTIONS') return send(res, 204, '', CORS);
      if (url.pathname === '/api/events' && req.method === 'POST') {
        if (limited(req)) return json(res, 429, { ok: false, error: 'too many results; try again in a minute' }, CORS);
        const body = await readBody(req);
        if (body === null) {
          res.on('finish', () => req.destroy());
          return json(res, 413, { ok: false, error: 'result too large' }, { ...CORS, Connection: 'close' });
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          return json(res, 400, { ok: false, error: 'not JSON' }, CORS);
        }
        const ev = TrackingEventSchema.safeParse(parsed);
        if (!ev.success) return json(res, 400, { ok: false, error: 'not a CourseForge result' }, CORS);
        appendResult(o.dataDir, ev.data, now().toISOString());
        return json(res, 200, { ok: true }, CORS);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false, error: 'method not allowed' });
      if (!['/', '/api/events', '/api/events.csv'].includes(url.pathname)) return json(res, 404, { ok: false, error: 'not found' });
      if (!authorised(req))
        return send(res, 401, 'Password required', {
          'WWW-Authenticate': 'Basic realm="CourseForge results", charset="UTF-8"',
          'Content-Type': 'text/plain',
        });

      const course = url.searchParams.get('course');
      const all = readResults(o.dataDir);
      const results = course ? all.filter((r) => r.courseId === course) : all;
      if (url.pathname === '/api/events') return json(res, 200, { results, summaries: summarizeResults(results) });
      if (url.pathname === '/api/events.csv')
        return send(res, 200, `\uFEFF${resultsCsv(results)}`, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="course-results${course ? `-${course.replace(/[^\w-]/g, '')}` : ''}.csv"`,
        });
      const nonce = randomBytes(16).toString('base64');
      return send(res, 200, dashboardHtml({ results: all, summaries: summarizeResults(all), course, nonce }), {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        'Referrer-Policy': 'no-referrer',
      });
    } catch {
      if (!res.headersSent) json(res, 500, { ok: false, error: 'internal error' });
      else res.destroy();
    }
  });
}
