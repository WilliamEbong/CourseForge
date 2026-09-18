/**
 * Question component: single, multiple, matching, categorization, sequencing (keyboard move buttons are the
 * primary control) and reveal. Feedback is pre-rendered (sanitised at build time) and only toggled by the runtime.
 */
import type { Interaction } from '../../../../src/core/schemas/content.js';
import { attrs, type CfComponent, esc, icon, md } from '../contract.js';

export interface QuestionProps {
  id: string;
  interaction: Interaction;
  graded: boolean;
  /** Visible label above the stem, e.g. "Knowledge check" or "Question 2 of 3". */
  label?: string;
  /** Seed for the deterministic initial order of sequencing items (defaults to the id). */
  seed?: string;
}

/** Safe fragment for id attributes. */
export const domId = (...parts: string[]) => parts.map((p) => p.replace(/[^A-Za-z0-9_-]/g, '-')).join('-');

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic shuffle that never returns the correct order (when more than one item). */
export function initialOrder(keys: readonly string[], seed: string): string[] {
  const out = [...keys].sort((a, b) => hash32(`${seed}:${a}`) - hash32(`${seed}:${b}`) || a.localeCompare(b));
  if (out.length > 1 && out.every((k, i) => k === keys[i])) out.push(out.shift()!);
  return out;
}

const HINTS: Record<Interaction['mode'], string> = {
  single: 'Select one answer.',
  multiple: 'Select all that apply.',
  matching: 'Choose the best match for each item.',
  categorization: 'Assign each item to a category.',
  sequencing: 'Put the steps in order using the Move up and Move down buttons.',
  reveal: 'Decide on your answer, then reveal the expert response.',
};

function choices(p: QuestionProps, base: string): string {
  const type = p.interaction.mode === 'single' ? 'radio' : 'checkbox';
  return `<div class="cf-choices">${p.interaction.options
    .map((o) => {
      const id = domId(base, o.key);
      return `<label class="cf-choice" for="${id}" data-cf-option="${esc(o.key)}"><input class="cf-choice-input" type="${type}" id="${id}" name="${esc(p.id)}" value="${esc(o.key)}"><span class="cf-choice-mark" aria-hidden="true">${icon('check')}</span><span class="cf-choice-text">${md(o.text, { inline: true })}</span></label>`;
    })
    .join('')}</div>`;
}

function selects(p: QuestionProps, base: string): string {
  const cat = p.interaction.mode === 'categorization';
  const placeholder = cat ? 'Choose a category…' : 'Choose a match…';
  const opts = `<option value="">${placeholder}</option>${p.interaction.targets.map((t) => `<option value="${esc(t.key)}">${esc(t.text)}</option>`).join('')}`;
  const legend = cat
    ? `<ul class="cf-categories" aria-label="Categories">${p.interaction.targets.map((t) => `<li>${esc(t.text)}</li>`).join('')}</ul>`
    : '';
  return `${legend}<div class="cf-match-list">${p.interaction.options
    .map((o) => {
      const id = domId(base, o.key);
      return `<div class="cf-match-row" data-cf-option="${esc(o.key)}"><label class="cf-match-prompt" for="${id}">${md(o.text, { inline: true })}</label><div class="cf-select-wrap"><select class="cf-select" id="${id}" data-cf-key="${esc(o.key)}">${opts}</select>${icon('chevron-right', 'cf-select-chevron')}</div></div>`;
    })
    .join('')}</div>`;
}

function sequence(p: QuestionProps, base: string): string {
  const byKey = new Map(p.interaction.options.map((o) => [o.key, o]));
  const keys = p.interaction.order.length ? p.interaction.order : p.interaction.options.map((o) => o.key);
  const order = initialOrder(keys, p.seed ?? p.id);
  return `<ol class="cf-sequence" data-cf-sequence aria-describedby="${domId(base, 'hint')}">${order
    .map((k) => {
      const tid = domId(base, k, 'text');
      return `<li class="cf-seq-item" data-cf-key="${esc(k)}"><span class="cf-seq-text" id="${tid}">${md(byKey.get(k)?.text ?? k, { inline: true })}</span><span class="cf-seq-controls"><button type="button" class="cf-icon-btn cf-icon-btn--sm" data-cf-move="up" aria-label="Move up" aria-describedby="${tid}">${icon('arrow-up')}</button><button type="button" class="cf-icon-btn cf-icon-btn--sm" data-cf-move="down" aria-label="Move down" aria-describedby="${tid}">${icon('arrow-down')}</button></span></li>`;
    })
    .join('')}</ol>`;
}

