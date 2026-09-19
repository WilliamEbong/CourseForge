/**
 * Learner runtime: hash router (`#/s/<id>`, works on file://), persistence, progress, dialogs, scoring,
 * results and the `window.__cf` QA contract. Hydrates the pre-rendered DOM; never injects authored HTML.
 */
import { closeAll, closeDialog, confirmDialog, openDialog, wireDialogs } from './dialogs.js';
import { summarize } from './grade.js';
import { hydrateQuestion, type QuestionController } from './question.js';
import { createStore } from './store.js';
import { createTracker } from './track.js';
import type { CfData } from './types.js';

export interface CfApi {
  version: 1;
  courseId: string;
  screenCount(): number;
  screenIds(): string[];
  current(): { index: number; id: string };
  go(target: number | string): boolean;
  next(): boolean;
  prev(): boolean;
  getState(): {
    index: number;
    visited: string[];
    answers: Record<string, { correct: boolean; attempts: number }>;
    graded: ReturnType<typeof summarize>;
    progressPercent: number;
  };
  reset(): void;
  resetAssessment(): void;
}

declare global {
  interface Window {
    __cf?: CfApi;
  }
}

const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

/** `signal` removes the document/window listeners (used when Storybook re-renders a story). */
export function boot(doc: Document = document, opts: { signal?: AbortSignal } = {}): CfApi | null {
  const on = opts.signal ? { signal: opts.signal } : {};
  const dataEl = doc.getElementById('cf-data');
  if (!dataEl?.textContent) return null;
  const data = JSON.parse(dataEl.textContent) as CfData;
  const root = doc.documentElement;
  root.classList.add('cf-js');

  const screens = [...doc.querySelectorAll<HTMLElement>('[data-cf-screen]')];
  const ids = screens.map((s) => s.dataset.cfScreen ?? '');
  const gradedIds = data.screens.filter((s) => s.graded).map((s) => s.id);
  const requiredIds = data.screens.filter((s) => !s.optional).map((s) => s.id);
  const store = createStore(data.storageKey, data.version);
  const $ = <T extends Element>(sel: string) => doc.querySelector<T>(sel);
  const $$ = <T extends Element>(sel: string) => [...doc.querySelectorAll<T>(sel)];

  const announcer = $<HTMLElement>('[data-cf-announcer]');
  const toastEl = $<HTMLElement>('[data-cf-toast]');
  let toastTimer = 0;
  const announce = (msg: string) => {
    if (!announcer) return;
    announcer.textContent = '';
    window.setTimeout(() => {
      announcer.textContent = msg;
    }, 30);
  };
  const toast = (msg: string) => {
    announce(msg);
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 3500);
  };

  /* ---------------------------------------------------------------- questions */
  const controllers: QuestionController[] = [];
  const hooks = {
    announce,
    onAnswer(id: string, correct: boolean, response: object) {
      const prev = store.state.answers[id];
      store.state.answers[id] = { correct, attempts: (prev?.attempts ?? 0) + 1, response };
      store.save();
      renderResults();
    },
  };
  for (const form of $$<HTMLFormElement>('form.cf-question')) {
    const id = form.dataset.cfItem ?? '';
    const item = data.items[id];
    if (item) controllers.push(hydrateQuestion(form, id, item, hooks, store.state.answers[id]));
  }

  /* ---------------------------------------------------------------- progress + nav */
  const progress = $<HTMLElement>('[data-cf-progress]');
  const progressBar = $<HTMLElement>('[data-cf-progress-bar]');
  const progressLabel = $<HTMLElement>('[data-cf-progress-label]');
  const progressPercent = () => {
    if (!requiredIds.length) return 100;
    const visited = new Set(store.state.visited);
    return Math.round((requiredIds.filter((id) => visited.has(id)).length / requiredIds.length) * 100);
  };
  const renderProgress = () => {
    const pct = progressPercent();
    progress?.setAttribute('aria-valuenow', String(pct));
    progress?.setAttribute('aria-valuetext', `${pct}% complete`);
    if (progressBar) progressBar.style.transform = `scaleX(${pct / 100})`;
    if (progressLabel) progressLabel.textContent = `${pct}%`;
    const visited = new Set(store.state.visited);
    for (const link of $$<HTMLAnchorElement>('[data-cf-nav-list] a[data-cf-goto]')) {
      const id = link.dataset.cfGoto ?? '';
      const seen = visited.has(id);
      link.toggleAttribute('data-cf-visited', seen);
      const sr = link.querySelector('[data-cf-nav-sr]');
      if (sr) sr.textContent = seen ? ' (visited)' : '';
    }
    for (const mod of $$<HTMLElement>('[data-cf-nav-module]')) {
      const modId = mod.dataset.cfNavModule;
      const required = data.screens.filter((s) => s.moduleId === modId && !s.optional);
      const done = required.filter((s) => visited.has(s.id)).length;
      const count = mod.querySelector<HTMLElement>('[data-cf-module-count]');
      if (count) count.textContent = `${done}/${required.length}`;
      mod.toggleAttribute('data-cf-complete', required.length > 0 && done === required.length);
    }
  };

  /* ---------------------------------------------------------------- results */
  const tracker = createTracker({ doc, win: doc.defaultView ?? window, data, prefs: store.prefs, announce });
  const renderResults = () => {
    const summary = summarize(gradedIds, store.state.answers, data.passingPercent);
    // Complete = every graded question answered, or (no graded questions) every required screen visited.
    tracker?.update({
      complete: gradedIds.length ? summary.percent !== null : progressPercent() === 100,
      summary,
      currentId: ids[current] ?? '',
    });
    for (const el of $$<HTMLElement>('[data-cf-results]')) {
      const done = summary.percent !== null;
      if (done) {
        el.setAttribute('data-cf-score', String(summary.percent));
        el.setAttribute('data-cf-passed', String(summary.passed));
      } else {
        el.removeAttribute('data-cf-score');
        el.removeAttribute('data-cf-passed');
      }
      const pending = el.querySelector<HTMLElement>('[data-cf-results-pending]');
      const sum = el.querySelector<HTMLElement>('[data-cf-results-summary]');
      const review = el.querySelector<HTMLElement>('[data-cf-results-review]');
      if (pending) pending.hidden = done;
      if (sum) sum.hidden = !done;
      if (review) review.hidden = !done;
      const set = (sel: string, text: string) => {
        const t = el.querySelector(sel);
        if (t) t.textContent = text;
      };
      set('[data-cf-results-answered]', String(summary.answered));
      for (const li of el.querySelectorAll<HTMLElement>('[data-cf-pending]'))
        li.hidden = Boolean(store.state.answers[li.dataset.cfPending ?? '']);
      if (!done) continue;
      set('[data-cf-results-percent]', String(summary.percent));
      set('[data-cf-results-correct]', String(summary.correct));
      set('[data-cf-results-verdict]', summary.passed ? 'Passed' : 'Not yet passed');
      el.querySelector<HTMLElement>('[data-cf-score-ring]')?.style.setProperty('--cf-score', String((summary.percent ?? 0) / 100));
      for (const li of el.querySelectorAll<HTMLElement>('[data-cf-review-item]')) {
        const ok = store.state.answers[li.dataset.cfReviewItem ?? '']?.correct === true;
        li.setAttribute('data-cf-state', ok ? 'correct' : 'incorrect');
        const status = li.querySelector('[data-cf-review-status]');
        if (status) status.textContent = ok ? 'Correct' : 'Incorrect';
      }
    }
  };

  /* ---------------------------------------------------------------- routing */
  let current = -1;
  const prevBtn = $<HTMLButtonElement>('[data-cf-nav="prev"]');
  const nextBtn = $<HTMLButtonElement>('[data-cf-nav="next"]');
  const position = $<HTMLElement>('[data-cf-position]');
  const moduleLabel = $<HTMLElement>('[data-cf-current-module]');
  const resolve = (target: number | string) => (typeof target === 'number' ? target : ids.indexOf(target));

  const show = (index: number, opts: { focus: boolean; updateHash: 'push' | 'replace' | false }) => {
    if (index < 0 || index >= screens.length) return false;
    const screen = screens[index]!;
    const id = ids[index]!;
    if (index !== current) {
      if (current >= 0) screens[current]!.hidden = true;
      screen.hidden = false;
      current = index;
    }
    store.state.index = index;
    if (!store.state.visited.includes(id)) store.state.visited.push(id);
    store.save();
    if (opts.updateHash && location.hash !== `#/s/${id}`) {
      try {
        if (opts.updateHash === 'push') history.pushState(null, '', `#/s/${id}`);
        else history.replaceState(null, '', `#/s/${id}`);
      } catch {
        location.hash = `#/s/${id}`;
      }
    }
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === screens.length - 1;
    if (position) position.textContent = `${index + 1} of ${screens.length}`;
    for (const link of $$<HTMLAnchorElement>('[data-cf-nav-list] a[data-cf-goto]')) {
      if (link.dataset.cfGoto === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const modTitle = screen.querySelector('.cf-eyebrow-module')?.textContent ?? '';
    if (moduleLabel) moduleLabel.textContent = modTitle.replace(/^Module \d+ · /, '');
    renderProgress();
    renderResults();
    if (opts.focus) {
      window.scrollTo({ top: 0 });
      screen.querySelector<HTMLElement>('.cf-screen-title')?.focus({ preventScroll: true });
      announce(`Screen ${index + 1} of ${screens.length}`);
    }
    return true;
  };
  const go = (target: number | string) => show(resolve(target), { focus: true, updateHash: 'push' });

  const fromHash = () => {
    const m = /^#\/s\/(.+)$/.exec(location.hash);
    return m ? ids.indexOf(decodeURIComponent(m[1]!)) : -1;
  };
  const onHash = () => {
    const idx = fromHash();
    if (idx >= 0 && idx !== current) show(idx, { focus: true, updateHash: false });
  };
  window.addEventListener('hashchange', onHash, on);
  window.addEventListener('popstate', onHash, on);

  /* ---------------------------------------------------------------- dialogs */
  wireDialogs(doc);
  const navDialog = $<HTMLDialogElement>('#cf-nav-dialog');
  const nav = $<HTMLElement>('[data-cf-nav-list]');
  const navHome = $<HTMLElement>('[data-cf-nav-home]');
  const navSlot = $<HTMLElement>('[data-cf-nav-slot]');
  const menuToggle = $<HTMLButtonElement>('[data-cf-menu-toggle]');
  navDialog?.addEventListener('close', () => {
    if (nav && navHome) navHome.append(nav);
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
  const wide = window.matchMedia('(min-width: 1024px)');
  wide.addEventListener(
    'change',
    () => {
      if (wide.matches && navDialog?.open) closeDialog(navDialog, false);
    },
    on,
  );

  const filter = (input: HTMLInputElement) => {
    const dialog = input.closest('dialog');
    if (!dialog) return;
    const term = input.value.trim().toLowerCase();
    let shown = 0;
    for (const el of dialog.querySelectorAll<HTMLElement>('[data-cf-search]')) {
      const match = !term || (el.dataset.cfSearch ?? '').includes(term);
      el.hidden = !match;
      if (match) shown++;
    }
    const empty = dialog.querySelector<HTMLElement>('[data-cf-empty]');
    if (empty) empty.hidden = shown > 0;
    const status = dialog.querySelector('[data-cf-filter-status]');
    if (status) status.textContent = term ? `${shown} ${shown === 1 ? 'match' : 'matches'}` : '';
  };
  const openResource = (name: string, opener: HTMLElement | null) => {
    const dialog = $<HTMLDialogElement>(`#cf-${name}`);
    if (!dialog) return null;
    const input = dialog.querySelector<HTMLInputElement>('[data-cf-filter]');
    if (input?.value) {
      input.value = '';
      filter(input);
    }
    openDialog(dialog, opener);
    return dialog;
  };
  for (const input of $$<HTMLInputElement>('[data-cf-filter]')) input.addEventListener('input', () => filter(input));

  const openSource = (chip: HTMLElement) => {
    const dialog = $<HTMLDialogElement>('#cf-source');
    const ref = $<HTMLElement>(`[data-cf-ref="${CSS.escape(chip.dataset.cfCite ?? '')}"] .cf-ref-body`);
    const body = dialog?.querySelector<HTMLElement>('[data-cf-source-body]');
    if (!dialog || !body) return;
    body.replaceChildren(ref ? ref.cloneNode(true) : doc.createTextNode(chip.dataset.cfCite ?? ''));
    const locator = chip.dataset.cfLocator ?? '';
    const locEl = dialog.querySelector<HTMLElement>('[data-cf-source-locator]');
    const locText = dialog.querySelector('[data-cf-source-locator-text]');
    if (locEl) locEl.hidden = !locator;
    if (locText) locText.textContent = locator;
    openDialog(dialog, chip);
  };

  /* ---------------------------------------------------------------- reset */
  const confirmEl = $<HTMLDialogElement>('#cf-confirm');
  const doReset = () => {
    store.reset();
    tracker?.reset();
    for (const c of controllers) c.reset();
    current = -1;
    for (const s of screens) s.hidden = true;
    show(0, { focus: false, updateHash: 'replace' });
  };
  const doResetAssessment = () => {
    for (const id of gradedIds) delete store.state.answers[id];
    store.save();
    tracker?.reset();
    for (const c of controllers) if (c.graded) c.reset();
    renderResults();
  };

  /* ---------------------------------------------------------------- theme */
  const themeBtn = $<HTMLButtonElement>('[data-cf-theme-toggle]');
  const applyTheme = (t: Theme) => {
    if (t === 'system') root.removeAttribute('data-cf-theme');
    else root.setAttribute('data-cf-theme', t);
    themeBtn?.setAttribute('aria-label', `Colour theme: ${t === 'system' ? 'match device' : t}. Change theme`);
  };
  let theme: Theme = (THEMES as readonly string[]).includes(store.prefs.get('cf:theme') ?? '')
    ? (store.prefs.get('cf:theme') as Theme)
    : 'system';
  applyTheme(theme);

  /* ---------------------------------------------------------------- events */
  doc.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const goto = t.closest<HTMLAnchorElement>('a[data-cf-goto]');
      if (goto) {
        e.preventDefault();
        closeAll(doc, false);
        go(goto.dataset.cfGoto ?? '');
        return;
      }
      const navBtn = t.closest<HTMLButtonElement>('[data-cf-nav]');
      if (navBtn) {
        go(current + (navBtn.dataset.cfNav === 'next' ? 1 : -1));
        return;
      }
      if (t.closest('[data-cf-menu-toggle]') && navDialog && nav && navSlot) {
        navSlot.append(nav);
        menuToggle?.setAttribute('aria-expanded', 'true');
        openDialog(navDialog, menuToggle);
        nav.querySelector<HTMLElement>('[aria-current]')?.focus();
        return;
      }
      const opener = t.closest<HTMLElement>('[data-cf-open]');
      if (opener) {
        const inDialog = opener.closest('dialog');
        if (inDialog) closeDialog(inDialog, false);
        openResource(opener.dataset.cfOpen ?? '', inDialog ? null : opener);
        return;
      }
      const cite = t.closest<HTMLElement>('[data-cf-cite]');
      if (cite) {
        openSource(cite);
        return;
      }
      const term = t.closest<HTMLElement>('[data-cf-term-link]');
      if (term) {
        const dialog = openResource('glossary', term);
        const entry = dialog?.querySelector<HTMLElement>(`[data-cf-term="${CSS.escape(term.dataset.cfTermLink ?? '')}"]`);
        if (entry) {
          for (const el of dialog!.querySelectorAll('[data-cf-highlight]')) el.removeAttribute('data-cf-highlight');
          entry.setAttribute('data-cf-highlight', '');
          entry.tabIndex = -1;
          entry.focus();
          entry.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      const action = t.closest<HTMLElement>('[data-cf-action]');
      if (action && confirmEl) {
        const course = action.dataset.cfAction === 'reset-course';
        void confirmDialog(
          confirmEl,
          course ? 'Reset course progress?' : 'Retake the assessment?',
          course
            ? 'This clears every screen you have visited and every answer you have given. It cannot be undone.'
            : 'This clears your assessment answers so you can attempt every question again.',
          course ? 'Reset progress' : 'Retake',
        ).then((yes) => {
          if (!yes) return;
          if (course) {
            doReset();
            toast('Course progress reset.');
            screens[0]?.querySelector<HTMLElement>('.cf-screen-title')?.focus();
          } else {
            doResetAssessment();
            const first = gradedIds[0];
            if (first) go(first);
            toast('Assessment answers cleared.');
          }
        });
        return;
      }
      if (t.closest('[data-cf-theme-toggle]')) {
        theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
        applyTheme(theme);
        store.prefs.set('cf:theme', theme);
        toast(theme === 'system' ? 'Theme follows your device.' : `${theme === 'dark' ? 'Dark' : 'Light'} theme on.`);
        return;
      }
      if (t.closest('[data-cf-skip]')) {
        e.preventDefault();
        screens[current]?.querySelector<HTMLElement>('.cf-screen-title')?.focus();
      }
    },
    on,
  );

  doc.addEventListener(
    'keydown',
    (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const t = e.target as Element | null;
      if (doc.querySelector('dialog[open]')) return;
      if (t?.closest('input, select, textarea, [contenteditable], form, dialog, details, [role="region"]')) return;
      e.preventDefault();
      go(current + (e.key === 'ArrowRight' ? 1 : -1));
    },
    on,
  );

  /* ---------------------------------------------------------------- start */
  const hashIdx = fromHash();
  const saved = store.state.index;
  const start = hashIdx >= 0 ? hashIdx : saved >= 0 && saved < screens.length ? saved : 0;
  for (const s of screens) s.hidden = true;
  show(start, { focus: false, updateHash: hashIdx < 0 ? 'replace' : false });

  const api: CfApi = {
    version: 1,
    courseId: data.courseId,
    screenCount: () => screens.length,
    screenIds: () => [...ids],
    current: () => ({ index: current, id: ids[current] ?? '' }),
    go,
    next: () => go(current + 1),
    prev: () => go(current - 1),
    getState: () => ({
      index: current,
      visited: [...store.state.visited],
      answers: Object.fromEntries(Object.entries(store.state.answers).map(([k, v]) => [k, { correct: v.correct, attempts: v.attempts }])),
      graded: summarize(gradedIds, store.state.answers, data.passingPercent),
      progressPercent: progressPercent(),
    }),
    reset: doReset,
    resetAssessment: doResetAssessment,
  };
  window.__cf = api;
  return api;
}
