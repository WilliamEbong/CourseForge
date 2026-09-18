/** Hydrates one `form.cf-question`: response reading, grading, pre-rendered feedback, retry, sequencing moves. */
import { grade } from './grade.js';
import type { CfAnswer, CfItem, CfResponse } from './types.js';

export interface QuestionHooks {
  onAnswer(id: string, correct: boolean, response: CfResponse): void;
  announce(message: string): void;
}

export interface QuestionController {
  id: string;
  graded: boolean;
  reset(): void;
}

const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const qa = <T extends Element>(root: ParentNode, sel: string) => [...root.querySelectorAll<T>(sel)];

export function readResponse(form: HTMLFormElement, mode: CfItem['mode']): CfResponse {
  switch (mode) {
    case 'single':
    case 'multiple':
      return { keys: qa<HTMLInputElement>(form, 'input.cf-choice-input:checked').map((i) => i.value) };
    case 'matching':
    case 'categorization':
      return {
        mapping: Object.fromEntries(qa<HTMLSelectElement>(form, 'select[data-cf-key]').map((s) => [s.dataset.cfKey ?? '', s.value])),
      };
    case 'sequencing':
      return { order: qa<HTMLLIElement>(form, '[data-cf-sequence] > li[data-cf-key]').map((li) => li.dataset.cfKey ?? '') };
    case 'reveal':
      return {};
  }
}

function applyResponse(form: HTMLFormElement, response: CfResponse): void {
  for (const input of qa<HTMLInputElement>(form, 'input.cf-choice-input')) input.checked = Boolean(response.keys?.includes(input.value));
  for (const sel of qa<HTMLSelectElement>(form, 'select[data-cf-key]')) sel.value = response.mapping?.[sel.dataset.cfKey ?? ''] ?? '';
  const list = q<HTMLOListElement>(form, '[data-cf-sequence]');
  if (list && response.order) {
    for (const key of response.order) {
      const li = qa<HTMLLIElement>(list, ':scope > li[data-cf-key]').find((x) => x.dataset.cfKey === key);
      if (li) list.append(li);
    }
  }
}

function syncMoveButtons(list: HTMLOListElement): void {
  const items = qa<HTMLLIElement>(list, ':scope > li');
  items.forEach((li, i) => {
    const up = q<HTMLButtonElement>(li, '[data-cf-move="up"]');
    const down = q<HTMLButtonElement>(li, '[data-cf-move="down"]');
    if (up) up.disabled = i === 0 || list.dataset.cfLocked === 'true';
    if (down) down.disabled = i === items.length - 1 || list.dataset.cfLocked === 'true';
  });
}

