/**
 * App shell: header (title, progress on every breakpoint, menu/glossary/references/theme), navigation
 * (sticky sidebar ≥1024px, moved into a modal <dialog> below), pager, resource dialogs, confirm dialog, announcer.
 */
import type { CourseModel, Screen } from '../../../../src/core/schemas/model.js';
import { type CfComponent, esc, icon, md } from '../contract.js';
import type { CfData, CfItem } from '../runtime/types.js';
import type { VisualRender } from './figure.js';
import { type CourseContext, createContext, ScreenView } from './screens.js';

const iconBtn = (label: string, ic: Parameters<typeof icon>[0], extra: string, text = false) =>
  `<button type="button" class="cf-btn cf-btn--quiet${text ? '' : ' cf-btn--icon'}" ${extra}${text ? '' : ` aria-label="${esc(label)}"`}>${icon(ic)}${
    text ? `<span class="cf-btn-text">${esc(label)}</span>` : ''
  }</button>`;

export const Header: CfComponent<{ model: CourseModel; firstModuleTitle: string }> = {
  name: 'header',
  render({ model, firstModuleTitle }) {
    return `<header class="cf-header"><a class="cf-skip" href="#cf-main" data-cf-skip>Skip to content</a><div class="cf-header-inner">
<button type="button" class="cf-btn cf-btn--quiet cf-btn--icon cf-menu-btn" data-cf-menu-toggle aria-controls="cf-nav-dialog" aria-expanded="false" aria-label="Open course menu">${icon('menu')}</button>
<div class="cf-brand"><span class="cf-brand-mark" aria-hidden="true">${icon('graduation-cap')}</span><div class="cf-brand-text"><p class="cf-brand-title">${esc(model.title)}</p><p class="cf-brand-sub" data-cf-current-module>${esc(firstModuleTitle)}</p></div></div>
<div class="cf-progress-wrap"><div class="cf-progress" data-cf-progress role="progressbar" aria-label="Course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0% complete"><span class="cf-progress-bar" data-cf-progress-bar></span></div><span class="cf-progress-label" data-cf-progress-label aria-hidden="true">0%</span></div>
<div class="cf-header-actions">${iconBtn('Glossary', 'book-open', 'data-cf-open="glossary" aria-haspopup="dialog"', true)}${iconBtn('References', 'library', 'data-cf-open="references" aria-haspopup="dialog"', true)}${iconBtn('Switch colour theme', 'sun-moon', 'data-cf-theme-toggle')}</div>
</div></header>`;
  },
};

export const NavDrawer: CfComponent<{ ctx: CourseContext }> = {
  name: 'nav-drawer',
  render({ ctx }) {
    const byId = new Map(ctx.model.screens.map((s) => [s.id, s]));
    const modules = ctx.model.modules
      .map((m, i) => {
        const screens = m.screenIds.map((id) => byId.get(id)).filter((s): s is Screen => Boolean(s));
        const required = screens.filter((s) => !s.optional).length;
        const links = screens
          .map(
            (s) =>
              `<li><a class="cf-nav-link" href="#/s/${esc(s.id)}" data-cf-goto="${esc(s.id)}"><span class="cf-nav-status" aria-hidden="true">${icon('check')}</span><span class="cf-nav-text">${esc(s.title)}${
                s.optional ? ' <span class="cf-nav-tag">Optional</span>' : ''
              }</span><span class="cf-sr-only" data-cf-nav-sr></span></a></li>`,
          )
          .join('');
        return `<li class="cf-nav-module" data-cf-nav-module="${esc(m.id)}"><p class="cf-nav-module-head"><span class="cf-nav-module-num" aria-hidden="true">${i + 1}</span><span class="cf-nav-module-title">${esc(m.title)}</span><span class="cf-nav-module-count" data-cf-module-count data-cf-required="${required}">0/${required}</span></p><ol class="cf-nav-screens">${links}</ol></li>`;
      })
      .join('');
    return `<nav class="cf-nav" id="cf-nav" aria-label="Course contents" data-cf-nav-list><ol class="cf-nav-modules">${modules}</ol><div class="cf-nav-foot"><button type="button" class="cf-btn cf-btn--quiet cf-btn--sm" data-cf-action="reset-course">${icon('rotate-ccw')}<span>Reset course progress</span></button></div></nav>`;
  },
};

const dialogHead = (id: string, title: string, ic: Parameters<typeof icon>[0]) =>
  `<div class="cf-dialog-head"><h2 class="cf-dialog-title" id="${id}-title">${icon(ic)}${esc(title)}</h2><button type="button" class="cf-btn cf-btn--quiet cf-btn--icon" data-cf-close aria-label="Close">${icon('x')}</button></div>`;

