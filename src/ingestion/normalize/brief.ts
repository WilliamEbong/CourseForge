/** Research-brief prompt (ALL-CAPS sections, numbered questions and structure) → `ResearchBrief`; concept passthrough. */
import type { ResearchBrief } from '../../core/schemas/content.js';
import type { NormalizedDocument } from '../types.js';
import { listItems, paragraphs, stripMd, uniq } from '../util.js';
import { NOT_SPECIFIED } from './design.js';
import { sectionIdFor } from './dossier.js';

const CAPS = /^[A-Z][A-Z ,&/()-]{5,}$/;

/** Splits text on ALL-CAPS label lines → `{ LABEL: body }` (order preserved). */
export function capsSections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let key = '';
  let buf: string[] = [];
  for (const line of text.split('\n')) {
    if (CAPS.test(line.trim())) {
      if (key) out.set(key, buf.join('\n').trim());
      key = line.trim();
      buf = [];
    } else buf.push(line);
  }
  if (key) out.set(key, buf.join('\n').trim());
  return out;
}

// ponytail: fixed jurisdiction list; extend when a course targets somewhere else.
const JURISDICTIONS: [RegExp, string][] = [
  [/\bAlberta\b/, 'Alberta, Canada'],
  [/\bOntario\b/, 'Ontario, Canada'],
  [/\bBritish Columbia\b/, 'British Columbia, Canada'],
  [/\bQu[eé]bec\b/, 'Quebec, Canada'],
  [/\bCanad(a|ian)\b/, 'Canada'],
  [/\bUnited States\b|\bU\.S\.\b|\bOSHA\b/, 'United States'],
  [/\bUnited Kingdom\b|\bUK\b/, 'United Kingdom'],
  [/\bEuropean Union\b|\bEU\b/, 'European Union'],
  [/\bAustralia\b/, 'Australia'],
];

export function briefFromMarkdown(doc: NormalizedDocument): { brief: ResearchBrief; warnings: string[] } {
  const warnings: string[] = [];
  const fenced = /```[a-z]*\n([\s\S]*?)```/.exec(doc.text)?.[1] ?? doc.text;
  const secs = capsSections(fenced);
  const get = (re: RegExp) =>
    [...secs]
      .filter(([k]) => re.test(k))
      .map(([, v]) => v)
      .join('\n\n');
  const orMarker = (xs: string[], what: string) => {
    if (xs.length) return xs;
    warnings.push(`${what}: ${NOT_SPECIFIED}`);
    return [NOT_SPECIFIED];
  };

  const purposeText = paragraphs(get(/PURPOSE/));
  const questions = listItems(get(/QUESTION/)).map((q, i) => ({ id: `RQ${i + 1}`, question: q, priority: 'core' as const }));
  const structure = listItems(get(/STRUCTURE|OUTLINE|PLAN/));
  const scopeText = get(/SCOPE|EMPHASIS|GEOGRAPH/);
  const quoted = /[“"]([^”"]{5,200})[”"]/.exec(fenced)?.[1];
  if (!questions.length) warnings.push(`research questions: ${NOT_SPECIFIED}`);
  if (!structure.length) warnings.push(`dossier plan: ${NOT_SPECIFIED}`);
  warnings.push('source hierarchy: not structured in the imported brief; CourseForge default hierarchy applied');

  const brief: ResearchBrief = {
    title: stripMd(quoted ?? doc.title),
    purpose: purposeText[0] ?? NOT_SPECIFIED,
    audience: purposeText.find((p) => /learner|audience|professional/i.test(p)) ?? purposeText[0] ?? NOT_SPECIFIED,
    scope: orMarker([...paragraphs(scopeText), ...listItems(scopeText)], 'scope'),
    exclusions: orMarker(paragraphs(get(/EXCLUSION|OUT OF SCOPE/)), 'exclusions'),
    researchQuestions: questions.length ? questions : [{ id: 'RQ1', question: NOT_SPECIFIED, priority: 'core' }],
    sourceHierarchy: [
      { rank: 1, sourceType: 'legislation', rationale: 'Default CourseForge hierarchy (enforceable law first)' },
      { rank: 2, sourceType: 'regulation', rationale: 'Default CourseForge hierarchy' },
      { rank: 3, sourceType: 'government-guidance', rationale: 'Default CourseForge hierarchy' },
      { rank: 4, sourceType: 'standard', rationale: 'Default CourseForge hierarchy' },
      { rank: 5, sourceType: 'peer-reviewed', rationale: 'Default CourseForge hierarchy' },
    ],
    jurisdictions: uniq(JURISDICTIONS.filter(([re]) => re.test(scopeText || fenced)).map(([, j]) => j)),
    safetyBoundaries: orMarker(paragraphs(get(/SAFETY/)), 'safety boundaries'),
    dossierPlan: structure.length
      ? structure.map((title, i) => ({ sectionId: sectionIdFor(i + 1), title, questionIds: [], notes: '' }))
      : [{ sectionId: 'RS-01', title: NOT_SPECIFIED, questionIds: [], notes: '' }],
    evidenceRequirements: orMarker(listItems(get(/CITATION|EVIDENCE/)), 'evidence requirements'),
    currentnessRequirements: orMarker(
      fenced
        .split(/(?<=[.!?])\s+/)
        .map((s) => stripMd(s.trim()))
        .filter((s) => /\b(current|latest|edition|superseded|effective date)/i.test(s) && s.length < 400)
        .slice(0, 10),
      'currentness requirements',
    ),
  };
  return { brief, warnings };
}

/** A concept note is kept verbatim as the CONCEPT stage input. */
export function conceptFromText(doc: NormalizedDocument): { markdown: string; warnings: string[] } {
  const body = doc.text.trim();
  return { markdown: `<!-- cf:imported ${doc.name} -->\n${body}\n`, warnings: body ? [] : ['Concept note is empty'] };
}
