/**
 * Screen-level components (one per COMPONENT_TYPES entry) and the screen wrapper that carries the DOM contract.
 */
import type { ComponentType } from '../../../../src/core/enums.js';
import type { Reference, VisualSpec } from '../../../../src/core/schemas/content.js';
import type { CourseModel, Screen } from '../../../../src/core/schemas/model.js';
import { attrs, blockAttrs, type CfComponent, esc, type IconName, icon, md } from '../contract.js';
import { Figure, type VisualRender } from './figure.js';
import { correctAnswerHtml, domId, Question } from './question.js';

export interface CourseContext {
  model: CourseModel;
  visuals: ReadonlyMap<string, VisualRender>;
  refNumber: ReadonlyMap<string, number>;
  refById: ReadonlyMap<string, Reference>;
  visualById: ReadonlyMap<string, VisualSpec>;
  figureNumber: ReadonlyMap<string, number>;
  moduleIndex: ReadonlyMap<string, number>;
  gradedIds: readonly string[];
}

export function createContext(model: CourseModel, visuals: ReadonlyMap<string, VisualRender> = new Map()): CourseContext {
  const figureNumber = new Map<string, number>();
  for (const s of model.screens) if (s.visualId && !figureNumber.has(s.visualId)) figureNumber.set(s.visualId, figureNumber.size + 1);
  return {
    model,
    visuals,
    refNumber: new Map(model.references.map((r, i) => [r.id, i + 1])),
    refById: new Map(model.references.map((r) => [r.id, r])),
    visualById: new Map(model.visuals.map((v) => [v.id, v])),
    figureNumber,
    moduleIndex: new Map(model.modules.map((m, i) => [m.id, i])),
    gradedIds: model.screens.filter((s) => s.graded && s.interaction).map((s) => s.id),
  };
}

export interface ScreenProps {
  screen: Screen;
  ctx: CourseContext;
}

const KIND_LABEL: Partial<Record<Screen['kind'], string>> = {
  'section-title': 'Module overview',
  'topic-title': 'Module overview',
  concept: 'Key concept',
  'technical-depth': 'Technical depth',
  example: 'Example',
  comparison: 'Comparison',
  process: 'Process',
  evidence: 'Evidence',
  warning: 'Caution',
  misconception: 'Misconception',
  scenario: 'Scenario',
  review: 'Review',
  summary: 'Summary',
  formative: 'Knowledge check',
  graded: 'Assessment',
};

/** Per-screen prose with glossary auto-linking (first occurrence of each term per screen). */
function prose(text: string, ctx: CourseContext, linked: Set<string>, cls = 'cf-prose'): string {
  if (!text.trim()) return '';
  return `<div class="${cls}">${md(text, { glossary: ctx.model.glossary, linked })}</div>`;
}

function figure(screen: Screen, ctx: CourseContext): string {
  if (!screen.visualId) return '';
  const visual = ctx.visualById.get(screen.visualId);
  if (!visual) return '';
  return Figure.render({ visual, render: ctx.visuals.get(visual.id), number: ctx.figureNumber.get(visual.id) ?? 1 });
}

function question(screen: Screen, ctx: CourseContext): string {
  if (!screen.interaction) return '';
  const n = ctx.gradedIds.indexOf(screen.id);
  const label = screen.graded
    ? `Question ${n + 1} of ${ctx.gradedIds.length}`
    : screen.component === 'scenario'
      ? 'Your decision'
      : 'Practice question';
  return Question.render({ id: screen.id, interaction: screen.interaction, graded: screen.graded, label });
}

type Variant = 'law' | 'standard' | 'guidance' | 'evidence';
function evidenceVariant(screen: Screen, ctx: CourseContext): Variant {
  const sub = (screen.subtype ?? '').toLowerCase();
  if (sub === 'law' || sub === 'standard' || sub === 'guidance') return sub;
  const types = screen.citations.map((c) => ctx.refById.get(c.sourceId)?.type);
  if (types.some((t) => t === 'legislation' || t === 'regulation')) return 'law';
  if (types.includes('standard')) return 'standard';
  if (types.some((t) => t === 'government-guidance' || t === 'professional-guidance')) return 'guidance';
  return 'evidence';
}