const search = (id: string, label: string, placeholder: string) =>
  `<div class="cf-dialog-search"><label class="cf-sr-only" for="${id}-q">${esc(label)}</label><span class="cf-search">${icon('search')}<input type="search" id="${id}-q" class="cf-input" data-cf-filter placeholder="${esc(placeholder)}" autocomplete="off"></span><p class="cf-filter-status cf-sr-only" data-cf-filter-status role="status"></p></div>`;

export const GlossaryDialog: CfComponent<{ model: CourseModel }> = {
  name: 'glossary-dialog',
  render({ model }) {
    const terms = [...model.glossary]
      .sort((a, b) => a.term.localeCompare(b.term))
      .map(
        (g) =>
          `<div class="cf-gl-entry" data-cf-term="${esc(g.id)}" id="cf-term-${esc(g.id)}" data-cf-search="${esc(`${g.term} ${g.definition}`.toLowerCase())}"><dt>${esc(g.term)}</dt><dd>${md(g.definition, { inline: true })}</dd></div>`,
      )
      .join('');
    const acronyms = [...model.acronyms]
      .sort((a, b) => a.acronym.localeCompare(b.acronym))
      .map(
        (a) =>
          `<div class="cf-gl-entry cf-gl-entry--acronym" data-cf-acronym="${esc(a.id)}" data-cf-search="${esc(`${a.acronym} ${a.expansion}`.toLowerCase())}"><dt><abbr title="${esc(a.expansion)}">${esc(a.acronym)}</abbr></dt><dd>${esc(a.expansion)}</dd></div>`,
      )
      .join('');
    return `<dialog id="cf-glossary" class="cf-dialog cf-dialog--panel" aria-labelledby="cf-glossary-title">${dialogHead('cf-glossary', 'Glossary', 'book-open')}${search('cf-glossary', 'Search the glossary', 'Search terms and acronyms')}<div class="cf-dialog-body">${
      terms ? `<h3 class="cf-dialog-section">Terms</h3><dl class="cf-gl-list">${terms}</dl>` : ''
    }${acronyms ? `<h3 class="cf-dialog-section">Acronyms</h3><dl class="cf-gl-list">${acronyms}</dl>` : ''}<p class="cf-empty" data-cf-empty hidden>No matching entries.</p></div></dialog>`;
  },
};

const TYPE_LABEL: Record<string, string> = {
  legislation: 'Legislation',
  regulation: 'Regulation',
  standard: 'Standard',
  'government-guidance': 'Government guidance',
  'professional-guidance': 'Professional guidance',
  'peer-reviewed': 'Peer-reviewed',
  textbook: 'Textbook',
  organization: 'Organisation',
  dataset: 'Dataset',
  news: 'News',
  internal: 'Internal',
  other: 'Other',
};