export function hydrateQuestion(
  form: HTMLFormElement,
  id: string,
  item: CfItem,
  hooks: QuestionHooks,
  saved?: CfAnswer,
): QuestionController {
  const fb = q<HTMLElement>(form, '[data-cf-feedback]')!;
  const submit = q<HTMLButtonElement>(form, '[data-cf-submit]');
  const retry = q<HTMLButtonElement>(form, '[data-cf-retry]');
  const reveal = q<HTMLButtonElement>(form, '[data-cf-reveal]');
  const list = q<HTMLOListElement>(form, '[data-cf-sequence]');
  const initialOrder = list ? qa<HTMLLIElement>(list, ':scope > li').map((li) => li.dataset.cfKey ?? '') : [];
  let attempts = saved?.attempts ?? 0;

  const part = (name: string) => q<HTMLElement>(fb, `[data-cf-fb="${name}"]`);
  const hideAll = () => {
    for (const el of qa<HTMLElement>(fb, '[data-cf-fb], [data-cf-fb-option]')) el.hidden = true;
  };
  const setLocked = (locked: boolean) => {
    for (const el of qa<HTMLInputElement | HTMLSelectElement>(form, 'input, select')) el.disabled = locked;
    if (list) {
      list.dataset.cfLocked = String(locked);
      syncMoveButtons(list);
    }
    form.toggleAttribute('data-cf-locked', locked);
  };
  const clearMarks = () => {
    for (const el of qa<HTMLElement>(form, '[data-cf-state]')) el.removeAttribute('data-cf-state');
  };

  const mark = (response: CfResponse) => {
    if (item.graded) return;
    if (item.mode === 'single' || item.mode === 'multiple') {
      for (const key of response.keys ?? []) {
        q<HTMLElement>(form, `[data-cf-option="${CSS.escape(key)}"]`)?.setAttribute(
          'data-cf-state',
          item.correctKeys.includes(key) ? 'correct' : 'incorrect',
        );
      }
    } else if (item.mode === 'matching' || item.mode === 'categorization') {
      for (const [key, target] of Object.entries(response.mapping ?? {})) {
        q<HTMLElement>(form, `.cf-match-row[data-cf-option="${CSS.escape(key)}"]`)?.setAttribute(
          'data-cf-state',
          item.mapping[key] === target ? 'correct' : 'incorrect',
        );
      }
    } else if (item.mode === 'sequencing' && list) {
      qa<HTMLLIElement>(list, ':scope > li').forEach((li, i) => {
        li.setAttribute('data-cf-state', li.dataset.cfKey === item.order[i] ? 'correct' : 'incorrect');
      });
    }
  };

  const showResult = (correct: boolean, response: CfResponse) => {
    hideAll();
    fb.setAttribute('data-cf-result', correct ? 'correct' : 'incorrect');
    if (item.graded) {
      part('recorded')!.hidden = false;
    } else {
      const main = part(correct ? 'correct' : 'incorrect');
      if (main) main.hidden = false;
      const options = part('options');
      const picked = (response.keys ?? []).filter((k) => q(fb, `[data-cf-fb-option="${CSS.escape(k)}"]`));
      if (options && picked.length) {
        options.hidden = false;
        for (const k of picked) q<HTMLElement>(fb, `[data-cf-fb-option="${CSS.escape(k)}"]`)!.hidden = false;
      }
      const rationale = part('rationale');
      if (rationale && correct) rationale.hidden = false;
    }
    mark(response);
    setLocked(true);
    if (submit) submit.hidden = true;
    if (retry && !item.graded) {
      retry.hidden = false;
      const label = retry.querySelector('span');
      if (label) label.textContent = correct ? 'Answer again' : 'Try again';
    }
  };

  const reset = () => {
    hideAll();
    fb.removeAttribute('data-cf-result');
    clearMarks();
    applyResponse(form, { keys: [], mapping: {}, order: initialOrder });
    setLocked(false);
    if (submit) submit.hidden = false;
    if (retry) retry.hidden = true;
    if (reveal) reveal.setAttribute('aria-expanded', 'false');
    attempts = 0;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.hasAttribute('data-cf-locked') || item.mode === 'reveal') return;
    const response = readResponse(form, item.mode);
    const result = grade(item, response);
    if (!result.complete) {
      hideAll();
      part('incomplete')!.hidden = false;
      return;
    }
    attempts++;
    showResult(result.correct, response);
    hooks.onAnswer(id, result.correct, response);
    if (item.graded) {
      fb.tabIndex = -1;
      fb.focus();
    } else {
      retry?.focus();
    }
  });

  retry?.addEventListener('click', () => {
    const keepAttempts = attempts;
    reset();
    attempts = keepAttempts;
    q<HTMLElement>(form, 'input, select, [data-cf-move]:not([disabled])')?.focus();
  });

  reveal?.addEventListener('click', () => {
    const open = reveal.getAttribute('aria-expanded') !== 'true';
    reveal.setAttribute('aria-expanded', String(open));
    hideAll();
    if (open) {
      part('correct')!.hidden = false;
      const rationale = part('rationale');
      if (rationale) rationale.hidden = false;
      fb.setAttribute('data-cf-result', 'correct');
      if (attempts === 0) {
        attempts = 1;
        hooks.onAnswer(id, true, {});
      }
    }
  });

  list?.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-cf-move]');
    if (!btn || btn.disabled) return;
    const li = btn.closest('li')!;
    const up = btn.dataset.cfMove === 'up';
    const sibling = up ? li.previousElementSibling : li.nextElementSibling;
    if (!sibling) return;
    if (up) sibling.before(li);
    else sibling.after(li);
    clearMarks();
    syncMoveButtons(list);
    const items = qa<HTMLLIElement>(list, ':scope > li');
    const pos = items.indexOf(li) + 1;
    (btn.disabled ? q<HTMLButtonElement>(li, `[data-cf-move="${up ? 'down' : 'up'}"]`) : btn)?.focus();
    hooks.announce(`${li.querySelector('.cf-seq-text')?.textContent ?? 'Item'} moved to position ${pos} of ${items.length}.`);
  });
  if (list) syncMoveButtons(list);

  if (saved) {
    if (item.mode === 'reveal') {
      attempts = saved.attempts;
    } else {
      applyResponse(form, saved.response);
      showResult(saved.correct, saved.response);
    }
  }

  return { id, graded: item.graded, reset };
}
