import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { Figure } from '../../../components/course-ui/src/components/figure.js';
import { initialOrder, Question } from '../../../components/course-ui/src/components/question.js';
import { AppShell, courseData, dataScript } from '../../../components/course-ui/src/components/shell.js';
import { blockAttrs, esc, md } from '../../../components/course-ui/src/contract.js';
import type { Interaction, VisualSpec } from '../../../src/core/schemas/content.js';
import { checkNoDragOnly, checkSingleFile, checkTextEquivalents } from '../../../src/renderer/checks.js';
import { lucideSvg } from '../../../src/renderer/icons.js';
import { loadSmoke } from '../../integration/render/smoke.js';

const base: Interaction = {
  mode: 'single',
  stem: 'Pick one',
  options: [
    { key: 'a', text: 'Alpha' },
    { key: 'b', text: 'Beta' },
    { key: 'c', text: 'Gamma' },
  ],
  targets: [],
  correctKeys: ['a'],
  mapping: [],
  order: [],
  feedbackCorrect: 'Yes',
  feedbackIncorrect: 'No',
  optionFeedback: [{ key: 'b', text: 'Beta is wrong' }],
  rationale: 'Because',
};

describe('md() and esc()', () => {
  it('escapes raw HTML and script injection', () => {
    const out = md('Hello <script>alert(1)</script> <img src=x onerror=alert(1)> **bold**');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('<strong>bold</strong>');
  });

  it('neutralises javascript: links and marks external links', () => {
    expect(md('[x](javascript:alert(1))')).not.toContain('href');
    const ext = md('[OSHA](https://www.osha.gov)');
    expect(ext).toContain('target="_blank"');
    expect(ext).toContain('rel="noopener noreferrer"');
    expect(ext).toContain('(opens in new tab)');
  });

  it('renders lists, emphasis, line breaks and demotes headings below h1', () => {
    const out = md('# Title\n\n- one\n- *two*\n\nline\nbreak');
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('<li><em>two</em></li>');
    expect(out).toContain('line<br>break');
  });

  it('links the first glossary occurrence only, never inside links or tables', () => {
    const glossary = [{ id: 'G1', term: 'hazard statement', definition: 'd', sourceIds: [] }];
    const linked = new Set<string>();
    const out = md('A Hazard statement and another hazard statement. [hazard statement](#x)', { glossary, linked });
    expect(out.match(/data-cf-term-link="G1"/g)).toHaveLength(1);
    expect(linked.has('G1')).toBe(true);
    const table = md('| hazard statement |\n|---|\n| x |', { glossary, linked: new Set() });
    expect(table).not.toContain('data-cf-term-link');
  });

  it('esc covers all HTML specials', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('blockAttrs', () => {
  it('emits every data-cf attribute consistently', () => {
    const out = blockAttrs({
      id: 'B1',
      moduleId: 'M1',
      kind: 'content',
      loIds: ['LO1', 'LO2'],
      claimIds: ['C1'],
      citations: [
        { sourceId: 'S1', locator: null },
        { sourceId: 'S1', locator: 'p.2' },
        { sourceId: 'S2', locator: null },
      ],
      visualId: null,
    });
    expect(out).toBe(
      ' data-cf-block="B1" data-cf-module="M1" data-cf-kind="content" data-cf-lo="LO1 LO2" data-cf-claim="C1" data-cf-source="S1 S2" data-cf-visual=""',
    );
  });
});

describe('Question DOM contract', () => {
  const $q = (i: Interaction, graded = false) => cheerio.load(Question.render({ id: 'Q1', interaction: i, graded }));

  it('single / multiple', () => {
    const $ = $q(base);
    const form = $('form.cf-question');
    expect(form.attr('data-cf-item')).toBe('Q1');
    expect(form.attr('data-cf-mode')).toBe('single');
    expect(form.attr('data-cf-graded')).toBe('false');
    expect(form.attr('novalidate')).toBeDefined();
    expect(
      $('input[type=radio][name="Q1"]')
        .map((_, e) => $(e).attr('value'))
        .get(),
    ).toEqual(['a', 'b', 'c']);
    expect($('button[type=submit][data-cf-submit]')).toHaveLength(1);
    expect($('[data-cf-feedback][role=status][aria-live=polite]')).toHaveLength(1);
    expect($('[data-cf-retry]')).toHaveLength(1);
    expect($('[data-cf-fb-option="b"]').text()).toContain('Beta is wrong');
    expect($q({ ...base, mode: 'multiple' })('input[type=checkbox][name="Q1"]')).toHaveLength(3);
  });

  it('matching / categorization use selects keyed by option with an empty placeholder', () => {
    const i: Interaction = {
      ...base,
      mode: 'matching',
      targets: [
        { key: 't1', text: 'T1' },
        { key: 't2', text: 'T2' },
      ],
      mapping: [{ key: 'a', target: 't1' }],
    };
    const $ = $q(i);
    expect(
      $('select[data-cf-key]')
        .map((_, e) => $(e).attr('data-cf-key'))
        .get(),
    ).toEqual(['a', 'b', 'c']);
    expect(
      $('select[data-cf-key="a"] option')
        .map((_, e) => $(e).attr('value'))
        .get(),
    ).toEqual(['', 't1', 't2']);
    expect($('select[data-cf-key="a"]').attr('id')).toBe($('label[for]').first().attr('for'));
    expect($q({ ...i, mode: 'categorization' })('.cf-categories li')).toHaveLength(2);
  });

  it('@J5 sequencing: keyboard move buttons on every item and a shuffled start', () => {
    const i: Interaction = { ...base, mode: 'sequencing', correctKeys: [], order: ['a', 'b', 'c'] };
    const $ = $q(i);
    const keys = $('ol[data-cf-sequence] > li[data-cf-key]')
      .map((_, e) => $(e).attr('data-cf-key'))
      .get();
    expect(keys.sort()).toEqual(['a', 'b', 'c']);
    expect($('ol[data-cf-sequence] > li').first().attr('data-cf-key')).toBeDefined();
    expect($('button[data-cf-move="up"]')).toHaveLength(3);
    expect($('button[data-cf-move="down"]')).toHaveLength(3);
    expect($('[draggable]')).toHaveLength(0);
    expect(initialOrder(['a', 'b', 'c'], 'Q1')).not.toEqual(['a', 'b', 'c']);
    expect(initialOrder(['a', 'b', 'c'], 'Q1')).toEqual(initialOrder(['a', 'b', 'c'], 'Q1'));
  });

  it('reveal has a reveal button and no submit', () => {
    const $ = $q({ ...base, mode: 'reveal', correctKeys: [] });
    expect($('button[data-cf-reveal]')).toHaveLength(1);
    expect($('button[data-cf-submit]')).toHaveLength(0);
  });

  it('graded items never pre-render correctness feedback', () => {
    const $ = $q(base, true);
    expect($('form').attr('data-cf-graded')).toBe('true');
    expect($('[data-cf-fb="recorded"]')).toHaveLength(1);
    expect($('[data-cf-fb="correct"], [data-cf-fb="incorrect"], [data-cf-fb="rationale"]')).toHaveLength(0);
  });
});

const visual: VisualSpec = {
  id: 'V1',
  title: 'Steps',
  purpose: 'p',
  archetype: 'PROCESS',
  content: {
    items: [
      { id: 'a', label: 'First', detail: 'd1', group: null, value: null },
      { id: 'b', label: 'Second', detail: null, group: null, value: null },
    ],
    links: [],
    groups: [],
    columns: [],
    rows: [],
    axes: { x: null, y: null },
    chartType: null,
  },
  sourceIds: [],
  textEquivalent: { short: 'Two steps', long: 'First then second, in that order.' },
  interaction: 'none',
  rendererOverride: null,
  mermaid: null,
};

describe('Figure', () => {
  it('wraps inline SVG with caption, short description link and long description', () => {
    const $ = cheerio.load(
      Figure.render({
        visual,
        render: { svg: '<svg viewBox="0 0 10 10" onload="x()"><script>x()</script><title>t</title></svg>', renderer: 'cf_svg' },
      }),
    );
    const fig = $('figure.cf-figure');
    expect(fig.attr('data-cf-visual')).toBe('V1');
    expect(fig.attr('data-cf-renderer')).toBe('cf_svg');
    expect($(`#${fig.attr('aria-describedby')}`).text()).toBe('Two steps');
    expect($('svg').attr('role')).toBe('img');
    expect($('svg').attr('onload')).toBeUndefined();
    expect($('script')).toHaveLength(0);
    expect($('details.cf-figure-long').text()).toContain('First then second');
  });

  it('@H4 renders a structured text-equivalent fallback when there is no SVG', () => {
    const $ = cheerio.load(Figure.render({ visual, render: { svg: '', renderer: 'text_equivalent' } }));
    expect($('figure').attr('data-cf-renderer')).toBe('text_equivalent');
    expect($('ol.cf-figure-items li')).toHaveLength(2);
    expect(checkTextEquivalents($.html()).pass).toBe(true);
  });

  it('@J6 text-equivalent check rejects authoring instructions', () => {
    const bad = Figure.render({
      visual: { ...visual, textEquivalent: { short: 'Alt text: show steps', long: 'Create original diagram of steps' } },
    });
    expect(checkTextEquivalents(bad).pass).toBe(false);
  });
});

describe('Shell and data', () => {
  const { model, visuals } = loadSmoke();
  const $ = cheerio.load(AppShell.render({ model, visuals }));

  it('@G4 renders every screen with the screen contract, only the first visible', () => {
    const screens = $('section.cf-screen');
    expect(screens).toHaveLength(model.screens.length);
    const first = screens.first();
    expect(first.attr('id')).toBe(`screen-${model.screens[0]!.id}`);
    expect(first.attr('data-cf-block')).toBe(model.screens[0]!.id);
    expect(first.attr('hidden')).toBeUndefined();
    expect(screens.eq(1).attr('hidden')).toBeDefined();
    expect(screens.filter('[data-cf-optional]')).toHaveLength(model.screens.filter((s) => s.optional).length);
    screens.each((_, el) => {
      expect($(el).find('h1.cf-screen-title[tabindex="-1"]')).toHaveLength(1);
      for (const a of ['data-cf-module', 'data-cf-kind', 'data-cf-component', 'data-cf-lo', 'data-cf-source', 'data-cf-claim'])
        expect($(el).attr(a)).toBeDefined();
    });
  });

  it('renders nav, resources, dialogs, progress and announcer hooks', () => {
    expect($('[data-cf-nav-list] a[data-cf-goto]')).toHaveLength(model.screens.length);
    expect($('[data-cf-nav-list] a[data-cf-goto]').first().attr('href')).toBe(`#/s/${model.screens[0]!.id}`);
    for (const sel of [
      'button[data-cf-nav="next"]',
      'button[data-cf-nav="prev"]',
      'button[data-cf-menu-toggle]',
      'button[data-cf-open="glossary"]',
      'button[data-cf-open="references"]',
      'dialog#cf-glossary',
      'dialog#cf-references',
      'dialog#cf-source',
      'dialog#cf-confirm',
      '[data-cf-progress][role=progressbar]',
      '[data-cf-announcer][role=status]',
      'button[data-cf-action="reset-course"]',
      'button[data-cf-action="reset-assessment"]',
      'button[data-cf-confirm="yes"]',
      'button[data-cf-confirm="no"]',
      '[data-cf-results]',
      'a.cf-skip',
      'main#cf-main',
    ]) {
      expect($(sel).length, sel).toBeGreaterThan(0);
    }
    expect($('#cf-glossary [data-cf-term]')).toHaveLength(model.glossary.length);
    expect($('#cf-references [data-cf-ref]')).toHaveLength(model.references.length);
    expect($('button[data-cf-cite][data-cf-locator]').length).toBeGreaterThan(0);
    expect($('[data-cf-close]').length).toBeGreaterThanOrEqual(4);
  });

  it('cf-data escapes < and carries items keyed by screen id', () => {
    const data = courseData(model);
    expect(data.storageKey).toBe(`cf:${model.courseId}:${model.version}`);
    expect(Object.keys(data.items)).toEqual(model.screens.filter((s) => s.interaction).map((s) => s.id));
    const script = dataScript({ ...data, courseId: '</script><script>alert(1)' });
    expect(script.match(/<\/script>/g)).toHaveLength(1);
    expect(script).toContain('\\u003c/script>');
  });
});

describe('checks', () => {
  it('@G2 single-file check flags external resources', () => {
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'">`;
    expect(checkSingleFile(`${csp}<p>ok</p><a href="https://example.org">ref</a>`).pass).toBe(true);
    expect(checkSingleFile(`${csp}<script src="https://cdn.x/y.js"></script>`).pass).toBe(false);
    expect(checkSingleFile(`${csp}<link rel="stylesheet" href="a.css">`).pass).toBe(false);
    expect(checkSingleFile(`${csp}<img src="http://x/y.png">`).pass).toBe(false);
    expect(checkSingleFile(`${csp}<style>body{background:url(https://x/y.png)}</style>`).pass).toBe(false);
    expect(checkSingleFile('<p>no csp</p>').pass).toBe(false);
  });

  it('@J5 drag-only interactions are rejected', () => {
    expect(checkNoDragOnly('<div draggable="true">x</div>').pass).toBe(false);
    expect(checkNoDragOnly('<ol data-cf-sequence><li data-cf-key="a"><button data-cf-move="up"></button></li></ol>').pass).toBe(false);
  });
});

describe('icons', () => {
  it('reads Lucide icons, normalised and name-validated', () => {
    const svg = lucideSvg('menu');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-hidden="true"');
    expect(() => lucideSvg('../etc/passwd')).toThrow(/Invalid icon name/);
    expect(() => lucideSvg('definitely-not-an-icon-xyz')).toThrow(/not found/);
  });
});
