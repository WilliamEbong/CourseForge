/** Mermaid source generation from VisualContent and in-page rendering (no mermaid-cli). */
import type { VisualSpec } from '../core/schemas/content.js';
import type { GraphicsBrowser } from './browser.js';
import { FONT_STACK, type GraphicsTheme, PALETTE } from './theme.js';

/**
 * Make label text inert for the Mermaid grammar and for markup. With `htmlLabels:false` Mermaid does
 * not decode its `#NN;` entity codes, so grammar-significant characters are swapped for visually
 * equivalent Unicode forms instead. `bare` is for unquoted contexts (timeline, sequence text).
 */
export function mermaidLabel(text: string, bare = false): string {
  let s = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/"([^"]*)"/g, '“$1”')
    .replace(/"/g, '”')
    .replace(/</g, '＜')
    .replace(/>/g, '＞')
    .replace(/`/g, '‘')
    .replace(/#(?=[\w]*;)/g, '＃')
    .replace(/%%/g, '%');
  if (bare) s = s.replace(/:/g, '꞉').replace(/;/g, '；');
  return s;
}

/** Stable, grammar-safe node ids (collisions after sanitising get a numeric suffix). */
function idFactory(prefix: string): (raw: string) => string {
  const map = new Map<string, string>();
  const used = new Set<string>();
  return (raw) => {
    const hit = map.get(raw);
    if (hit) return hit;
    const base = `${prefix}${raw.replace(/[^A-Za-z0-9_]/g, '_')}`;
    let id = base;
    for (let k = 2; used.has(id); k++) id = `${base}_${k}`;
    used.add(id);
    map.set(raw, id);
    return id;
  };
}

type Content = VisualSpec['content'];

/** Links, or a simple chain through items when none are given. */
const edgesOf = (c: Content) =>
  c.links.length ? c.links : c.items.slice(1).map((it, i) => ({ from: c.items[i]?.id ?? '', to: it.id, label: null as string | null }));

function flowchart(c: Content, dir: 'LR' | 'TD', withGroups: boolean, decisions: boolean): string {
  const nid = idFactory('n_');
  const gid = idFactory('g_');
  const edges = edgesOf(c);
  const outDegree = new Map<string, number>();
  for (const e of edges) outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
  const node = (it: Content['items'][number]) => {
    const label = `"${mermaidLabel(it.label)}"`;
    const deg = outDegree.get(it.id) ?? 0;
    if (decisions && deg >= 2) return `${nid(it.id)}{${label}}`;
    if (decisions && deg === 0) return `${nid(it.id)}(${label})`;
    return `${nid(it.id)}[${label}]`;
  };
  const lines = [`flowchart ${dir}`];
  const grouped = new Set<string>();
  if (withGroups) {
    for (const g of c.groups) {
      const members = c.items.filter((it) => it.group === g.id);
      if (!members.length) continue;
      lines.push(`  subgraph ${gid(g.id)}["${mermaidLabel(g.label)}"]`);
      for (const it of members) {
        lines.push(`    ${node(it)}`);
        grouped.add(it.id);
      }
      lines.push('  end');
    }
  }
  for (const it of c.items) if (!grouped.has(it.id)) lines.push(`  ${node(it)}`);
  const known = new Set(c.items.map((it) => it.id));
  for (const e of edges) {
    if (!known.has(e.from) || !known.has(e.to)) continue;
    const lbl = e.label ? `|"${mermaidLabel(e.label)}"|` : '';
    lines.push(`  ${nid(e.from)} -->${lbl} ${nid(e.to)}`);
  }
  return lines.join('\n');
}

function timelineSource(c: Content): string {
  const lines = ['timeline'];
  for (const it of c.items) lines.push(`  ${mermaidLabel(it.label, true)} : ${mermaidLabel(it.detail ?? it.label, true)}`);
  return lines.join('\n');
}

function sequenceSource(c: Content): string {
  const pid = idFactory('p_');
  const lines = ['sequenceDiagram'];
  for (const it of c.items) lines.push(`  participant ${pid(it.id)} as ${mermaidLabel(it.label, true)}`);
  const known = new Set(c.items.map((it) => it.id));
  for (const l of c.links) {
    if (!known.has(l.from) || !known.has(l.to)) continue;
    lines.push(`  ${pid(l.from)}->>${pid(l.to)}: ${mermaidLabel(l.label ?? ' ', true) || ' '}`);
  }
  return lines.join('\n');
}

function stateSource(c: Content): string {
  const sid = idFactory('s_');
  const lines = ['stateDiagram-v2'];
  for (const it of c.items) lines.push(`  state "${mermaidLabel(it.label)}" as ${sid(it.id)}`);
  const first = c.items[0];
  if (first) lines.push(`  [*] --> ${sid(first.id)}`);
  const known = new Set(c.items.map((it) => it.id));
  for (const l of edgesOf(c)) {
    if (!known.has(l.from) || !known.has(l.to)) continue;
    lines.push(`  ${sid(l.from)} --> ${sid(l.to)}${l.label ? `: ${mermaidLabel(l.label, true)}` : ''}`);
  }
  return lines.join('\n');
}

/** Mermaid text for a spec. An explicit `spec.mermaid` always wins. */
export function mermaidSource(spec: VisualSpec): string {
  if (spec.mermaid?.trim()) return spec.mermaid;
  const c = spec.content;
  if (!c.items.length) throw new Error(`Cannot generate Mermaid for ${spec.id}: no items`);
  switch (spec.archetype) {
    case 'PROCESS':
    case 'CAUSE_EFFECT':
      return flowchart(c, 'LR', false, false);
    case 'DECISION_TREE':
    case 'SCENARIO_MAP':
      return flowchart(c, 'TD', true, true);
    case 'SYSTEM_ARCHITECTURE':
      return flowchart(c, 'TD', true, false);
    case 'TIMELINE':
      return timelineSource(c);
    case 'SEQUENCE':
      return sequenceSource(c);
    case 'STATE_DIAGRAM':
      return stateSource(c);
    default:
      return flowchart(c, 'TD', true, false);
  }
}

/** Neutral hex theme; post-processing maps these literals back onto the `--cf-*` variables. */
export function mermaidThemeVariables(theme: GraphicsTheme): Record<string, string> {
  const nodeFill = theme.figureStyle === 'filled' ? PALETTE['surface-2'] : PALETTE.surface;
  return {
    fontFamily: FONT_STACK,
    fontSize: '15px',
    background: PALETTE.surface,
    primaryColor: nodeFill,
    primaryTextColor: PALETTE.fg,
    primaryBorderColor: PALETTE['viz-1'],
    secondaryColor: PALETTE['surface-2'],
    secondaryTextColor: PALETTE.fg,
    secondaryBorderColor: PALETTE['viz-2'],
    tertiaryColor: PALETTE.surface,
    tertiaryTextColor: PALETTE.fg,
    tertiaryBorderColor: PALETTE.border,
    lineColor: PALETTE['fg-muted'],
    textColor: PALETTE.fg,
    mainBkg: nodeFill,
    nodeBorder: PALETTE['viz-1'],
    clusterBkg: PALETTE['surface-2'],
    clusterBorder: PALETTE.border,
    titleColor: PALETTE.fg,
    edgeLabelBackground: PALETTE.surface,
    actorBkg: nodeFill,
    actorBorder: PALETTE['viz-1'],
    actorTextColor: PALETTE.fg,
    actorLineColor: PALETTE.border,
    signalColor: PALETTE['fg-muted'],
    signalTextColor: PALETTE.fg,
    labelBoxBkgColor: PALETTE['surface-2'],
    labelBoxBorderColor: PALETTE.border,
    labelTextColor: PALETTE.fg,
    loopTextColor: PALETTE.fg,
    noteBkgColor: PALETTE['surface-2'],
    noteBorderColor: PALETTE.border,
    noteTextColor: PALETTE.fg,
    stateBkg: nodeFill,
    stateBorder: PALETTE['viz-1'],
    transitionColor: PALETTE['fg-muted'],
    transitionLabelColor: PALETTE.fg,
    specialStateColor: PALETTE['fg-muted'],
    cScale0: PALETTE['viz-1'],
    cScale1: PALETTE['viz-2'],
    cScale2: PALETTE['viz-3'],
    cScale3: PALETTE['viz-4'],
    cScale4: PALETTE['viz-5'],
    cScale5: PALETTE['viz-6'],
    cScaleLabel0: PALETTE.surface,
    cScaleLabel1: PALETTE.surface,
    cScaleLabel2: PALETTE.surface,
    cScaleLabel3: PALETTE.surface,
    cScaleLabel4: PALETTE.surface,
    cScaleLabel5: PALETTE.surface,
  };
}

const RENDER_FN = `async ({ id, seed, text, themeVariables }) => {
  const m = globalThis.mermaid;
  m.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    flowchart: { htmlLabels: false, curve: 'basis', padding: 12, nodeSpacing: 40, rankSpacing: 48 },
    sequence: { useMaxWidth: false },
    timeline: { useMaxWidth: false, disableMulticolor: false },
    deterministicIds: true,
    deterministicIDSeed: seed,
    theme: 'base',
    themeVariables,
  });
  try {
    await m.parse(text);
    const { svg } = await m.render(id, text);
    return svg;
  } finally {
    for (const el of document.querySelectorAll('body > :not(script)')) el.remove();
  }
}`;

/** Render a spec with Mermaid inside the shared page; returns raw SVG (post-process separately). */
export async function renderMermaid(browser: GraphicsBrowser, spec: VisualSpec, theme: GraphicsTheme): Promise<string> {
  const text = mermaidSource(spec);
  const id = `m-${spec.id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  return browser.call<string>(RENDER_FN, { id, seed: spec.id, text, themeVariables: mermaidThemeVariables(theme) }, ['mermaid']);
}
