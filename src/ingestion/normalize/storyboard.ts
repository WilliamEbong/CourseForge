/** Markdown storyboard (the example's 10-column block / item tables + appendices) → canonical `Storyboard`. */
import { DIFFICULTIES } from '../../core/enums.js';
import { parseWith } from '../../core/fsx.js';
import type { Acronym, Block, GlossaryEntry, SourceRecord, Storyboard, VisualSpec } from '../../core/schemas/content.js';
import { StoryboardSchema } from '../../core/schemas/content.js';
import type { DocTable, NormalizedDocument } from '../types.js';
import { brToNewline, expandLoRefs, parseCitationCell, sectionText, stripMd, uniq } from '../util.js';
import { blockKindFor, moduleRole, optionFeedbackFrom, parseAnswer, toSourceRecord, toVisualSpec } from './common.js';

export interface StoryboardImport {
  storyboard: Storyboard;
  warnings: string[];
  counts: Record<string, number>;
}

/** Column index by header name: exact match, then prefix, then substring. */
export function col(header: string[], name: string): number {
  const h = header.map((x) => stripMd(x).toLowerCase());
  const i = h.indexOf(name);
  if (i !== -1) return i;
  const p = h.findIndex((x) => x.startsWith(name));
  return p !== -1 ? p : h.findIndex((x) => x.includes(name));
}

const cell = (t: DocTable, row: string[], name: string): string => {
  const i = col(t.header, name);
  return i === -1 ? '' : (row[i] ?? '').trim();
};

/** `Topic 4: When something goes wrong: …` / `Section 1 — Course introduction` → the descriptive part. */
export function moduleTitleFrom(heading: string): string {
  const m = /^(?:section|topic|module|part|unit)\s+[\w.]+\s*(?:—|–|:|-)\s*(.+)$/i.exec(heading.trim());
  return stripMd(m?.[1] ?? heading);
}

const modulePrefix = (id: string): string => id.replace(/-[0-9]+[a-z]?$/i, '');