export const ReferencesDialog: CfComponent<{ model: CourseModel }> = {
  name: 'references-dialog',
  render({ model }) {
    const items = model.references
      .map((r, i) => {
        const meta = [r.author, r.publisher, r.date, r.version ? `Version ${r.version}` : null, r.jurisdiction]
          .filter(Boolean)
          .map((x) => esc(x))
          .join(' · ');
        const url = r.url && /^https?:\/\//i.test(r.url) ? r.url : null;
        return `<li class="cf-ref" data-cf-ref="${esc(r.id)}" id="cf-ref-${esc(r.id)}" data-cf-search="${esc(`${r.title} ${r.author ?? ''} ${r.publisher ?? ''}`.toLowerCase())}"><span class="cf-ref-num" aria-hidden="true">${i + 1}</span><div class="cf-ref-body"><p class="cf-ref-title">${esc(r.title)}</p>${
          meta ? `<p class="cf-ref-meta">${meta}</p>` : ''
        }<p class="cf-ref-tags"><span class="cf-badge">${esc(TYPE_LABEL[r.type] ?? r.type)}</span>${r.authority === 'primary' ? '<span class="cf-badge cf-badge--accent">Primary source</span>' : ''}</p>${
          url
            ? `<p class="cf-ref-link"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^https?:\/\//, ''))}${icon('external-link')}<span class="cf-sr-only"> (opens in new tab)</span></a></p>`
            : ''
        }${r.doi ? `<p class="cf-ref-meta">DOI ${esc(r.doi)}</p>` : ''}</div></li>`;
      })
      .join('');
    return `<dialog id="cf-references" class="cf-dialog cf-dialog--panel" aria-labelledby="cf-references-title">${dialogHead('cf-references', 'References', 'library')}${search('cf-references', 'Search references', 'Search by title or publisher')}<div class="cf-dialog-body"><ol class="cf-ref-list">${items}</ol><p class="cf-empty" data-cf-empty hidden>No matching references.</p></div></dialog>`;
  },
};

export const SourceDialog: CfComponent<Record<string, never>> = {
  name: 'source-dialog',
  render() {
    return `<dialog id="cf-source" class="cf-dialog cf-dialog--compact" aria-labelledby="cf-source-title">${dialogHead('cf-source', 'Source', 'quote')}<div class="cf-dialog-body"><div class="cf-source-body" data-cf-source-body></div><p class="cf-source-locator" data-cf-source-locator hidden>Cited at <strong data-cf-source-locator-text></strong></p></div><div class="cf-dialog-foot"><button type="button" class="cf-btn cf-btn--quiet" data-cf-open="references">${icon('library')}<span>All references</span></button></div></dialog>`;
  },
};

export const ConfirmDialog: CfComponent<Record<string, never>> = {
  name: 'confirm-dialog',
  render() {
    return `<dialog id="cf-confirm" class="cf-dialog cf-dialog--compact" role="alertdialog" aria-labelledby="cf-confirm-title" aria-describedby="cf-confirm-message"><div class="cf-dialog-body"><h2 class="cf-dialog-title" id="cf-confirm-title">${icon('triangle-alert')}<span data-cf-confirm-title>Are you sure?</span></h2><p id="cf-confirm-message" data-cf-confirm-message></p></div><div class="cf-dialog-foot"><button type="button" class="cf-btn cf-btn--secondary" data-cf-confirm="no">Cancel</button><button type="button" class="cf-btn cf-btn--danger" data-cf-confirm="yes">Reset</button></div></dialog>`;
  },
};

export const NavDialog: CfComponent<Record<string, never>> = {
  name: 'nav-dialog',
  render() {
    return `<dialog id="cf-nav-dialog" class="cf-dialog cf-dialog--drawer" aria-labelledby="cf-nav-dialog-title">${dialogHead('cf-nav-dialog', 'Course menu', 'list-ordered')}<div class="cf-dialog-body" data-cf-nav-slot></div></dialog>`;
  },
};

export const Announcer: CfComponent<Record<string, never>> = {
  name: 'announcer',
  render() {
    return `<div class="cf-sr-only" data-cf-announcer role="status" aria-live="polite" aria-atomic="true"></div><div class="cf-toast" data-cf-toast aria-hidden="true" hidden></div>`;
  },
};

export const Pager: CfComponent<{ total: number }> = {
  name: 'pager',
  render({ total }) {
    return `<nav class="cf-pager" aria-label="Screen navigation"><button type="button" class="cf-btn cf-btn--secondary" data-cf-nav="prev">${icon('chevron-left')}<span>Previous</span></button><p class="cf-pager-pos" data-cf-position>1 of ${total}</p><button type="button" class="cf-btn cf-btn--primary" data-cf-nav="next"><span>Next</span>${icon('chevron-right')}</button></nav>`;
  },
};

export interface ShellProps {
  model: CourseModel;
  visuals?: ReadonlyMap<string, VisualRender>;
}

/** Full `<body>` content for a course (everything except the head, styles and scripts). */
export const AppShell: CfComponent<ShellProps> = {
  name: 'app-shell',
  render({ model, visuals }) {
    const ctx = createContext(model, visuals);
    const screens = model.screens.map((screen, i) => ScreenView.render({ screen, ctx, position: i, hidden: i !== 0 })).join('\n');
    return `${Header.render({ model, firstModuleTitle: model.modules[0]?.title ?? '' })}
<div class="cf-layout"><aside class="cf-sidebar" data-cf-nav-home>${NavDrawer.render({ ctx })}</aside><main id="cf-main" class="cf-main" tabindex="-1"><div class="cf-stage">
${screens}
</div>${Pager.render({ total: model.screens.length })}</main></div>
${NavDialog.render({})}${GlossaryDialog.render({ model })}${ReferencesDialog.render({ model })}${SourceDialog.render({})}${ConfirmDialog.render({})}${Announcer.render({})}`;
  },
};

/** Runtime data island (`<script type="application/json" id="cf-data">`). */
export function courseData(model: CourseModel): CfData {
  const items: Record<string, CfItem> = {};
  for (const s of model.screens) {
    const i = s.interaction;
    if (!i) continue;
    items[s.id] = {
      mode: i.mode,
      graded: s.graded,
      correctKeys: [...i.correctKeys],
      mapping: Object.fromEntries(i.mapping.map((m) => [m.key, m.target])),
      order: [...i.order],
      feedbackCorrect: i.feedbackCorrect,
      feedbackIncorrect: i.feedbackIncorrect,
      optionFeedback: Object.fromEntries(i.optionFeedback.map((f) => [f.key, f.text])),
      rationale: i.rationale,
    };
  }
  return {
    courseId: model.courseId,
    version: model.version,
    storageKey: `cf:${model.courseId}:${model.version}`,
    passingPercent: model.assessment.passingPercent,
    screens: model.screens.map((s) => ({
      id: s.id,
      moduleId: s.moduleId,
      optional: s.optional,
      graded: s.graded && s.interaction !== null,
      kind: s.kind,
    })),
    items,
  };
}

/** JSON safe to embed in a `<script>` element. */
export function dataScript(data: CfData): string {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029');
  return `<script type="application/json" id="cf-data">${json}</script>`;
}