function feedback(p: QuestionProps, base: string): string {
  const i = p.interaction;
  const parts: string[] = [];
  if (p.graded) {
    parts.push(
      `<div class="cf-fb cf-fb--neutral" data-cf-fb="recorded" hidden><p class="cf-fb-title">${icon('check')}Answer recorded</p><p>You will see your result and the explanation for each question on the results screen.</p></div>`,
    );
  } else if (i.mode === 'reveal') {
    parts.push(
      `<div class="cf-fb cf-fb--reveal" data-cf-fb="correct" hidden><p class="cf-fb-title">${icon('lightbulb')}Expert response</p>${md(i.feedbackCorrect)}</div>`,
    );
  } else {
    parts.push(
      `<div class="cf-fb cf-fb--correct" data-cf-fb="correct" hidden><p class="cf-fb-title">${icon('circle-check')}Correct</p>${md(i.feedbackCorrect)}</div>`,
      `<div class="cf-fb cf-fb--incorrect" data-cf-fb="incorrect" hidden><p class="cf-fb-title">${icon('circle-x')}Not quite</p>${md(i.feedbackIncorrect)}</div>`,
    );
    if (i.optionFeedback.length) {
      const text = new Map(i.options.map((o) => [o.key, o.text]));
      parts.push(
        `<ul class="cf-fb-options" data-cf-fb="options" hidden>${i.optionFeedback
          .map(
            (f) =>
              `<li data-cf-fb-option="${esc(f.key)}" hidden><strong>${md(text.get(f.key) ?? f.key, { inline: true })}</strong> ${md(f.text, { inline: true })}</li>`,
          )
          .join('')}</ul>`,
      );
    }
  }
  if (!p.graded && i.rationale) {
    parts.push(
      `<div class="cf-fb-rationale" data-cf-fb="rationale" hidden><p class="cf-fb-label">Why this matters</p>${md(i.rationale)}</div>`,
    );
  }
  parts.push(`<p class="cf-fb-incomplete" data-cf-fb="incomplete" hidden>${icon('info')}Answer every part before checking.</p>`);
  return `<div class="cf-feedback" id="${domId(base, 'feedback')}" data-cf-feedback role="status" aria-live="polite">${parts.join('')}</div>`;
}

export const Question: CfComponent<QuestionProps> = {
  name: 'question',
  render(p) {
    const i = p.interaction;
    const base = domId('cf-q', p.id);
    const label = p.label ?? (p.graded ? 'Assessment question' : 'Knowledge check');
    const head = `<p class="cf-q-label">${icon(p.graded ? 'clipboard-check' : 'lightbulb')}${esc(label)}</p>`;
    const stem = `<legend class="cf-q-stem" id="${domId(base, 'stem')}">${md(i.stem, { inline: true })}</legend><p class="cf-q-hint" id="${domId(base, 'hint')}">${HINTS[i.mode]}</p>`;
    let controls = '';
    if (i.mode === 'single' || i.mode === 'multiple') controls = choices(p, base);
    else if (i.mode === 'matching' || i.mode === 'categorization') controls = selects(p, base);
    else if (i.mode === 'sequencing') controls = sequence(p, base);
    else if (i.options.length)
      controls = `<ul class="cf-reveal-points">${i.options.map((o) => `<li>${md(o.text, { inline: true })}</li>`).join('')}</ul>`;
    const actions =
      i.mode === 'reveal'
        ? `<button type="button" class="cf-btn cf-btn--primary" data-cf-reveal aria-expanded="false" aria-controls="${domId(base, 'feedback')}">${icon('lightbulb')}<span>Reveal answer</span></button>`
        : `<button type="submit" class="cf-btn cf-btn--primary" data-cf-submit>${icon(p.graded ? 'check' : 'circle-check')}<span>${p.graded ? 'Submit answer' : 'Check answer'}</span></button><button type="button" class="cf-btn cf-btn--ghost" data-cf-retry hidden>${icon('rotate-ccw')}<span>Try again</span></button>`;
    return `<form class="cf-question${p.graded ? ' cf-question--graded' : ''}"${attrs({
      'data-cf-item': p.id,
      'data-cf-mode': i.mode,
      'data-cf-graded': p.graded ? 'true' : 'false',
      novalidate: true,
    })}>${head}<fieldset class="cf-q-fieldset">${stem}${controls}</fieldset><div class="cf-q-actions">${actions}</div>${feedback(p, base)}</form>`;
  },
};

/** Human-readable correct answer (results review). */
export function correctAnswerHtml(i: Interaction): string {
  const text = new Map(i.options.map((o) => [o.key, o.text]));
  const target = new Map(i.targets.map((t) => [t.key, t.text]));
  const inline = (s: string) => md(s, { inline: true });
  switch (i.mode) {
    case 'single':
    case 'multiple':
      return `<ul class="cf-answer-list">${i.correctKeys.map((k) => `<li>${inline(text.get(k) ?? k)}</li>`).join('')}</ul>`;
    case 'matching':
    case 'categorization':
      return `<ul class="cf-answer-list">${i.mapping.map((m) => `<li>${inline(text.get(m.key) ?? m.key)} → <strong>${esc(target.get(m.target) ?? m.target)}</strong></li>`).join('')}</ul>`;
    case 'sequencing':
      return `<ol class="cf-answer-list">${i.order.map((k) => `<li>${inline(text.get(k) ?? k)}</li>`).join('')}</ol>`;
    case 'reveal':
      return md(i.feedbackCorrect);
  }
}