const VARIANT: Record<Variant, { label: string; icon: IconName }> = {
  law: { label: 'Legal requirement', icon: 'scale' },
  standard: { label: 'Standard', icon: 'clipboard-check' },
  guidance: { label: 'Guidance', icon: 'book-open' },
  evidence: { label: 'Evidence', icon: 'file-text' },
};

function callout(kind: string, label: string, ic: IconName, body: string): string {
  return `<div class="cf-callout cf-callout--${kind}" role="note" aria-label="${esc(label)}"><p class="cf-callout-label">${icon(ic)}${esc(label)}</p>${body}</div>`;
}

const bodyOf = (p: ScreenProps, linked: Set<string>) => prose(p.screen.body, p.ctx, linked);

function simple(
  name: ComponentType,
  render: (p: ScreenProps, linked: Set<string>) => string,
): CfComponent<ScreenProps & { linked: Set<string> }> {
  return { name, render: (p) => render(p, p.linked) };
}

export const SCREEN_COMPONENTS: Record<ComponentType, CfComponent<ScreenProps & { linked: Set<string> }>> = {
  'module-landing': simple('module-landing', (p, linked) => {
    const { model } = p.ctx;
    const mod = model.modules.find((m) => m.id === p.screen.moduleId);
    const objectives = model.objectives.filter((o) => mod?.loIds.includes(o.id));
    const rest = (mod?.screenIds ?? []).filter((id) => id !== p.screen.id);
    const byId = new Map(model.screens.map((s) => [s.id, s]));
    const toc = rest
      .map((id) => byId.get(id))
      .filter((s): s is Screen => Boolean(s))
      .map(
        (s) =>
          `<li><span>${esc(s.title)}</span>${s.optional ? '<span class="cf-badge">Optional</span>' : ''}${s.interaction ? `<span class="cf-badge cf-badge--accent">${s.graded ? 'Graded' : 'Practice'}</span>` : ''}</li>`,
      )
      .join('');
    return `<div class="cf-landing">${mod?.summary ? `<div class="cf-lead">${md(mod.summary, { inline: false })}</div>` : ''}${bodyOf(p, linked)}${figure(p.screen, p.ctx)}<div class="cf-landing-grid">${
      objectives.length
        ? `<section class="cf-card" aria-labelledby="${domId(p.screen.id, 'lo')}"><h2 class="cf-card-title" id="${domId(p.screen.id, 'lo')}">${icon('target')}You will be able to</h2><ul class="cf-objectives">${objectives
            .map((o) => `<li>${md(o.text, { inline: true })}</li>`)
            .join('')}</ul></section>`
        : ''
    }${
      toc
        ? `<section class="cf-card" aria-labelledby="${domId(p.screen.id, 'toc')}"><h2 class="cf-card-title" id="${domId(p.screen.id, 'toc')}">${icon('list-ordered')}In this module</h2><ol class="cf-landing-toc">${toc}</ol></section>`
        : ''
    }</div></div>`;
  }),
  content: simple('content', (p, linked) => `${bodyOf(p, linked)}${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`),
  concept: simple(
    'concept',
    (p, linked) =>
      `<div class="cf-concept"><p class="cf-concept-label">${icon('lightbulb')}Key concept</p>${bodyOf(p, linked)}</div>${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`,
  ),
  'technical-depth': simple(
    'technical-depth',
    (p, linked) =>
      `<p class="cf-depth-note">${icon('layers')}<span>Optional deeper dive. It adds detail for specialists and is not needed for the assessment.</span></p><details class="cf-depth"><summary class="cf-depth-summary"><span>Read the technical detail</span>${icon('chevron-right', 'cf-depth-chevron')}</summary><div class="cf-depth-body">${bodyOf(p, linked)}${figure(p.screen, p.ctx)}</div></details>${question(p.screen, p.ctx)}`,
  ),
  'evidence-callout': simple('evidence-callout', (p, linked) => {
    const v = evidenceVariant(p.screen, p.ctx);
    return `${callout(v, VARIANT[v].label, VARIANT[v].icon, bodyOf(p, linked))}${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`;
  }),
  'warning-callout': simple('warning-callout', (p, linked) => {
    const qualification = /qualif|limit|caveat/i.test(p.screen.subtype ?? '');
    return `${callout(qualification ? 'info' : 'warning', qualification ? 'Qualification' : 'Caution', qualification ? 'info' : 'triangle-alert', bodyOf(p, linked))}${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`;
  }),
  misconception: simple(
    'misconception',
    (p, linked) =>
      `${callout('misconception', 'Common misconception', 'circle-alert', bodyOf(p, linked))}${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`,
  ),
  comparison: simple(
    'comparison',
    (p, linked) => `<div class="cf-comparison">${bodyOf(p, linked)}</div>${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`,
  ),
  process: simple(
    'process',
    (p, linked) => `<div class="cf-process">${bodyOf(p, linked)}</div>${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`,
  ),
  scenario: simple(
    'scenario',
    (p, linked) =>
      `<div class="cf-scenario"><p class="cf-scenario-label">${icon('flask-conical')}${esc(p.screen.subtype ? `Scenario · ${p.screen.subtype}` : 'Scenario')}</p>${bodyOf(p, linked)}</div>${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`,
  ),
  review: simple(
    'review',
    (p, linked) =>
      `<div class="cf-review"><p class="cf-review-label">${icon('bookmark')}Key takeaways</p>${bodyOf(p, linked)}</div>${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`,
  ),
  question: simple('question', (p, linked) => `${bodyOf(p, linked)}${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`),
  'assessment-question': simple(
    'assessment-question',
    (p, linked) => `${bodyOf(p, linked)}${figure(p.screen, p.ctx)}${question(p.screen, p.ctx)}`,
  ),
  results: simple('results', (p, linked) => `${bodyOf(p, linked)}${Results.render({ ctx: p.ctx })}`),
};

