/** Instructional-design blueprint Markdown → `InstructionalDesign` (best effort; gaps get explicit markers + warnings). */
import { BLOOM_LEVELS } from '../../core/enums.js';
import type { InstructionalDesign } from '../../core/schemas/content.js';
import type { NormalizedDocument } from '../types.js';
import { expandLoRefs, listItems, paragraphs, parseCitationCell, sectionText, stripMd, uniq } from '../util.js';

export const NOT_SPECIFIED = 'Not specified in imported document';

type Bloom = (typeof BLOOM_LEVELS)[number];

// ponytail: small verb list; unknown verbs default to `understand` with a warning.
const BLOOM_VERBS: [RegExp, Bloom][] = [
  [/^(create|design|build|develop|construct|compose|plan|produce)/, 'create'],
  [/^(evaluate|judge|justify|critique|assess|defend|select and justify|appraise)/, 'evaluate'],
  [/^(analy[sz]e|compare|differentiate|distinguish|organi[sz]e|examine|categori[sz]e)/, 'analyze'],
  [/^(apply|use|select|implement|demonstrate|solve|recogni[sz]e|identify and escalate|interpret)/, 'apply'],
  [/^(explain|describe|summari[sz]e|classify|discuss|interpret|recogni[sz]e|identify)/, 'understand'],
  [/^(define|list|recall|name|state|identify)/, 'remember'],
];

export function bloomFor(verb: string): Bloom | null {
  const v = verb.toLowerCase().trim();
  return BLOOM_VERBS.find(([re]) => re.test(v))?.[1] ?? BLOOM_LEVELS.find((b) => v.startsWith(b.slice(0, 5))) ?? null;
}

const DISPOSITION: [RegExp, 'core' | 'enrichment' | 'reference' | 'excluded'][] = [
  [/^core/i, 'core'],
  [/^enrich/i, 'enrichment'],
  [/^reference|glossary/i, 'reference'],
  [/^exclu/i, 'excluded'],
];

const ids = (cell: string) => uniq(parseCitationCell(cell).citations.map((c) => c.sourceId));