export function storyboardFromMarkdown(doc: NormalizedDocument, opts: { courseId: string }): StoryboardImport {
  const warnings: string[] = [];
  const modules = new Map<string, { title: string; blocks: Block[] }>();
  const metadata = new Map<string, string>();
  const glossary: GlossaryEntry[] = [];
  const acronyms: Acronym[] = [];
  const references: SourceRecord[] = [];
  const visualRows: { id: string; blocks: string; spec: VisualSpec }[] = [];
  const appendixObjectives: { id: string; text: string }[] = [];
  const internalRefs = new Set<string>();
  let lastContentModule: string | null = null;

  const headingBefore = (line: number, re?: RegExp) =>
    [...doc.headings].reverse().find((h) => h.line < line && (!re || re.test(h.text)))?.text ?? '';
  const moduleFor = (key: string, line: number) => {
    let m = modules.get(key);
    if (!m) {
      m = { title: moduleTitleFrom(headingBefore(line, /\s(—|–)\s|:\s/) || key), blocks: [] };
      modules.set(key, m);
    }
    return m;
  };

  for (const t of doc.tables) {
    const first = stripMd(t.header[0] ?? '').toLowerCase();
    if (first === 'metadata field') {
      for (const r of t.rows) metadata.set(stripMd(r[0] ?? ''), r[1] ?? '');
    } else if (first === 'block id') {
      for (const r of t.rows) {
        const block = contentBlock(t, r, internalRefs);
        if (!block) continue;
        const key = modulePrefix(block.id);
        lastContentModule = key;
        moduleFor(key, t.line).blocks.push(block);
      }
    } else if (first === 'item id' || first === 'assessment item id') {
      const graded = first === 'assessment item id';
      for (const r of t.rows) {
        const block = itemBlock(t, r, graded, warnings, internalRefs);
        if (!block) continue;
        const key = graded || !lastContentModule ? modulePrefix(block.id) : lastContentModule;
        moduleFor(key, t.line).blocks.push(block);
      }
    } else if (first === 'term') {
      for (const r of t.rows) {
        const cites = parseCitationCell(r[2] ?? '');
        glossary.push({
          id: `GL-${String(glossary.length + 1).padStart(3, '0')}`,
          term: stripMd(r[0] ?? ''),
          definition: brToNewline(r[1] ?? ''),
          sourceIds: uniq(cites.citations.map((c) => c.sourceId)),
        });
      }
    } else if (first === 'acronym') {
      for (const r of t.rows)
        acronyms.push({
          id: `ACR-${String(acronyms.length + 1).padStart(3, '0')}`,
          acronym: stripMd(r[0] ?? ''),
          expansion: stripMd(r[1] ?? ''),
          firstUseBlockId: stripMd(r[2] ?? '') || null,
        });
    } else if (first === 'id' && col(t.header, 'title') !== -1) {
      const hint = headingBefore(t.line);
      for (const r of t.rows) {
        const id = stripMd(cell(t, r, 'id'));
        if (!id) continue;
        references.push(
          toSourceRecord({
            id,
            issuer: cell(t, r, 'issuer'),
            title: cell(t, r, 'title'),
            date: cell(t, r, 'date'),
            url: cell(t, r, 'url'),
            hint,
          }),
        );
      }
    } else if (first === 'visual id') {
      for (const r of t.rows) {
        const id = stripMd(r[0] ?? '');
        if (!id) continue;
        const spec = toVisualSpec(
          {
            id,
            purpose: cell(t, r, 'learning purpose') || cell(t, r, 'purpose'),
            content: cell(t, r, 'content'),
            sources: cell(t, r, 'source'),
            alt: cell(t, r, 'accessibility'),
            note: cell(t, r, 'production note'),
          },
          warnings,
        );
        visualRows.push({ id, blocks: cell(t, r, 'block id'), spec });
      }
    } else if (first.startsWith('learning objective')) {
      for (const r of t.rows) {
        const m = /^(LO\d+)\s*(?:—|–|-|:)?\s*(.*)$/.exec(stripMd(r[0] ?? ''));
        if (m?.[1]) appendixObjectives.push({ id: m[1], text: m[2] ?? '' });
      }
    }
  }

  // Link visuals to the blocks named in the inventory (first visual wins per block).
  const allBlocks = [...modules.values()].flatMap((m) => m.blocks);
  const byId = new Map(allBlocks.map((b) => [b.id, b]));
  for (const v of visualRows)
    for (const id of v.blocks.split(/[/,;]/).map((s) => stripMd(s))) {
      const b = byId.get(id);
      if (b && !b.visualId) b.visualId = v.id;
      else if (!b && id) warnings.push(`${v.id}: inventory names unknown block "${id}"`);
    }
  if (byId.size !== allBlocks.length) warnings.push(`${allBlocks.length - byId.size} duplicate block ID(s)`);
  if (internalRefs.size)
    warnings.push(
      `Internal citation notes kept out of external citations (recorded in block treatment): ${[...internalRefs].slice(0, 8).join('; ')}${internalRefs.size > 8 ? ' …' : ''}`,
    );

  // Objectives: metadata row first, then Appendix E, then bare LO ids.
  let objectives = (metadata.get('Learning objectives') ?? '')
    .split(/<br\s*\/?>|\n/i)
    .map((l) => /^(LO\d+)\s*(?:—|–|-|:)?\s*(.+)$/.exec(stripMd(l)))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ id: m[1] ?? '', text: m[2] ?? '' }));
  if (!objectives.length) objectives = appendixObjectives;
  if (!objectives.length) {
    objectives = uniq(allBlocks.flatMap((b) => b.loIds)).map((id) => ({ id, text: 'Not specified in imported document' }));
    if (objectives.length) warnings.push('Objective statements not found; LO ids collected from block mappings');
  }

  const moduleList = [...modules].map(([id, m], i) => ({
    id,
    title: m.title,
    summary: '',
    loIds: uniq(m.blocks.flatMap((b) => b.loIds)),
    role: moduleRole(
      i,
      m.title,
      m.blocks.map((b) => b.kind),
    ),
    blocks: m.blocks,
  }));

  const seat = /(\d+)\s*min/i.exec(stripMd(metadata.get('Estimated seat time') ?? ''));
  const assessText = sectionText(doc, /assessment design/i) ?? '';
  const pass = /(\d{2,3})\s*(?:%|[–-]\s*(\d{2,3})\s*%)/.exec(stripMd(assessText));
  const notes: string[] = [];
  const status = /\*\*Status:\*\*\s*(.+)/.exec(doc.text)?.[1];
  if (status) notes.push(`Status: ${status.trim()}`);
  if (pass?.[2]) notes.push(`Imported passing range ${pass[1]}–${pass[2]}%; the upper bound is used`);
  for (const h of doc.headings)
    if (/^appendix [f-z]\b/i.test(h.text)) notes.push(`Unmapped appendix kept in the original import: ${stripMd(h.text)}`);

  const subtitle = doc.headings[1]?.level === 2 && doc.headings[1].line <= 3 ? stripMd(doc.headings[1].text) : null;
  const storyboard = parseWith(
    StoryboardSchema,
    {
      schemaVersion: '1',
      courseId: opts.courseId,
      title: stripMd(doc.title),
      subtitle,
      language: 'en',
      estimatedMinutes: seat ? Number(seat[1]) : null,
      objectives,
      modules: moduleList,
      glossary,
      acronyms,
      references,
      visuals: visualRows.map((v) => v.spec),
      assessment: { passingPercent: pass ? Number(pass[2] ?? pass[1]) : 80 },
      notes,
    },
    `storyboard import (${doc.name})`,
  );
  return { storyboard, warnings, counts: storyboardCounts(storyboard) };
}

