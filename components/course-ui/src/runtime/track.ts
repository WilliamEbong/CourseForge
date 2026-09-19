/**
 * Learner result tracking (only in tracked builds, ADR 0013). Web destinations post one small JSON result when the
 * learner presses "Record my result"; an LMS is told through the SCORM 1.2 `API` object of its player frame.
 * Nothing here runs, and no network request is ever made, when the course is untracked.
 */
import type { GradedSummary } from './grade.js';
import type { CfData, CfTracking } from './types.js';

/** The shape validated by `TrackingEventSchema` (src/core/schemas/tracking.ts). */
export interface TrackingEvent {
  v: 1;
  courseId: string;
  courseTitle: string;
  courseVersion: string;
  learner: { name: string; id: string | null; email: string | null };
  percent: number | null;
  passed: boolean | null;
  correct: number;
  total: number;
  completedAt: string;
  attempt: number;
  test: boolean;
}

export interface Learner {
  name: string;
  id: string | null;
  email: string | null;
}

export function buildEvent(
  data: CfData,
  t: CfTracking,
  learner: Learner,
  summary: GradedSummary,
  attempt: number,
  now: Date,
): TrackingEvent {
  return {
    v: 1,
    courseId: data.courseId,
    courseTitle: t.courseTitle,
    courseVersion: data.version,
    learner: { name: learner.name.trim(), id: learner.id?.trim() || null, email: learner.email?.trim() || null },
    percent: summary.total ? summary.percent : null,
    passed: summary.total ? summary.passed : null,
    correct: summary.correct,
    total: summary.total,
    completedAt: now.toISOString(),
    attempt,
    test: false,
  };
}

