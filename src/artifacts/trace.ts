/**
 * Traceability graph (plan §9). Edges live in the home artifacts; the graph is derived on demand.
 * Direction: source → claim → section/lo → module → block/item → component → element ("down" = toward the learner).
 * Node kind comes from the artifact an ID lives in, never from the ID text.
 */
import { join } from 'node:path';
import { z } from 'zod';
import { type Severity, STAGES, type Stage } from '../core/enums.js';
import { usageError } from '../core/errors.js';
import { exists, readText } from '../core/fsx.js';
import { splitCitationToken } from '../core/ids.js';
import { COURSE_FILES } from '../core/paths.js';

export const TRACE_KINDS = [
  'source',
  'claim',
  'section',
  'lo',
  'module',
  'block',
  'item',
  'visual',
  'term',
  'component',
  'element',
] as const;
export type TraceKind = (typeof TRACE_KINDS)[number];

export interface TraceNode {
  kind: TraceKind;
  id: string;
  label: string;
}

export interface TraceGraph {
  nodes: Map<string, TraceNode>;
  /** key → keys one step toward sources */
  up: Map<string, Set<string>>;
  /** key → keys one step toward the learner-facing course */
  down: Map<string, Set<string>>;
  /** Kinds whose home artifact was loaded (dangling refs are only reported for these). */
  loaded: Set<TraceKind>;
  dangling: { from: string; ref: string }[];
  duplicates: string[];
}

export const traceKey = (kind: TraceKind, id: string) => `${kind}:${id}`;

/* ---------------------------------------------------- tolerant input views */

