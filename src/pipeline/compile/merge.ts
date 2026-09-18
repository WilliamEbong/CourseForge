/**
 * Deterministic merges of fan-out agent outputs into canonical artifacts. Pure.
 */
import { formatSeq } from '../../core/ids.js';
import type {
  Acronym,
  ClaimRecord,
  DossierSectionAgent,
  EditorialResult,
  GlossaryEntry,
  InstructionalDesign,
  ResearchDossier,
  SourceRecord,
  Storyboard,
  StoryboardModulePart,
  VisualSpec,
} from '../../core/schemas/index.js';

export interface MergeWarning {
  location: string;
  message: string;
}

/* ------------------------------------------------------------------ dossier */

export function mergeDossier(title: string, parts: { subject: string; output: DossierSectionAgent }[], planOrder: string[]) {
  const warnings: MergeWarning[] = [];
  const order = new Map(planOrder.map((id, i) => [id, i]));
  const sorted = [...parts].sort((a, b) => (order.get(a.subject) ?? 999) - (order.get(b.subject) ?? 999));
  const sources = new Map<string, SourceRecord>();
  const claims: ClaimRecord[] = [];
  const sections: ResearchDossier['sections'] = [];
  let seq = 0;
  for (const { subject, output } of sorted) {
    const rename = new Map<string, string>();
    for (const s of output.sources) {
      const existing = sources.get(s.id);
      if (!existing) sources.set(s.id, s);
      else if ((existing.url ?? '') !== (s.url ?? '') || existing.title !== s.title) {
        let n = 2;
        while (sources.has(`${s.id}-${n}`)) n++;
        const newId = `${s.id}-${n}`;
        rename.set(s.id, newId);
        sources.set(newId, { ...s, id: newId });
        warnings.push({ location: subject, message: `Source id ${s.id} collided with a different source; renamed to ${newId}` });
      }
    }
    const fix = (id: string) => rename.get(id) ?? id;
    let markdown = output.markdown;
    for (const [from, to] of rename)
      markdown = markdown.replace(new RegExp(`(?<=[\\[;\\s])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s;\\]])`, 'g'), to);
    const claimIds: string[] = [];
    for (const c of output.claims) {
      seq++;
      const id = formatSeq('CLM', seq);
      claimIds.push(id);
      claims.push({ ...c, id, sectionId: subject, citations: c.citations.map((ct) => ({ ...ct, sourceId: fix(ct.sourceId) })) });
    }
    sections.push({
      sectionId: subject,
      title: output.title,
      markdown,
      claimIds,
      sourceIds: [...new Set(output.sources.map((s) => fix(s.id)))],
    });
  }
  const dossier: ResearchDossier = { schemaVersion: '1', title, version: 1, sections };
  return { dossier, sources: [...sources.values()], claims, warnings };
}

/* --------------------------------------------------------------- storyboard */

export interface StoryboardMergeInput {
  courseId: string;
  title: string;
  language: string;
  design: InstructionalDesign;
  parts: { subject: string; output: StoryboardModulePart }[];
  moduleOrder: string[];
  sources: SourceRecord[];
}