/** Why the learner's details cannot be sent yet (field key + message), or null when they are fine. */
export function learnerProblem(identity: CfTracking['identity'], l: Learner): { field: string; message: string } | null {
  if (!l.name.trim()) return { field: 'name', message: 'Please enter your name.' };
  if (identity === 'name_and_id' && !l.id?.trim()) return { field: 'id', message: 'Please enter your staff number.' };
  if (identity === 'name_and_email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email?.trim() ?? ''))
    return { field: 'email', message: 'Please enter a valid email address.' };
  return null;
}

/* ------------------------------------------------------------------ SCORM 1.2 */

export interface Scorm12Api {
  LMSInitialize(arg: ''): string;
  LMSFinish(arg: ''): string;
  LMSGetValue(name: string): string;
  LMSSetValue(name: string, value: string): string;
  LMSCommit(arg: ''): string;
}

/** Looks for the LMS's `API` object in this window's parents and opener (the SCORM 1.2 discovery rule). */
export function findScormApi(win: Window): Scorm12Api | null {
  const look = (w: Window | null): Scorm12Api | null => {
    for (let hops = 0; w && hops < 10; hops++) {
      try {
        const api = (w as Window & { API?: Scorm12Api }).API;
        if (api && typeof api.LMSInitialize === 'function') return api;
        if (w.parent === w) break;
        w = w.parent;
      } catch {
        break; // a cross-origin frame: stop looking up this chain
      }
    }
    return null;
  };
  try {
    return look(win) ?? look(win.opener as Window | null);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- controller */

export interface TrackerDeps {
  doc: Document;
  win: Window;
  data: CfData;
  prefs: { get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void };
  announce(msg: string): void;
  /** Injected for tests; defaults to the browser's fetch. */
  send?: (url: string, body: string) => Promise<unknown>;
  now?: () => Date;
}

export interface Tracker {
  /** Called whenever progress, answers or the current screen change. */
  update(state: { complete: boolean; summary: GradedSummary; currentId: string }): void;
  /** Called after the learner resets progress or retakes the assessment: a new result may be recorded. */
  reset(): void;
}

export function createTracker(deps: TrackerDeps): Tracker | null {
  const t = deps.data.tracking;
  if (!t) return null;
  return t.destination === 'lms' ? lmsTracker(deps, t) : webTracker(deps, t);
}

function panel(doc: Document) {
  const root = doc.querySelector<HTMLElement>('[data-cf-record]');
  const status = root?.querySelector<HTMLElement>('[data-cf-record-status]') ?? null;
  const setStatus = (state: 'idle' | 'sending' | 'sent' | 'error', msg: string) => {
    root?.setAttribute('data-cf-record-state', state);
    if (status) status.textContent = msg;
  };
  return { root, setStatus };
}

function webTracker(deps: TrackerDeps, t: CfTracking): Tracker | null {
  // No address means untracked: never post to the course's own URL.
  const endpoint = t.endpoint;
  if (!endpoint) return null;
  const { doc, data, prefs } = deps;
  const { root, setStatus } = panel(doc);
  const key = `cf:track:${data.courseId}:${data.version}`;
  const send =
    deps.send ??
    ((url: string, body: string) =>
      deps.win.fetch(url, {
        method: 'POST',
        // A simple request: no CORS preflight, which Google Apps Script cannot answer.
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        keepalive: true,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      }));
  const button = root?.querySelector<HTMLButtonElement>('[data-cf-record-send]') ?? null;
  const fields = root?.querySelector<HTMLElement>('[data-cf-record-fields]') ?? null;
  const input = (k: string) => root?.querySelector<HTMLInputElement>(`[data-cf-record-field="${k}"]`) ?? null;
  let last: { complete: boolean; summary: GradedSummary; currentId: string } | null = null;
  let busy = false;

  const recorded = () => prefs.get(`${key}:sent`) === '1';
  const showRecorded = () => {
    if (fields) fields.hidden = true;
    if (button) button.hidden = true;
    setStatus('sent', 'Your result has been recorded. You can close this page.');
  };
  const showForm = () => {
    if (fields) fields.hidden = false;
    if (button) {
      button.hidden = false;
      button.disabled = false;
    }
  };

  const deliver = async (body: string, fromUser: boolean) => {
    busy = true;
    if (button) button.disabled = true;
    if (fromUser) setStatus('sending', 'Sending your result…');
    try {
      // An opaque (no-cors) response means the request left the browser; there is nothing more to read.
      await send(endpoint, body);
      prefs.remove(`${key}:pending`);
      prefs.set(`${key}:sent`, '1');
      showRecorded();
      if (fromUser) deps.announce('Your result has been recorded.');
    } catch {
      prefs.set(`${key}:pending`, body);
      showForm();
      setStatus('error', 'Your result could not be sent. Check your internet connection, then press the button again.');
      if (fromUser) deps.announce('Your result could not be sent.');
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  };

  button?.addEventListener('click', () => {
    if (busy || !last?.complete) return;
    const learner: Learner = { name: input('name')?.value ?? '', id: input('id')?.value ?? null, email: input('email')?.value ?? null };
    for (const el of root?.querySelectorAll('[data-cf-record-field]') ?? []) el.removeAttribute('aria-invalid');
    const problem = learnerProblem(t.identity, learner);
    if (problem) {
      const el = input(problem.field);
      el?.setAttribute('aria-invalid', 'true');
      // The staff-number box carries the author's own label (e.g. "Payroll ID").
      const label = problem.field === 'id' ? root?.querySelector('label[for="cf-record-id"]')?.textContent?.trim() : '';
      setStatus('error', label ? `Please enter your ${label}.` : problem.message);
      el?.focus();
      return;
    }
    const attempt = (Number(prefs.get(`${key}:attempt`)) || 0) + 1;
    prefs.set(`${key}:attempt`, String(attempt));
    void deliver(JSON.stringify(buildEvent(data, t, learner, last.summary, attempt, (deps.now ?? (() => new Date()))())), true);
  });

  // A result that could not be sent last time is retried quietly when the course is opened again.
  const pending = prefs.get(`${key}:pending`);
  if (pending) void deliver(pending, false);
  else if (recorded()) showRecorded();

  return {
    update(state) {
      last = state;
      if (root) root.hidden = !(state.complete && state.currentId === t.recordScreen);
    },
    reset() {
      prefs.remove(`${key}:sent`);
      if (!prefs.get(`${key}:pending`)) {
        showForm();
        setStatus('idle', '');
      }
    },
  };
}

function lmsTracker(deps: TrackerDeps, t: CfTracking): Tracker {
  const { root, setStatus } = panel(deps.doc);
  const api = findScormApi(deps.win);
  let reported = '';
  let finished = false;
  if (api) {
    try {
      api.LMSInitialize('');
      const status = api.LMSGetValue('cmi.core.lesson_status');
      if (!status || status === 'not attempted') {
        api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        api.LMSCommit('');
      }
    } catch {
      /* a broken LMS API must never break the course */
    }
    deps.win.addEventListener('pagehide', () => {
      if (finished) return;
      finished = true;
      try {
        api.LMSFinish('');
      } catch {
        /* ignore */
      }
    });
  }
  return {
    update(state) {
      const onRecordScreen = state.complete && state.currentId === t.recordScreen;
      if (root) root.hidden = !onRecordScreen;
      if (!state.complete) return;
      const s = state.summary;
      const status = s.total ? (s.passed ? 'passed' : 'failed') : 'completed';
      const signature = `${status}:${s.percent ?? ''}`;
      if (!api) {
        setStatus('error', 'Your training system could not be reached, so this result was not reported. Ask your course administrator.');
        return;
      }
      if (signature === reported) return;
      try {
        if (s.total && s.percent !== null) {
          api.LMSSetValue('cmi.core.score.min', '0');
          api.LMSSetValue('cmi.core.score.max', '100');
          api.LMSSetValue('cmi.core.score.raw', String(s.percent));
        }
        api.LMSSetValue('cmi.core.lesson_status', status);
        api.LMSCommit('');
        reported = signature;
        setStatus('sent', 'Your result has been sent to your training system.');
      } catch {
        setStatus('error', 'Your training system did not accept the result. Ask your course administrator.');
      }
    },
    reset() {
      reported = '';
    },
  };
}
