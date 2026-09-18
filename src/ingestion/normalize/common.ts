/** Mapping heuristics shared by the Markdown and HTML normalisers. All deterministic. */
import { BLOCK_KINDS, type BlockKind, type SourceType, type VisualArchetype } from '../../core/enums.js';
import type { Interaction, SourceRecord, VisualContent, VisualSpec } from '../../core/schemas/content.js';
import { parseCitationCell, stripMd, uniq } from '../util.js';

/* ------------------------------------------------------------------ block kinds */

const KIND_ALIASES: Record<string, BlockKind> = {
  'course review': 'review',
  'technical depth': 'technical-depth',
  'knowledge check': 'formative',
  'graded assessment': 'graded',
  'formative self-assessment': 'formative',
};

/** Storyboard `Type` column → BlockKind; unknown types become `content` (the caller keeps the original as subtype). */
export function blockKindFor(type: string): { kind: BlockKind; known: boolean } {
  const t = type.trim().toLowerCase();
  const alias = KIND_ALIASES[t];
  if (alias) return { kind: alias, known: true };
  const dashed = t.replace(/\s+/g, '-') as BlockKind;
  if ((BLOCK_KINDS as readonly string[]).includes(dashed)) return { kind: dashed, known: true };
  return { kind: 'content', known: false };
}

export function moduleRole(index: number, title: string, kinds: BlockKind[]): 'intro' | 'topic' | 'review' | 'graded' {
  if (kinds.includes('graded')) return 'graded';
  if (/review/i.test(title) || kinds.every((k) => k === 'review')) return 'review';
  return index === 0 ? 'intro' : 'topic';
}

/* ------------------------------------------------------------------ sources */