export function storyboardCounts(sb: Storyboard): Record<string, number> {
  const blocks = sb.modules.flatMap((m) => m.blocks);
  const formative = blocks.filter((b) => b.kind === 'formative').length;
  const graded = blocks.filter((b) => b.kind === 'graded').length;
  return {
    modules: sb.modules.length,
    blocks: blocks.length,
    content: blocks.length - formative - graded,
    formative,
    graded,
    interactions: blocks.filter((b) => b.interaction).length,
    visuals: sb.visuals.length,
    glossary: sb.glossary.length,
    acronyms: sb.acronyms.length,
    references: sb.references.length,
    objectives: sb.objectives.length,
  };
}

function treatmentWith(base: string, extras: [string, string][]): string {
  return [brToNewline(base), ...extras.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('\n\n');
}

function contentBlock(t: DocTable, r: string[], internalRefs: Set<string>): Block | null {
  const id = stripMd(cell(t, r, 'block id'));
  if (!id) return null;
  const type = stripMd(cell(t, r, 'type'));
  const format = stripMd(cell(t, r, 'format'));
  const { kind, known } = blockKindFor(type);
  const loRaw = stripMd(cell(t, r, 'learning-objective'));
  const loIds = expandLoRefs(loRaw);
  const cites = parseCitationCell(cell(t, r, 'citation'));
  for (const x of cites.internal) internalRefs.add(x);
  const loNote = loRaw
    .replace(/LO\s?\d+(?:\s*[–—-]\s*(?:LO\s?)?\d+)?/g, '')
    .replace(/[,/;\s]+/g, ' ')
    .trim();
  return {
    id,
    kind,
    subtype: known ? format || null : [type, format].filter(Boolean).join(': ') || null,
    title: stripMd(cell(t, r, 'title')),
    optional: /optional/i.test(format) || (/enrichment|reference only|optional/i.test(loRaw) && !loIds.length),
    body: brToNewline(cell(t, r, 'complete learner-facing content')),
    treatment: treatmentWith(cell(t, r, 'learning treatment'), [
      ['Visual direction', brToNewline(cell(t, r, 'visual'))],
      ['Objective mapping note', loNote],
      ['Internal references (not external sources)', cites.internal.join('; ')],
    ]),
    loIds,
    citations: cites.citations,
    claimIds: [],
    visualId: null,
    accessibility: brToNewline(cell(t, r, 'accessibility')),
    interaction: null,
    difficulty: null,
  };
}

function itemBlock(t: DocTable, r: string[], graded: boolean, warnings: string[], internalRefs: Set<string>): Block | null {
  const id = stripMd(r[0] ?? '');
  if (!id) return null;
  const itemType = stripMd(cell(t, r, 'item type'));
  const stem = brToNewline(cell(t, r, graded ? 'complete stem' : 'complete question'));
  const optionsRaw = cell(t, r, graded ? 'answer options' : 'response options');
  const parsed = parseAnswer(itemType, optionsRaw, cell(t, r, 'correct answer'));
  for (const w of parsed.warnings) warnings.push(`${id}: ${w}`);
  const incorrect = cell(t, r, graded ? 'rationale for incorrect' : 'feedback for incorrect');
  const rationale = graded ? brToNewline(cell(t, r, 'rationale')) : '';
  const cites = parseCitationCell(cell(t, r, 'citations'));
  for (const x of cites.internal) internalRefs.add(x);
  const difficulty = stripMd(cell(t, r, 'difficulty')).toLowerCase();
  const n = Number(/(\d+)$/.exec(id)?.[1] ?? 0);
  return {
    id,
    kind: graded ? 'graded' : 'formative',
    subtype: itemType || null,
    title: graded ? `Assessment item ${n}` : 'Knowledge check',
    optional: false,
    body: stem,
    treatment: treatmentWith('', [['Internal references (not external sources)', cites.internal.join('; ')]]),
    loIds: expandLoRefs(cell(t, r, 'objective mapping')),
    citations: cites.citations,
    claimIds: [],
    visualId: null,
    accessibility: graded ? '' : brToNewline(cell(t, r, 'accessible alternative')),
    interaction: {
      ...parsed.interaction,
      stem,
      feedbackCorrect: graded ? rationale : brToNewline(cell(t, r, 'feedback for correct')),
      feedbackIncorrect: brToNewline(incorrect),
      optionFeedback: optionFeedbackFrom(
        incorrect,
        parsed.interaction.options.map((o) => o.key),
      ),
      rationale,
    },
    difficulty: (DIFFICULTIES as readonly string[]).includes(difficulty) ? (difficulty as Block['difficulty']) : null,
  };
}