const Ids = z.array(z.string()).optional();
const Cites = z.array(z.looseObject({ sourceId: z.string() })).optional();
const SourceView = z.looseObject({ id: z.string(), title: z.string().optional() });
const ClaimView = z.looseObject({
  id: z.string(),
  text: z.string().optional(),
  citations: Cites,
  sectionId: z.string().nullable().optional(),
});
const DossierView = z.looseObject({
  sections: z.array(z.looseObject({ sectionId: z.string(), title: z.string().optional(), claimIds: Ids, sourceIds: Ids })).optional(),
});
const DesignView = z.looseObject({
  objectives: z.array(z.looseObject({ id: z.string(), statement: z.string().optional(), claimIds: Ids, sourceIds: Ids })).optional(),
  modules: z.array(z.looseObject({ id: z.string(), title: z.string().optional(), loIds: Ids, sourceIds: Ids })).optional(),
});
const VisualView = z.looseObject({ id: z.string(), title: z.string().optional(), sourceIds: Ids });
const StoryboardView = z.looseObject({
  objectives: z.array(z.looseObject({ id: z.string(), text: z.string().optional() })).optional(),
  modules: z
    .array(
      z.looseObject({
        id: z.string(),
        title: z.string().optional(),
        loIds: Ids,
        blocks: z
          .array(
            z.looseObject({
              id: z.string(),
              kind: z.string().optional(),
              title: z.string().optional(),
              loIds: Ids,
              claimIds: Ids,
              citations: Cites,
              visualId: z.string().nullable().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  visuals: z.array(VisualView).optional(),
  glossary: z.array(z.looseObject({ id: z.string(), term: z.string().optional(), sourceIds: Ids })).optional(),
});
const ModelView = z.looseObject({ screens: z.array(z.looseObject({ id: z.string(), title: z.string().optional() })).optional() });

export interface TraceParts {
  sources?: z.infer<typeof SourceView>[];
  claims?: z.infer<typeof ClaimView>[];
  dossier?: z.infer<typeof DossierView>;
  design?: z.infer<typeof DesignView>;
  storyboard?: z.infer<typeof StoryboardView>;
  visuals?: z.infer<typeof VisualView>[];
  model?: z.infer<typeof ModelView>;
}

/* ------------------------------------------------------------------ build */

const ITEM_KINDS = new Set(['formative', 'graded']);

export function buildTraceGraphFromParts(parts: TraceParts): TraceGraph {
  const g: TraceGraph = { nodes: new Map(), up: new Map(), down: new Map(), loaded: new Set(), dangling: [], duplicates: [] };
  const seen = new Set<string>();
  const pending: { from: string; to: { kinds: TraceKind[]; id: string }; reverse: boolean }[] = [];

  const add = (kind: TraceKind, id: string, label?: string) => {
    const key = traceKey(kind, id);
    if (seen.has(key)) {
      if (!g.duplicates.includes(key)) g.duplicates.push(key);
      return key;
    }
    seen.add(key);
    g.nodes.set(key, { kind, id, label: label ?? id });
    return key;
  };
  /** `from` references `to`; `upstream` = the referenced node is closer to the sources. */
  const ref = (from: string, kinds: TraceKind[], id: string, upstream = true) =>
    pending.push({ from, to: { kinds, id: splitCitationToken(id).sourceId }, reverse: !upstream });
  const link = (upper: string, lower: string) => {
    if (!g.down.has(upper)) g.down.set(upper, new Set());
    if (!g.up.has(lower)) g.up.set(lower, new Set());
    g.down.get(upper)?.add(lower);
    g.up.get(lower)?.add(upper);
  };
  const markLoaded = (...kinds: TraceKind[]) => {
    for (const k of kinds) g.loaded.add(k);
  };

  if (parts.sources) {
    markLoaded('source');
    for (const s of parts.sources) add('source', s.id, s.title);
  }
  if (parts.claims) {
    markLoaded('claim');
    for (const c of parts.claims) {
      const k = add('claim', c.id, c.text);
      for (const cit of c.citations ?? []) ref(k, ['source'], cit.sourceId);
      if (c.sectionId) ref(k, ['section'], c.sectionId, false);
    }
  }
  if (parts.dossier?.sections) {
    markLoaded('section');
    for (const s of parts.dossier.sections) {
      const k = add('section', s.sectionId, s.title);
      for (const c of s.claimIds ?? []) ref(k, ['claim'], c);
      for (const src of s.sourceIds ?? []) ref(k, ['source'], src);
    }
  }
  if (parts.design) {
    if (parts.design.objectives) {
      markLoaded('lo');
      for (const lo of parts.design.objectives) {
        const k = add('lo', lo.id, lo.statement);
        for (const c of lo.claimIds ?? []) ref(k, ['claim'], c);
        for (const s of lo.sourceIds ?? []) ref(k, ['source'], s);
      }
    }
    if (parts.design.modules) {
      markLoaded('module');
      for (const m of parts.design.modules) {
        const k = add('module', m.id, m.title);
        for (const lo of m.loIds ?? []) ref(k, ['lo'], lo);
        for (const s of m.sourceIds ?? []) ref(k, ['source'], s);
      }
    }
  }
  const visuals = parts.visuals ?? parts.storyboard?.visuals;
  if (visuals) {
    markLoaded('visual');
    for (const v of visuals) {
      const k = add('visual', v.id, v.title);
      for (const s of v.sourceIds ?? []) ref(k, ['source'], s);
    }
  }
  const sb = parts.storyboard;
  if (sb) {
    markLoaded('block', 'item', 'term');
    if (!parts.design?.objectives) {
      markLoaded('lo');
      for (const o of sb.objectives ?? []) add('lo', o.id, o.text);
    }
    const designModules = parts.design?.modules !== undefined;
    markLoaded('module');
    for (const m of sb.modules ?? []) {
      // Modules defined by the design are shared with the storyboard, not duplicates.
      const mk = designModules && g.nodes.has(traceKey('module', m.id)) ? traceKey('module', m.id) : add('module', m.id, m.title);
      for (const lo of m.loIds ?? []) ref(mk, ['lo'], lo);
      for (const b of m.blocks ?? []) {
        const bk = add(ITEM_KINDS.has(b.kind ?? '') ? 'item' : 'block', b.id, b.title);
        link(mk, bk);
        for (const lo of b.loIds ?? []) ref(bk, ['lo'], lo);
        for (const c of b.claimIds ?? []) ref(bk, ['claim'], c);
        for (const c of b.citations ?? []) ref(bk, ['source'], c.sourceId);
        if (b.visualId) ref(bk, ['visual'], b.visualId);
      }
    }
    for (const t of sb.glossary ?? []) {
      const k = add('term', t.id, t.term);
      for (const s of t.sourceIds ?? []) ref(k, ['source'], s);
    }
  }
  if (parts.model?.screens) {
    markLoaded('component', 'element');
    for (const s of parts.model.screens) {
      const ck = add('component', `C-${s.id}`, s.title);
      const ek = add('element', `cf-${s.id}`, s.title);
      link(ck, ek);
      ref(ck, ['block', 'item'], s.id);
    }
  }

  for (const p of pending) {
    const target = p.to.kinds.map((k) => traceKey(k, p.to.id)).find((k) => g.nodes.has(k));
    if (target) {
      if (p.reverse) link(p.from, target);
      else link(target, p.from);
      continue;
    }
    const kind = p.to.kinds[0] as TraceKind;
    if (p.to.kinds.some((k) => g.loaded.has(k))) g.dangling.push({ from: p.from, ref: traceKey(kind, p.to.id) });
    else {
      // Home artifact not available: keep the reference as a stub node so traversal still works.
      const stub = add(kind, p.to.id, `${p.to.id} (unresolved)`);
      if (p.reverse) link(p.from, stub);
      else link(stub, p.from);
    }
  }
  return g;
}

function readJsonl(path: string): unknown[] {
  return readText(path)
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as unknown);
}

/** Builds the graph from whichever canonical artifacts exist in the course folder. */
export function buildTraceGraph(courseDir: string): TraceGraph {
  const p = (rel: string) => join(courseDir, rel);
  const json = (rel: string) => (exists(p(rel)) ? (JSON.parse(readText(p(rel))) as unknown) : undefined);
  const parts: TraceParts = {};
  if (exists(p(COURSE_FILES.sources))) parts.sources = z.array(SourceView).parse(readJsonl(p(COURSE_FILES.sources)));
  if (exists(p(COURSE_FILES.claims))) parts.claims = z.array(ClaimView).parse(readJsonl(p(COURSE_FILES.claims)));
  const dossier = json(COURSE_FILES.dossierJson);
  if (dossier !== undefined) parts.dossier = DossierView.parse(dossier);
  const design = json(COURSE_FILES.designJson);
  if (design !== undefined) parts.design = DesignView.parse(design);
  const sb = json(COURSE_FILES.storyboardEditedJson) ?? json(COURSE_FILES.storyboardJson);
  if (sb !== undefined) parts.storyboard = StoryboardView.parse(sb);
  const specs = json(COURSE_FILES.visualSpecs);
  if (specs !== undefined) {
    const list = Array.isArray(specs) ? specs : z.looseObject({ visuals: z.array(z.unknown()) }).parse(specs).visuals;
    parts.visuals = z.array(VisualView).parse(list);
  }
  const model = json(COURSE_FILES.courseModel);
  if (model !== undefined) parts.model = ModelView.parse(model);
  return buildTraceGraphFromParts(parts);
}

/* ------------------------------------------------------------- traversal */

/** Resolves `kind:id` or a bare ID (must be unique across kinds). */
export function resolveTraceKey(graph: TraceGraph, keyOrId: string): string {
  if (graph.nodes.has(keyOrId)) return keyOrId;
  const hits = [...graph.nodes.values()].filter((n) => n.id === keyOrId).map((n) => traceKey(n.kind, n.id));
  if (hits.length === 1) return hits[0] as string;
  if (hits.length === 0) throw usageError(`Trace: no node with id "${keyOrId}"`);
  throw usageError(`Trace: id "${keyOrId}" is ambiguous (${hits.join(', ')}); use kind:id`);
}

export interface TraceResult {
  root: string;
  direction: 'up' | 'down';
  nodes: (TraceNode & { key: string; depth: number })[];
}

/** Breadth-first walk from a node (excluding the root) up to `depth` steps. */
export function trace(graph: TraceGraph, keyOrId: string, direction: 'up' | 'down', depth = Number.POSITIVE_INFINITY): TraceResult {
  const root = resolveTraceKey(graph, keyOrId);
  const edges = direction === 'up' ? graph.up : graph.down;
  const out: TraceResult['nodes'] = [];
  const visited = new Set([root]);
  let frontier = [root];
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next: string[] = [];
    for (const k of frontier) {
      for (const n of [...(edges.get(k) ?? [])].sort()) {
        if (visited.has(n)) continue;
        visited.add(n);
        next.push(n);
        const node = graph.nodes.get(n);
        if (node) out.push({ ...node, key: n, depth: d });
      }
    }
    frontier = next;
  }
  return { root, direction, nodes: out };
}

const KIND_STAGES: Record<TraceKind, Stage[]> = {
  source: ['RESEARCH_DOSSIER'],
  claim: ['RESEARCH_DOSSIER'],
  section: ['RESEARCH_DOSSIER'],
  lo: ['INSTRUCTIONAL_DESIGN'],
  module: ['INSTRUCTIONAL_DESIGN', 'STORYBOARD'],
  block: ['STORYBOARD', 'EDITORIAL'],
  item: ['STORYBOARD', 'EDITORIAL'],
  term: ['STORYBOARD', 'EDITORIAL'],
  visual: ['VISUAL_DIRECTION'],
  component: ['COURSE_MODEL'],
  element: ['COURSE_BUILD'],
};

/** Everything downstream of the changed nodes (inclusive) and the stages owning those nodes, in pipeline order. */
export function impact(graph: TraceGraph, changed: string[]): { nodes: string[]; stages: Stage[] } {
  const all = new Set<string>();
  for (const c of changed) {
    const root = resolveTraceKey(graph, c);
    all.add(root);
    for (const n of trace(graph, root, 'down').nodes) all.add(n.key);
  }
  const stages = new Set<Stage>();
  for (const k of all) {
    const node = graph.nodes.get(k);
    if (node) for (const s of KIND_STAGES[node.kind]) stages.add(s);
  }
  return { nodes: [...all].sort(), stages: STAGES.filter((s) => stages.has(s)) };
}

/* ---------------------------------------------------------------- issues */

export type TraceIssueCode =
  | 'TRACE-ORPHAN-LO'
  | 'TRACE-UNASSESSED-LO'
  | 'TRACE-UNTAUGHT-ITEM'
  | 'TRACE-UNCITED-CLAIM'
  | 'TRACE-DANGLING-REF'
  | 'TRACE-DUP-ID'
  | 'TRACE-UNUSED-SOURCE';

export interface TraceIssue {
  code: TraceIssueCode;
  id: string;
  detail: string;
  severity: Severity;
}

const ofKind = (graph: TraceGraph, kind: TraceKind) => [...graph.nodes.entries()].filter(([, n]) => n.kind === kind).map(([k]) => k);
const neighbours = (edges: Map<string, Set<string>>, graph: TraceGraph, key: string, kind: TraceKind) =>
  [...(edges.get(key) ?? [])].filter((k) => graph.nodes.get(k)?.kind === kind);

export function traceIssues(graph: TraceGraph): TraceIssue[] {
  const issues: TraceIssue[] = [];
  const idOf = (k: string) => graph.nodes.get(k)?.id ?? k;
  const storyboardLoaded = graph.loaded.has('block');

  for (const d of graph.dangling) {
    issues.push({ code: 'TRACE-DANGLING-REF', id: d.ref, detail: `${d.from} references missing ${d.ref}`, severity: 'critical' });
  }
  for (const k of graph.duplicates)
    issues.push({ code: 'TRACE-DUP-ID', id: idOf(k), detail: `${k} is defined more than once`, severity: 'major' });

  if (storyboardLoaded) {
    for (const lo of ofKind(graph, 'lo')) {
      const blocks = neighbours(graph.down, graph, lo, 'block');
      const items = neighbours(graph.down, graph, lo, 'item');
      if (!blocks.length && !items.length) {
        issues.push({ code: 'TRACE-ORPHAN-LO', id: idOf(lo), detail: `${lo} is not taught or assessed by any block`, severity: 'major' });
      } else if (!items.length) {
        issues.push({ code: 'TRACE-UNASSESSED-LO', id: idOf(lo), detail: `${lo} has no formative or graded item`, severity: 'major' });
      }
    }
    for (const item of ofKind(graph, 'item')) {
      const los = neighbours(graph.up, graph, item, 'lo');
      const untaught = los.filter((lo) => !neighbours(graph.down, graph, lo, 'block').length);
      if (!los.length)
        issues.push({ code: 'TRACE-UNTAUGHT-ITEM', id: idOf(item), detail: `${item} is not mapped to any objective`, severity: 'major' });
      else if (untaught.length) {
        issues.push({
          code: 'TRACE-UNTAUGHT-ITEM',
          id: idOf(item),
          detail: `${item} assesses untaught ${untaught.join(', ')}`,
          severity: 'major',
        });
      }
    }
  }
  if (graph.loaded.has('source')) {
    for (const c of ofKind(graph, 'claim')) {
      if (!neighbours(graph.up, graph, c, 'source').length) {
        issues.push({ code: 'TRACE-UNCITED-CLAIM', id: idOf(c), detail: `${c} cites no source`, severity: 'major' });
      }
    }
    for (const s of ofKind(graph, 'source')) {
      if (!graph.down.get(s)?.size)
        issues.push({ code: 'TRACE-UNUSED-SOURCE', id: idOf(s), detail: `${s} is never cited`, severity: 'minor' });
    }
  }
  return issues;
}

export interface TraceSummary {
  nodes: Partial<Record<TraceKind, number>>;
  objectives: number;
  assessedObjectives: number;
  unassessed: string[];
  dangling: string[];
  sourcesCited: number;
}

export function traceSummary(graph: TraceGraph): TraceSummary {
  const nodes: Partial<Record<TraceKind, number>> = {};
  for (const n of graph.nodes.values()) nodes[n.kind] = (nodes[n.kind] ?? 0) + 1;
  const los = ofKind(graph, 'lo');
  const unassessed = los.filter((lo) => !neighbours(graph.down, graph, lo, 'item').length).map((k) => graph.nodes.get(k)?.id ?? k);
  return {
    nodes,
    objectives: los.length,
    assessedObjectives: los.length - unassessed.length,
    unassessed,
    dangling: [...new Set(graph.dangling.map((d) => d.ref))],
    sourcesCited: ofKind(graph, 'source').filter((s) => graph.down.get(s)?.size).length,
  };
}