export const Results: CfComponent<{ ctx: CourseContext }> = {
  name: 'results',
  render({ ctx }) {
    const byId = new Map(ctx.model.screens.map((s) => [s.id, s]));
    const total = ctx.gradedIds.length;
    const pass = ctx.model.assessment.passingPercent;
    const pending = ctx.gradedIds
      .map(
        (id, i) =>
          `<li data-cf-pending="${esc(id)}"><a href="#/s/${esc(id)}" data-cf-goto="${esc(id)}">Question ${i + 1}: ${esc(byId.get(id)?.title ?? id)}</a></li>`,
      )
      .join('');
    const review = ctx.gradedIds
      .map((id, i) => {
        const s = byId.get(id)!;
        const it = s.interaction!;
        return `<li class="cf-review-item" data-cf-review-item="${esc(id)}"><div class="cf-review-head"><span class="cf-review-num">${i + 1}</span><p class="cf-review-stem">${md(it.stem, { inline: true })}</p><span class="cf-status" data-cf-review-status></span></div><div class="cf-review-answer"><p class="cf-review-label">Correct answer</p>${correctAnswerHtml(it)}</div>${
          it.rationale ? `<div class="cf-review-rationale"><p class="cf-review-label">Why</p>${md(it.rationale)}</div>` : ''
        }</li>`;
      })
      .join('');
    return `<div class="cf-results" data-cf-results data-cf-total="${total}" data-cf-pass="${pass}">
<div class="cf-results-pending" data-cf-results-pending><p class="cf-results-pending-text">${icon('info')}<span>You have answered <strong data-cf-results-answered>0</strong> of ${total} assessment questions. Answer every question to see your result.</span></p><ul class="cf-results-pending-list">${pending}</ul></div>
<div class="cf-results-summary" data-cf-results-summary hidden><div class="cf-score" data-cf-score-ring><span class="cf-score-value"><span data-cf-results-percent>0</span><span class="cf-score-unit">%</span></span></div><div class="cf-results-text"><p class="cf-results-verdict" data-cf-results-verdict></p><p class="cf-results-detail">You answered <strong data-cf-results-correct>0</strong> of ${total} questions correctly. The passing score is ${pass}%.</p><div class="cf-results-actions"><button type="button" class="cf-btn cf-btn--secondary" data-cf-action="reset-assessment">${icon('rotate-ccw')}<span>Retake assessment</span></button></div></div></div>
<section class="cf-results-review" data-cf-results-review hidden aria-labelledby="cf-results-review-title"><h2 class="cf-section-title" id="cf-results-review-title">Review your answers</h2><ol class="cf-review-list">${review}</ol></section>
</div>`;
  },
};