export function designFromMarkdown(doc: NormalizedDocument): { design: InstructionalDesign; warnings: string[] } {
  const warnings: string[] = [];
  const need = <T>(value: T | null | undefined, fallback: T, what: string): T => {
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || value === '') {
      warnings.push(`${what}: ${NOT_SPECIFIED}`);
      return fallback;
    }
    return value;
  };
  const sec = (re: RegExp) => sectionText(doc, re) ?? '';
  const lines = doc.text.split('\n');

  const titleSec = paragraphs(sec(/^course title$/i))[0];
  const title = titleSec ?? stripMd(doc.headings.find((h) => !/blueprint|instructional design/i.test(h.text))?.text ?? doc.title);

  // Objectives: `### LO1 — Name` + paragraph with **bold** verb + `Supported by: [...]`.
  const objectives = doc.headings
    .filter((h) => /^LO\d+\s*[—–-]/.test(h.text) && h.level >= 2)
    .filter((h, i, all) => all.findIndex((x) => x.text.split(/\s/)[0] === h.text.split(/\s/)[0]) === i)
    .map((h) => {
      const id = /^(LO\d+)/.exec(h.text)?.[1] ?? '';
      const next = doc.headings.find((x) => x.line > h.line);
      const body = lines.slice(h.line, next ? next.line - 1 : lines.length).join('\n');
      const statementLine = body.split('\n').find((l) => l.trim() && !/^supported by/i.test(l.trim())) ?? '';
      const verb = stripMd(/\*\*([^*]+)\*\*/.exec(statementLine)?.[1] ?? statementLine.split(/\s+/)[0] ?? '');
      let bloomLevel = bloomFor(verb);
      if (!bloomLevel) {
        warnings.push(`${id}: Bloom level for verb "${verb}" not recognised; set to understand`);
        bloomLevel = 'understand';
      }
      const supported = /supported by:\s*(.+)/i.exec(body)?.[1] ?? '';
      return { id, statement: stripMd(statementLine), verb, bloomLevel, claimIds: [], sourceIds: ids(supported) };
    });

  const dispositionTable = doc.tables.find((t) => t.header.some((h) => /^disposition$/i.test(stripMd(h))));
  const dispositions =
    dispositionTable?.rows.map((r) => {
      const dCol = dispositionTable.header.findIndex((h) => /^disposition$/i.test(stripMd(h)));
      const raw = stripMd(r[dCol] ?? '');
      return {
        topic: stripMd(r[0] ?? ''),
        disposition: DISPOSITION.find(([re]) => re.test(raw))?.[1] ?? 'reference',
        reason: stripMd(r[dCol + 1] ?? ''),
        sourceIds: ids(r[dCol + 2] ?? ''),
      };
    }) ?? [];

  // Course map durations: `| **1. From hazard to risk** | … | 14 min |`.
  const courseMap = doc.tables.find((t) => /^module$/i.test(stripMd(t.header[0] ?? '')));
  const minutesFor = (n: string) => {
    const row = courseMap?.rows.find((r) => new RegExp(`^${n}\\.`).test(stripMd(r[0] ?? '')));
    return Number(/(\d+)\s*min/.exec(stripMd(row?.[row.length - 1] ?? ''))?.[1] ?? 0);
  };

  const moduleHeads = doc.headings.filter((h) => /^Module\s+\d+\s*[—–:-]/.test(h.text));
  const modules = moduleHeads.map((h, i) => {
    const n = /^Module\s+(\d+)/.exec(h.text)?.[1] ?? String(i);
    const next = doc.headings.find((x) => x.line > h.line && x.level <= h.level);
    const body = lines.slice(h.line, next ? next.line - 1 : lines.length).join('\n');
    const sub = (re: RegExp) => {
      const parts = body.split(/\n(?=#{2,6}\s)/);
      return parts.find((p) => re.test(p.split('\n')[0] ?? ''))?.replace(/^#{2,6}.*\n/, '') ?? '';
    };
    const minutes = minutesFor(n);
    return {
      id: `M${n}`,
      title: stripMd(h.text.replace(/^Module\s+\d+\s*[—–:-]\s*/, '')),
      purpose: paragraphs(sub(/instructional purpose/i)).join(' ') || NOT_SPECIFIED,
      loIds: expandLoRefs(body),
      contentSequence: listItems(sub(/content sequence/i)),
      misconceptions: listItems(sub(/misconception/i)),
      examples: [...paragraphs(sub(/example|visual|interaction/i)), ...listItems(sub(/example|visual|interaction/i))],
      formativePractice: listItems(sub(/formative/i)),
      durationMinutes: minutes > 0 ? minutes : 1,
      sourceIds: ids(sub(/citation/i)),
    };
  });
  if (modules.some((m) => !m.loIds.length)) warnings.push(`module-to-objective mapping: ${NOT_SPECIFIED} for some modules`);
  if (moduleHeads.some((h) => minutesFor(/^Module\s+(\d+)/.exec(h.text)?.[1] ?? '') === 0))
    warnings.push(`Module duration: ${NOT_SPECIFIED} for some modules (set to 1 minute)`);

  const alignTable = doc.tables.find((t) => /^objective/i.test(stripMd(t.header[0] ?? '')) && t.header.some((h) => /formative/i.test(h)));
  const alignment =
    alignTable?.rows.map((r) => {
      const loId = expandLoRefs(r[0] ?? '')[0] ?? stripMd(r[0] ?? '');
      const col = (re: RegExp) => stripMd(r[alignTable.header.findIndex((h) => re.test(h))] ?? '');
      const level =
        col(/cognitive/i)
          .split(/[^A-Za-z]+/)
          .find(Boolean) ?? '';
      return {
        loId,
        moduleIds: modules.filter((m) => m.loIds.includes(loId)).map((m) => m.id),
        formativeMethod: col(/formative/i) || NOT_SPECIFIED,
        gradedMethod: col(/graded|assessment method/i) || NOT_SPECIFIED,
        cognitiveLevel: bloomFor(level) ?? 'apply',
      };
    }) ?? [];

  const durationText = stripMd(sec(/recommended duration/i));
  const duration = Number(/(\d{2,4})\s*minutes/.exec(durationText)?.[1] ?? 0);
  const gradedText = stripMd(sec(/graded-assessment|graded assessment/i));
  const gradedItems = Number(/total graded items:?\s*(?:approximately\s*)?(\d+)/i.exec(gradedText)?.[1] ?? 0);
  const passing = /(\d{2,3})\s*%/.exec(gradedText)?.[1];

  const glossary: { term: string; definition: string }[] = [];
  const glossText = sec(/glossary/i).split('\n');
  glossText.forEach((l, i) => {
    const m = /^\*\*(.+?)\*\*\s*$/.exec(l.trim());
    const def = glossText[i + 1]?.trim();
    if (m?.[1] && def && !def.startsWith('**')) glossary.push({ term: m[1], definition: stripMd(def) });
  });

  const gapTable = doc.tables.find((t) => /^gap/i.test(stripMd(t.header[0] ?? '')));
  const evidenceGaps =
    gapTable?.rows.map((r) => ({
      description: stripMd(r[0] ?? ''),
      impact: stripMd(r[1] ?? ''),
      action: stripMd(r[2] ?? '') || NOT_SPECIFIED,
    })) ?? [];

  const design: InstructionalDesign = {
    title: need(title, NOT_SPECIFIED, 'title'),
    audience: need(
      paragraphs(sec(/intended audience/i)).join(' ') || listItems(sec(/intended audience/i)).join('; '),
      NOT_SPECIFIED,
      'audience',
    ),
    prerequisites: need(listItems(sec(/prior knowledge|prerequisite/i)), [NOT_SPECIFIED], 'prerequisites'),
    scopeBoundaries: need(listItems(sec(/qualification boundaries|scope boundar/i)), [NOT_SPECIFIED], 'scope boundaries'),
    durationMinutes: need(duration >= 5 ? duration : null, 60, 'duration (defaulted to 60)'),
    objectives: need(
      objectives,
      [{ id: 'LO1', statement: NOT_SPECIFIED, verb: 'explain', bloomLevel: 'understand', claimIds: [], sourceIds: [] }],
      'objectives',
    ),
    dispositions: need(dispositions, [], 'content dispositions'),
    modules: need(
      modules,
      [
        {
          id: 'M1',
          title: NOT_SPECIFIED,
          purpose: NOT_SPECIFIED,
          loIds: [],
          contentSequence: [],
          misconceptions: [],
          examples: [],
          formativePractice: [],
          durationMinutes: 1,
          sourceIds: [],
        },
      ],
      'modules',
    ),
    alignment: need(alignment, [], 'alignment matrix'),
    assessmentStrategy: {
      formativePerModule: 0,
      gradedItemCount: need(gradedItems || null, 0, 'graded item count'),
      passingPercent: passing ? Number(passing) : need(null, 80, 'passing percent (defaulted to 80)'),
      notes: paragraphs(gradedText).slice(0, 3).join(' ') || NOT_SPECIFIED,
    },
    scenarioStrategy: need(paragraphs(sec(/scenario/i)).join(' '), NOT_SPECIFIED, 'scenario strategy'),
    glossaryPlan: need(glossary, [], 'glossary plan'),
    evidenceGaps: need(evidenceGaps, [], 'evidence gaps'),
  };
  return { design, warnings };
}