export function mergeStoryboard(input: StoryboardMergeInput): { storyboard: Storyboard; warnings: MergeWarning[] } {
  const warnings: MergeWarning[] = [];
  const order = new Map(input.moduleOrder.map((id, i) => [id, i]));
  const parts = [...input.parts].sort((a, b) => (order.get(a.subject) ?? 999) - (order.get(b.subject) ?? 999));
  const visuals = new Map<string, VisualSpec>();
  const glossary = new Map<string, GlossaryEntry>();
  const acronyms = new Map<string, Acronym>();
  const termIndex = new Map<string, string>();
  for (const { subject, output } of parts) {
    if (output.module.id !== subject)
      warnings.push({ location: subject, message: `Module returned id ${output.module.id}; expected ${subject}` });
    for (const v of output.visuals) {
      if (visuals.has(v.id)) warnings.push({ location: v.id, message: `Duplicate visual id ${v.id} across modules (kept first)` });
      else visuals.set(v.id, v);
    }
    for (const g of output.glossary) {
      const key = g.term.trim().toLowerCase();
      if (termIndex.has(key)) continue;
      termIndex.set(key, g.id);
      glossary.set(g.id, g);
    }
    for (const a of output.acronyms) if (![...acronyms.values()].some((x) => x.acronym === a.acronym)) acronyms.set(a.id, a);
  }
  const cited = new Set<string>();
  for (const p of parts) {
    for (const b of p.output.module.blocks) for (const c of b.citations) cited.add(c.sourceId);
    for (const v of p.output.visuals) for (const s of v.sourceIds) cited.add(s);
  }
  for (const g of glossary.values()) for (const s of g.sourceIds) cited.add(s);
  const references = input.sources.filter((s) => cited.has(s.id));
  const storyboard: Storyboard = {
    schemaVersion: '1',
    courseId: input.courseId,
    title: input.title,
    subtitle: null,
    language: input.language,
    estimatedMinutes: input.design.durationMinutes,
    objectives: input.design.objectives.map((o) => ({ id: o.id, text: o.statement })),
    modules: parts.map((p) => ({ ...p.output.module, id: p.subject })),
    glossary: [...glossary.values()].sort((a, b) => a.term.localeCompare(b.term)),
    acronyms: [...acronyms.values()].sort((a, b) => a.acronym.localeCompare(b.acronym)),
    references,
    visuals: [...visuals.values()],
    assessment: { passingPercent: input.design.assessmentStrategy.passingPercent },
    notes: [],
  };
  return { storyboard, warnings };
}

/* ---------------------------------------------------------------- editorial */

/** Applies text-only edits; structural fields are never touched. Locked block IDs are skipped. */
export function applyEditorial(
  storyboard: Storyboard,
  results: { subject: string; output: EditorialResult }[],
  locked: ReadonlySet<string>,
): { edited: Storyboard; applied: number; skipped: MergeWarning[] } {
  const edited = structuredClone(storyboard);
  const blocks = new Map(edited.modules.flatMap((m) => m.blocks.map((b) => [b.id, { b, moduleId: m.id }] as const)));
  const skipped: MergeWarning[] = [];
  let applied = 0;
  for (const { subject, output } of results) {
    for (const e of output.edits) {
      const hit = blocks.get(e.blockId);
      if (!hit) {
        skipped.push({ location: e.blockId, message: 'edit targets unknown block' });
        continue;
      }
      if (hit.moduleId !== subject) {
        skipped.push({ location: e.blockId, message: `edit for module ${subject} targets block in ${hit.moduleId}` });
        continue;
      }
      if (locked.has(e.blockId)) {
        skipped.push({ location: e.blockId, message: 'block is locked' });
        continue;
      }
      const b = hit.b;
      const i = b.interaction;
      let ok = true;
      switch (e.field) {
        case 'title':
          b.title = e.text;
          break;
        case 'body':
          b.body = e.text;
          break;
        case 'treatment':
          b.treatment = e.text;
          break;
        case 'stem':
        case 'feedbackCorrect':
        case 'feedbackIncorrect':
        case 'rationale':
          if (i) i[e.field] = e.text;
          else ok = false;
          break;
        case 'optionText':
        case 'optionFeedback':
        case 'targetText': {
          const list = !i ? null : e.field === 'optionText' ? i.options : e.field === 'optionFeedback' ? i.optionFeedback : i.targets;
          const item = list?.find((x) => x.key === e.key);
          if (item) item.text = e.text;
          else ok = false;
          break;
        }
      }
      if (ok) applied++;
      else skipped.push({ location: e.blockId, message: `field ${e.field}${e.key ? `:${e.key}` : ''} not applicable` });
    }
  }
  return { edited, applied, skipped };
}
