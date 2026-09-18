/** Storybook helpers: theme injection, icon sprite, the smoke course sample and runtime hydration. */
import * as lucide from 'lucide-static';
import { VISUAL_FAMILIES, type VisualFamily } from '../../../src/core/enums.js';
import { type CourseModel, CourseModelSchema } from '../../../src/core/schemas/model.js';
import course from '../../../tests/fixtures/courses/smoke/course.json' with { type: 'json' };
import v1 from '../../../tests/fixtures/courses/smoke/visuals/V-01.svg?raw';
import v2 from '../../../tests/fixtures/courses/smoke/visuals/V-02.svg?raw';
import v3 from '../../../tests/fixtures/courses/smoke/visuals/V-03.svg?raw';
import type { VisualRender } from '../src/components/figure.js';
import { ICONS, iconSprite } from '../src/contract.js';
import { hydrateQuestion } from '../src/runtime/question.js';
import type { CfAnswer, CfItem } from '../src/runtime/types.js';
import { compileTheme, defaultDirection } from '../tokens/compile.js';

export const model: CourseModel = CourseModelSchema.parse(course);
export const visuals = new Map<string, VisualRender>([
  ['V-01', { svg: v1, renderer: 'cf_svg' }],
  ['V-02', { svg: v2, renderer: 'cf_svg' }],
  ['V-03', { svg: v3, renderer: 'vega_lite' }],
]);
export const screen = (id: string) => model.screens.find((s) => s.id === id)!;

const pascal = (name: string) =>
  name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
const icons = lucide as unknown as Record<string, string>;

export function applyTheme(family: string, scheme: string): void {
  const fam = (VISUAL_FAMILIES as readonly string[]).includes(family) ? (family as VisualFamily) : 'scientific-clinical';
  let style = document.getElementById('cf-sb-theme');
  if (!style) {
    style = document.createElement('style');
    style.id = 'cf-sb-theme';
    document.head.append(style);
  }
  style.textContent = compileTheme(defaultDirection(fam)).css;
  document.documentElement.setAttribute('data-cf-theme', scheme === 'dark' ? 'dark' : 'light');
  document.documentElement.setAttribute('data-cf-family', fam);
  if (!document.getElementById('cf-sb-sprite')) {
    const holder = document.createElement('div');
    holder.id = 'cf-sb-sprite';
    holder.innerHTML = iconSprite(ICONS, (n) => icons[pascal(n)] ?? '<svg></svg>');
    document.body.prepend(holder);
  }
}

/** Wraps build-time HTML (our own sanitised render output) in a container element. */
export function frame(html: string, cls = 'cf-sb-frame'): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  return el;
}

export function itemFor(id: string): CfItem {
  const s = screen(id);
  const i = s.interaction!;
  return {
    mode: i.mode,
    graded: s.graded,
    correctKeys: i.correctKeys,
    mapping: Object.fromEntries(i.mapping.map((m) => [m.key, m.target])),
    order: i.order,
    feedbackCorrect: i.feedbackCorrect,
    feedbackIncorrect: i.feedbackIncorrect,
    optionFeedback: Object.fromEntries(i.optionFeedback.map((f) => [f.key, f.text])),
    rationale: i.rationale,
  };
}

/** Hydrates every question inside `root`, optionally restoring a saved answer to show a state. */
export function hydrate(root: HTMLElement, saved?: (id: string) => CfAnswer | undefined): HTMLElement {
  for (const form of root.querySelectorAll<HTMLFormElement>('form.cf-question')) {
    const id = form.dataset.cfItem ?? '';
    hydrateQuestion(form, id, itemFor(id), { onAnswer: () => undefined, announce: () => undefined }, saved?.(id));
  }
  return root;
}

export const VIEWPORTS = {
  mobile: { globals: { viewport: { value: 'mobile', isRotated: false } } },
  tablet: { globals: { viewport: { value: 'tablet', isRotated: false } } },
  desktop: { globals: { viewport: { value: 'desktop', isRotated: false } } },
} as const;
