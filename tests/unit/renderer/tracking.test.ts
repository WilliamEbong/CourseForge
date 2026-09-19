/** Learner result tracking: CSP origins, the single-file check's allowed list, event shape and field validation. */
import { describe, expect, it } from 'vitest';
import { summarize } from '../../../components/course-ui/src/runtime/grade.js';
import { buildEvent, findScormApi, learnerProblem } from '../../../components/course-ui/src/runtime/track.js';
import type { CfData, CfTracking } from '../../../components/course-ui/src/runtime/types.js';
import { effectiveTracking, type Tracking, TrackingEventSchema, trackingOrigins } from '../../../src/core/schemas/index.js';
import { checkSingleFile } from '../../../src/renderer/checks.js';

const SHEET = 'https://script.google.com/macros/s/AKfy-abc/exec';
const tracking = (over: Partial<Tracking>): Tracking => ({
  destination: 'none',
  endpoint: null,
  identity: 'name',
  id_label: null,
  ...over,
});
const csp = (connect: string) =>
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; connect-src ${connect}">`;

describe('tracking origins and the single-file check', () => {
  it('untracked, LMS and unfinished courses stay fully offline', () => {
    expect(trackingOrigins(null)).toEqual([]);
    expect(trackingOrigins(tracking({ destination: 'lms' }))).toEqual([]);
    expect(effectiveTracking({ tracking: tracking({ destination: 'sheet' }) })).toBeNull();
    expect(effectiveTracking({ tracking: tracking({ destination: 'lms' }) })).not.toBeNull();
  });

  it('a Google Sheet allows the script host and its reply host; a dashboard allows only its own origin', () => {
    expect(trackingOrigins(tracking({ destination: 'sheet', endpoint: SHEET }))).toEqual([
      'https://script.google.com',
      'https://script.googleusercontent.com',
    ]);
    expect(trackingOrigins(tracking({ destination: 'tracker', endpoint: 'https://results.example.org:8443/api/events' }))).toEqual([
      'https://results.example.org:8443',
    ]);
  });

  it('@G2 the CSP must allow exactly the declared origins, nothing more and nothing less', () => {
    const allowed = ['https://script.google.com', 'https://script.googleusercontent.com'];
    expect(checkSingleFile(csp("'none'")).pass).toBe(true);
    expect(checkSingleFile(csp(allowed.join(' ')), allowed).pass).toBe(true);
    expect(checkSingleFile(csp(allowed.join(' '))).pass).toBe(false);
    expect(checkSingleFile(csp("'none'"), allowed).pass).toBe(false);
    expect(checkSingleFile(csp(`${allowed.join(' ')} https://evil.example`), allowed).pass).toBe(false);
    expect(checkSingleFile(csp('*'), allowed).pass).toBe(false);
  });

  it('manifest endpoints must be https (http only for a local test dashboard)', async () => {
    const { TrackingSchema } = await import('../../../src/core/schemas/index.js');
    expect(TrackingSchema.safeParse({ destination: 'tracker', endpoint: 'http://results.example.org/api/events' }).success).toBe(false);
    expect(TrackingSchema.safeParse({ destination: 'tracker', endpoint: 'http://localhost:8787/api/events' }).success).toBe(true);
    expect(TrackingSchema.safeParse({ destination: 'sheet', endpoint: SHEET }).success).toBe(true);
  });
});

describe('runtime result event', () => {
  const data: CfData = { courseId: 'demo', version: '1.0.0', storageKey: 'k', passingPercent: 80, screens: [], items: {} };
  const t: CfTracking = { destination: 'sheet', endpoint: SHEET, identity: 'name_and_id', courseTitle: 'Demo', recordScreen: 'M1-RESULTS' };

  it('matches TrackingEventSchema for graded and ungraded courses', () => {
    const graded = summarize(['a', 'b'], { a: { correct: true }, b: { correct: false } }, 50);
    const e = buildEvent(data, t, { name: '  Test Learner ', id: 'S-001', email: null }, graded, 2, new Date('2026-09-18T10:00:00Z'));
    expect(TrackingEventSchema.parse(e)).toEqual(e);
    expect(e).toMatchObject({
      percent: 50,
      passed: true,
      correct: 1,
      total: 2,
      attempt: 2,
      learner: { name: 'Test Learner', id: 'S-001' },
    });
    const ungraded = buildEvent(data, t, { name: 'A', id: '', email: '' }, summarize([], {}, 80), 1, new Date());
    expect(TrackingEventSchema.parse(ungraded)).toMatchObject({
      percent: null,
      passed: null,
      total: 0,
      learner: { id: null, email: null },
    });
  });

  it('learner details are checked per identity choice', () => {
    expect(learnerProblem('name', { name: ' ', id: null, email: null })?.field).toBe('name');
    expect(learnerProblem('name_and_id', { name: 'A', id: '', email: null })?.field).toBe('id');
    expect(learnerProblem('name_and_email', { name: 'A', id: null, email: 'not-an-email' })?.field).toBe('email');
    expect(learnerProblem('name_and_email', { name: 'A', id: null, email: 'a@example.com' })).toBeNull();
  });

  it('finds the SCORM API in a parent frame and survives a cross-origin parent', () => {
    const api = { LMSInitialize: () => 'true' };
    const top = { API: api } as unknown as Window;
    (top as unknown as { parent: Window }).parent = top;
    const child = { parent: top } as unknown as Window;
    expect(findScormApi(child)).toBe(api);
    const hostile = {
      get parent(): Window {
        throw new Error('cross-origin');
      },
    } as unknown as Window;
    expect(findScormApi(hostile)).toBeNull();
  });
});
