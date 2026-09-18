/**
 * EDITORIAL guards: structural identity between the storyboard and its edited version, and a polarity /
 * number guard over edited prose. The polarity guard exists because the reference example's humanised
 * storyboard silently inverted "…not only the product classification" into "…the product classification alone".
 */
import { canonicalJson } from '../../core/hash.js';
import type { Block, Storyboard } from '../../core/schemas/index.js';
import type { Issue } from './content.js';

/** Everything except editable prose must be identical. */
function structuralView(b: Block): unknown {
  const i = b.interaction;
  return {
    id: b.id,
    kind: b.kind,
    subtype: b.subtype,
    optional: b.optional,
    loIds: b.loIds,
    citations: b.citations,
    claimIds: b.claimIds,
    visualId: b.visualId,
    difficulty: b.difficulty,
    interaction: i
      ? {
          mode: i.mode,
          options: i.options.map((o) => o.key),
          targets: i.targets.map((t) => t.key),
          correctKeys: i.correctKeys,
          mapping: i.mapping,
          order: i.order,
          optionFeedback: i.optionFeedback.map((o) => o.key),
        }
      : null,
  };
}

export function editorialStructureIssues(before: Storyboard, after: Storyboard): Issue[] {
  const out: Issue[] = [];
  const push = (location: string, problem: string) =>
    out.push({
      checkId: 'editorial-structure',
      severity: 'critical',
      category: 'structure',
      location,
      problem,
      recommendedAction: 'Editorial changes may only alter prose; restore the original structure.',
      evidence: [],
    });
  const bm = before.modules.map((m) => m.id).join(',');
  const am = after.modules.map((m) => m.id).join(',');
  if (bm !== am) push('global', `Module list changed (${bm} → ${am})`);
  const afterBlocks = new Map(after.modules.flatMap((m) => m.blocks).map((b) => [b.id, b]));
  const beforeIds = before.modules.flatMap((m) => m.blocks.map((b) => b.id));
  const afterIds = after.modules.flatMap((m) => m.blocks.map((b) => b.id));
  if (beforeIds.join(',') !== afterIds.join(',')) push('global', 'Block IDs or order changed');
  for (const m of before.modules)
    for (const b of m.blocks) {
      const a = afterBlocks.get(b.id);
      if (!a) continue;
      if (canonicalJson(structuralView(b)) !== canonicalJson(structuralView(a)))
        push(b.id, 'Structural fields changed (kind, objectives, citations, visual, or answer key)');
    }
  for (const key of ['objectives', 'glossary', 'acronyms', 'references', 'visuals'] as const) {
    if (canonicalJson(before[key]) !== canonicalJson(after[key])) push('global', `${key} changed during editorial pass`);
  }
  return out;
}

const POLARITY = [
  'not only',
  'rather than',
  'not',
  'no',
  'never',
  'unless',
  'except',
  'only',
  'without',
  'cannot',
  "can't",
  "don't",
  "doesn't",
  "isn't",
  "aren't",
  "won't",
  'must not',
  'should not',
  'do not',
  'does not',
  'is not',
  'are not',
  'neither',
  'nor',
  'but',
  'however',
  'although',
];

function countPhrase(text: string, phrase: string): number {
  const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")}\\b`, 'gi');
  return text.match(re)?.length ?? 0;
}

function numbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?%?/g) ?? []).sort();
}

export interface TextPair {
  location: string;
  field: string;
  before: string;
  after: string;
}

export function editedTextPairs(before: Storyboard, after: Storyboard): TextPair[] {
  const out: TextPair[] = [];
  const afterBlocks = new Map(after.modules.flatMap((m) => m.blocks).map((b) => [b.id, b]));
  for (const b of before.modules.flatMap((m) => m.blocks)) {
    const a = afterBlocks.get(b.id);
    if (!a) continue;
    const add = (field: string, x: string, y: string) => {
      if (x !== y) out.push({ location: b.id, field, before: x, after: y });
    };
    add('title', b.title, a.title);
    add('body', b.body, a.body);
    if (b.interaction && a.interaction) {
      const i = b.interaction;
      const j = a.interaction;
      add('stem', i.stem, j.stem);
      add('feedbackCorrect', i.feedbackCorrect, j.feedbackCorrect);
      add('feedbackIncorrect', i.feedbackIncorrect, j.feedbackIncorrect);
      add('rationale', i.rationale, j.rationale);
      for (const [k, o] of i.options.entries()) add(`option:${o.key}`, o.text, j.options[k]?.text ?? '');
      for (const [k, o] of i.optionFeedback.entries()) add(`optionFeedback:${o.key}`, o.text, j.optionFeedback[k]?.text ?? '');
    }
  }
  return out;
}

export function polarityIssues(pairs: readonly TextPair[]): Issue[] {
  const out: Issue[] = [];
  for (const p of pairs) {
    const lost = POLARITY.filter((ph) => countPhrase(p.before, ph) > countPhrase(p.after, ph));
    // "not only" is the high-signal case: flag even when a bare "not" remains elsewhere.
    const significant = lost.filter((ph) => !['but', 'however', 'although', 'only'].includes(ph) || lost.includes('not only'));
    if (significant.length) {
      out.push({
        checkId: 'editorial-polarity',
        severity: 'major',
        category: 'accuracy',
        location: p.location,
        problem: `Editorial edit of ${p.field} removed negation/contrast wording (${significant.join(', ')}); meaning may have changed`,
        recommendedAction: 'Confirm the edited sentence says the same thing; restore the negation/contrast if meaning changed.',
        evidence: [`before: ${p.before.slice(0, 240)}`, `after: ${p.after.slice(0, 240)}`],
      });
    }
    const nb = numbers(p.before).join(' ');
    const na = numbers(p.after).join(' ');
    if (nb !== na)
      out.push({
        checkId: 'editorial-polarity',
        severity: 'critical',
        category: 'accuracy',
        location: p.location,
        problem: `Editorial edit of ${p.field} changed numbers (${nb || 'none'} → ${na || 'none'})`,
        recommendedAction: 'Editorial passes must not change figures; restore the original values.',
        evidence: [`before: ${p.before.slice(0, 240)}`, `after: ${p.after.slice(0, 240)}`],
      });
  }
  return out;
}