function citations(screen: Screen, ctx: CourseContext): string {
  if (!screen.citations.length) return '';
  const chips = screen.citations
    .map((c) => {
      const ref = ctx.refById.get(c.sourceId);
      const n = ctx.refNumber.get(c.sourceId);
      const short = ref ? (ref.publisher ?? ref.author ?? ref.title) : c.sourceId;
      return `<li><button type="button" class="cf-cite"${attrs({ 'data-cf-cite': c.sourceId, 'data-cf-locator': c.locator ?? '', 'aria-haspopup': 'dialog' })}><span class="cf-cite-num" aria-hidden="true">${n ?? '?'}</span><span class="cf-sr-only">Source ${n ?? ''}: </span><span class="cf-cite-text">${esc(short)}${
        c.locator ? ` <span class="cf-cite-loc">${esc(c.locator)}</span>` : ''
      }</span></button></li>`;
    })
    .join('');
  return `<footer class="cf-screen-sources"><p class="cf-sources-label" id="${domId('cf-src', screen.id)}">Sources</p><ul class="cf-cite-list" aria-labelledby="${domId('cf-src', screen.id)}">${chips}</ul></footer>`;
}

/** The screen wrapper: DOM contract + heading + component body + citations. */
export const ScreenView: CfComponent<ScreenProps & { position: number; hidden: boolean }> = {
  name: 'screen',
  render({ screen, ctx, position, hidden }) {
    const mod = ctx.model.modules.find((m) => m.id === screen.moduleId);
    const mIndex = (ctx.moduleIndex.get(screen.moduleId) ?? 0) + 1;
    const kind = KIND_LABEL[screen.kind];
    const linked = new Set<string>();
    const body = SCREEN_COMPONENTS[screen.component].render({ screen, ctx, linked });
    const titleId = domId('screen', screen.id, 'title');
    const eyebrow = `<p class="cf-eyebrow"><span class="cf-eyebrow-module">Module ${mIndex}${mod ? ` · ${esc(mod.title)}` : ''}</span>${
      kind ? `<span class="cf-eyebrow-kind cf-kind--${esc(screen.kind)}">${esc(kind)}</span>` : ''
    }${screen.optional ? '<span class="cf-badge">Optional</span>' : ''}</p>`;
    return `<section class="cf-screen cf-screen--${screen.component}" id="${esc(`screen-${screen.id}`)}"${attrs({
      'data-cf-screen': screen.id,
      'data-cf-component': screen.component,
      'data-cf-index': position,
      'data-cf-optional': screen.optional,
      'aria-labelledby': titleId,
      hidden,
    })}${blockAttrs(screen)}><header class="cf-screen-head">${eyebrow}<h1 class="cf-screen-title" id="${titleId}" tabindex="-1">${esc(screen.title)}</h1></header><div class="cf-screen-body">${body}</div>${citations(screen, ctx)}</section>`;
  },
};