const PEOPLE = /^[A-Z][a-zA-Z'-]+ [A-Z]{1,3}(?:-[A-Z])?(?:,|$)/;

// ponytail: keyword heuristic for source type/jurisdiction; the research reviewers correct edge cases.
export function sourceTypeFor(text: string): SourceType {
  const t = text.toLowerCase();
  if (/pubmed|doi\.org|journal|\bbmc\b|systematic review|peer-reviewed/.test(t)) return 'peer-reviewed';
  if (/\bregulations?\b|\bsor\/|ohs code|\bcode\b.*\bpart\b|\bpart \d+\b/.test(t)) return 'regulation';
  if (/\bact\b|statute|legislation/.test(t)) return 'legislation';
  if (/\biso\b|standard|\bghs\b/.test(t)) return 'standard';
  if (/government|health canada|alberta|ccohs|canadian centre|ministry|agency|\.gc\.ca|canada\.ca|alberta\.ca/.test(t))
    return 'government-guidance';
  if (/world health|who\b|unece|united nations|organization|association/.test(t)) return 'organization';
  return 'other';
}

export function toSourceRecord(r: {
  id: string;
  issuer?: string | null;
  title: string;
  date?: string | null;
  url?: string | null;
  hint?: string;
}): SourceRecord {
  const issuer = r.issuer?.trim() || null;
  const blob = [r.hint ?? '', issuer ?? '', r.title, r.url ?? '', r.date ?? ''].join(' ');
  const type = sourceTypeFor(blob);
  const url = r.url ? (/https?:\/\/\S+/.exec(r.url)?.[0] ?? null) : null;
  const doi = /\b10\.\d{4,9}\/\S+/.exec(`${r.url ?? ''} ${r.date ?? ''}`)?.[0] ?? null;
  const accessed = /accessed\s+([^;.]+(?:\.\s*\d{4})?)/i.exec(r.date ?? '')?.[1]?.trim() ?? null;
  const person = issuer !== null && PEOPLE.test(issuer);
  return {
    id: r.id,
    title: stripMd(r.title),
    author: person ? issuer : null,
    publisher: person ? null : issuer,
    type,
    url,
    doi,
    date: r.date?.trim() || null,
    version: null,
    accessed,
    jurisdiction: /alberta/i.test(blob) ? 'Alberta, Canada' : /canad|\.gc\.ca/i.test(blob) ? 'Canada' : null,
    authority: ['legislation', 'regulation', 'standard'].includes(type) ? 'primary' : type === 'other' ? 'tertiary' : 'secondary',
    currentnessNotes: r.date?.trim() || null,
    licenseNotes: null,
  };
}

/* ------------------------------------------------------------------ visuals */

const ARCHETYPE_RULES: [RegExp, VisualArchetype][] = [
  [/responsib|roles?\b|who does/, 'RESPONSIBILITY_MAP'],
  [/hierarch|pyramid|\blevels?\b|priorit/, 'HIERARCHY'],
  [/layer/, 'LAYERED_SYSTEM'],
  [/life ?cycle/, 'LIFECYCLE'],
  [/\bloop\b|\bcycle\b|feedback/, 'FEEDBACK_LOOP'],
  [/timeline|chronolog|\bstages\b/, 'TIMELINE'],
  [/decision tree|decision|questions?\b.*sequence/, 'DECISION_TREE'],
  [/matrix|quadrant|\bgrid\b/, 'MATRIX'],
  [/cause|factor|fishbone|wheel/, 'CAUSE_EFFECT'],
  [/funnel/, 'FUNNEL'],
  [/continuum|spectrum|\bscale\b/, 'CONTINUUM'],
  [/before.*after/, 'BEFORE_AFTER'],
  [/versus|\bvs\.?\b|compar|two columns|distinguish|separate/, 'COMPARISON'],
  [/shelf|schematic|hood|anatomy|labell?ed (object|diagram)/, 'LABELED_OBJECT'],
  [/chart|graph|trend|\brate\b|percentage/, 'QUANTITATIVE_CHART'],
  [/evidence|source authority/, 'EVIDENCE_MAP'],
  [/network|relationship/, 'RELATIONSHIP_NETWORK'],
  [/scenario|case/, 'SCENARIO_MAP'],
  [/architecture|system component/, 'SYSTEM_ARCHITECTURE'],
];

/**
 * Keyword heuristic: the purpose decides first; otherwise an arrow chain in the content means PROCESS, else the
 * content keywords decide; default PROCESS. The VISUAL_DIRECTION classifier may override.
 */
export function chooseArchetype(purpose: string, content = ''): VisualArchetype {
  const rule = (t: string) => ARCHETYPE_RULES.find(([re]) => re.test(t.toLowerCase()))?.[1];
  return rule(purpose) ?? (content.includes('→') ? 'PROCESS' : (rule(content) ?? 'PROCESS'));
}

/** `Alt text must…`, `Create original…`: an instruction to authors, not a description for learners. */
export const isAuthoringInstruction = (s: string): boolean =>
  /^(alt text|alternative text|text alternative|create|provide|include|describe|use|add|ensure|write)\b/i.test(s.trim()) ||
  /\bmust (state|list|describe|define|repeat|provide)\b/i.test(s);

const SEQUENTIAL: VisualArchetype[] = ['PROCESS', 'LIFECYCLE', 'TIMELINE', 'FEEDBACK_LOOP', 'DECISION_TREE', 'HIERARCHY', 'FUNNEL'];

export function visualContentFrom(content: string, archetype: VisualArchetype): VisualContent {
  const body = content.replace(/^[^:]{0,60}:\s*/, '');
  const parts = (body.includes('→') ? body.split('→') : body.split(/[,;]|\bversus\b|\bvs\.?\b/i))
    .map((p) => stripMd(p).replace(/\.$/, '').trim())
    .filter(Boolean);
  const items = parts.map((label, i) => ({ id: `n${i + 1}`, label, detail: null, group: null, value: null }));
  const links = SEQUENTIAL.includes(archetype)
    ? items.slice(1).map((it, i) => ({ from: items[i]?.id ?? 'n1', to: it.id, label: null }))
    : [];
  if (archetype === 'FEEDBACK_LOOP' && items.length > 2) links.push({ from: items[items.length - 1]?.id ?? 'n1', to: 'n1', label: null });
  return { items, links, groups: [], columns: [], rows: [], axes: { x: null, y: null }, chartType: null };
}

export function toVisualSpec(
  v: { id: string; purpose: string; content: string; sources: string; alt: string; note?: string },
  warnings: string[],
): VisualSpec {
  const purpose = stripMd(v.purpose) || v.id;
  const content = stripMd(v.content);
  const archetype = chooseArchetype(purpose, content);
  const cited = parseCitationCell(v.sources);
  let long = stripMd(v.alt);
  let fullPurpose = purpose;
  if (!long || isAuthoringInstruction(long)) {
    warnings.push(`${v.id}: accessibility text is an authoring instruction ("${long}"); built a text equivalent from the visual content`);
    fullPurpose = `${purpose}. Accessibility requirement: ${long || 'none given'}`;
    long = `${purpose}: ${content}${/[.!?]$/.test(content) ? '' : '.'}`;
  }
  if (v.note && !isAuthoringInstruction(v.note)) fullPurpose += ` (${stripMd(v.note)})`;
  return {
    id: v.id,
    title: purpose,
    purpose: fullPurpose,
    archetype,
    content: visualContentFrom(content, archetype),
    sourceIds: uniq(cited.citations.map((c) => c.sourceId)),
    textEquivalent: { short: purpose.length >= 3 ? purpose : `Figure ${v.id}`, long: long.length >= 10 ? long : `${purpose}: ${content}` },
    interaction: 'none',
    rendererOverride: null,
    mermaid: null,
  };
}

/* ------------------------------------------------------------------ interactions */

export interface Keyed {
  key: string;
  text: string;
}

/** `A. …<br>B. …` / `1. …` lines, or a `;`-separated list (sequencing items) keyed 1…n. */
export function parseOptions(raw: string): Keyed[] {
  const lines = raw
    .split(/<br\s*\/?>|\n/i)
    .map((l) => l.trim())
    .filter(Boolean);
  const keyed = lines.map((l) => /^([A-Z]|\d{1,2})[.)]\s+(.*)$/.exec(l));
  if (keyed.length && keyed.every(Boolean)) return keyed.map((m) => ({ key: m?.[1] ?? '', text: stripMd(m?.[2] ?? '') }));
  const parts = raw
    .replace(/<br\s*\/?>/gi, ';')
    .split(';')
    .map((p) => stripMd(p).replace(/\.$/, '').trim())
    .filter(Boolean);
  return parts.map((text, i) => ({ key: String(i + 1), text }));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const acronym = (s: string) =>
  norm(s)
    .split(' ')
    .map((w) => w[0])
    .join('');

/** Best unused option for a free-text step (exact → prefix → acronym → word overlap). */
function matchOption(step: string, options: Keyed[], used: Set<string>): Keyed | null {
  const s = norm(step);
  let best: Keyed | null = null;
  let bestScore = 0;
  for (const o of options) {
    if (used.has(o.key)) continue;
    const t = norm(o.text);
    let score = 0;
    if (t === s) score = 4;
    else if (t.startsWith(s) || s.startsWith(t)) score = 3;
    else if (acronym(o.text) === s.replace(/ /g, '')) score = 2.5;
    else {
      const a = new Set(s.split(' '));
      const b = t.split(' ');
      score = (2 * b.filter((w) => a.has(w)).length) / (a.size + b.length);
    }
    if (score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return bestScore >= 0.3 ? best : null;
}

const emptyInteraction = (): Interaction => ({
  mode: 'single',
  stem: '',
  options: [],
  targets: [],
  correctKeys: [],
  mapping: [],
  order: [],
  feedbackCorrect: '',
  feedbackIncorrect: '',
  optionFeedback: [],
  rationale: '',
});

function targetsFrom(values: string[], prefix: string): { targets: Keyed[]; keyOf: (v: string) => string } {
  const labels = uniq(values.map((v) => v.trim()));
  const targets = labels.map((text, i) => ({ key: `${prefix}${i + 1}`, text }));
  return { targets, keyOf: (v) => targets.find((t) => t.text === v.trim())?.key ?? '' };
}

/**
 * Parses the prose `Correct answer` cell into a typed interaction key. The answer shape wins over the item-type label
 * (e.g. a "categorization" item answered `B` is a single choice).
 */
export function parseAnswer(itemType: string, optionsRaw: string, correctRaw: string): { interaction: Interaction; warnings: string[] } {
  const warnings: string[] = [];
  const it = emptyInteraction();
  const options = parseOptions(optionsRaw);
  const correct = stripMd(correctRaw.replace(/<br\s*\/?>/gi, ' ')).trim();
  const keys = new Set(options.map((o) => o.key));
  const type = itemType.toLowerCase();
  const categorize = /categor|classif|sort/.test(type);
  it.options = options;

  // Letter lists: `B`, `A, B, C, D, and E`, `A, B, C, D, and E. A–C are explicit …`
  const lead = /^([A-Z](?:\s*(?:,|and|&)\s*(?:and\s+)?[A-Z])*)(?=$|[\s.;:])/.exec(correct)?.[1];
  const letters = lead ? lead.split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean) : [];
  if (letters.length && letters.every((l) => keys.has(l))) {
    it.mode = letters.length === 1 && !/multiple response|select all|multi-select/.test(type) ? 'single' : 'multiple';
    it.correctKeys = uniq(letters);
    return { interaction: it, warnings };
  }

  // Numbered mapping: `1 → Federal supplier side; 2 → …` / `1 Correction; 2 Containment; …`
  const pairs = [...correct.matchAll(/(?:^|;)\s*(\d+)\s*(?:→|->|:|\s)\s*([^;]+)/g)].map((m) => ({
    key: m[1] ?? '',
    value: (m[2] ?? '').replace(/\.$/, '').trim(),
  }));
  if (pairs.length >= 2 && pairs.every((p) => keys.has(p.key)) && (correct.includes('→') || correct.includes(';'))) {
    it.mode = categorize ? 'categorization' : 'matching';
    const { targets, keyOf } = targetsFrom(
      pairs.map((p) => p.value),
      categorize ? 'C' : 'T',
    );
    it.targets = targets;
    it.mapping = pairs.map((p) => ({ key: p.key, target: keyOf(p.value) }));
    return { interaction: it, warnings };
  }

  // Category lists: `Leading: 1, 3, 5. Lagging: 2, 4.` / `Evidence/observation: 1 and 3. Interpretation…: 2 and 4.`
  const groups = correct
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => /^(.+?):\s*((?:\d+\s*(?:,|and|&)?\s*)+)\.?$/.exec(s.trim()))
    .filter((m): m is RegExpExecArray => m !== null);
  if (groups.length >= 2) {
    const { targets, keyOf } = targetsFrom(
      groups.map((g) => g[1] ?? ''),
      'C',
    );
    const mapping = groups.flatMap((g) => (g[2]?.match(/\d+/g) ?? []).map((k) => ({ key: k, target: keyOf(g[1] ?? '') })));
    if (mapping.every((m) => keys.has(m.key))) {
      it.mode = 'categorization';
      it.targets = targets;
      it.mapping = mapping.sort((a, b) => Number(a.key) - Number(b.key));
      return { interaction: it, warnings };
    }
  }

  // Arrow sequences: `Elimination → Substitution → Engineering → Administrative → PPE.`
  if (correct.includes('→')) {
    const steps = correct
      .split('→')
      .map((s) => s.replace(/\.$/, '').trim())
      .filter(Boolean);
    const used = new Set<string>();
    const order = steps.map((s) => {
      const o = matchOption(s, options, used);
      if (o) used.add(o.key);
      return o?.key ?? null;
    });
    if (order.every((k) => k !== null) && order.length === options.length) {
      it.mode = 'sequencing';
      it.order = order as string[];
      return { interaction: it, warnings };
    }
    warnings.push(`sequence steps could not all be matched to options: "${correct}"`);
  }

  warnings.push(`unparsed correct answer for ${itemType || 'item'}: "${correct}"`);
  return { interaction: it, warnings };
}

/** `A: …` lines in an incorrect-feedback cell → per-option feedback. */
export function optionFeedbackFrom(raw: string, keys: string[]): Keyed[] {
  return raw
    .split(/<br\s*\/?>|\n/i)
    .map((l) => /^([A-Z]|\d{1,2})\s*[:.]\s+(.*)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => m !== null && keys.includes(m[1] ?? ''))
    .map((m) => ({ key: m[1] ?? '', text: stripMd(m[2] ?? '') }));
}

/** True when the interaction's key fields are consistent with its mode (used by validators and tests). */
export function interactionKeysConsistent(i: Interaction): boolean {
  const opt = new Set(i.options.map((o) => o.key));
  const tgt = new Set(i.targets.map((t) => t.key));
  switch (i.mode) {
    case 'single':
      return i.correctKeys.length === 1 && opt.has(i.correctKeys[0] ?? '');
    case 'multiple':
      return i.correctKeys.length >= 1 && i.correctKeys.every((k) => opt.has(k));
    case 'matching':
    case 'categorization':
      return i.mapping.length === i.options.length && i.mapping.every((m) => opt.has(m.key) && tgt.has(m.target));
    case 'sequencing':
      return i.order.length === i.options.length && new Set(i.order).size === i.order.length && i.order.every((k) => opt.has(k));
    case 'reveal':
      return true;
  }
}
