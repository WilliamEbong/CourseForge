/**
 * Deterministic stage inference from document signals (catalogued from the chemical-risk lineage).
 * Accept at best ≥ 0.7 with margin ≥ 0.2 (`high`); otherwise the caller may run the AI enum classifier or gate.
 */
import { STAGES, type Stage } from '../core/enums.js';
import {
  ConceptBriefSchema,
  InstructionalDesignSchema,
  ResearchBriefSchema,
  ResearchDossierSchema,
  StoryboardSchema,
} from '../core/schemas/content.js';
import { CourseModelSchema } from '../core/schemas/model.js';
import type { NormalizedDocument } from './types.js';

export interface StageScores {
  scores: Record<Stage, number>;
  best: Stage | null;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

const ACCEPT = 0.7;
const MARGIN = 0.2;

export function scoreStages(doc: NormalizedDocument): StageScores {
  const scores = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  const evidence: string[] = [];
  const add = (stage: Stage, w: number, why: string) => {
    scores[stage] += w;
    evidence.push(`${stage} +${w}: ${why}`);
  };

  if (doc.format === 'json') scoreJson(doc.json, add);
  else if (doc.html) {
    if (doc.html.embeddedCourse !== null) add('COURSE_BUILD', 0.8, 'HTML embeds course data');
    const d = doc.html.dom;
    if ((d.inputs ?? 0) + (d.buttons ?? 0) >= 5 && doc.html.scriptCount > 0) add('COURSE_BUILD', 0.5, 'interactive DOM with scripts');
    if (doc.format === 'html') add('COURSE_BUILD', 0.2, 'HTML document');
  }
  if (doc.format !== 'json') scoreText(doc, add);

  for (const s of STAGES) scores[s] = Math.round(Math.min(1, Math.max(0, scores[s])) * 100) / 100;
  const ranked = [...STAGES].sort((a, b) => scores[b] - scores[a] || STAGES.indexOf(a) - STAGES.indexOf(b));
  const top = ranked[0] as Stage;
  const margin = scores[top] - scores[ranked[1] as Stage];
  const best = scores[top] > 0 ? top : null;
  const confidence =
    best && scores[top] >= ACCEPT && margin >= MARGIN ? 'high' : best && scores[top] >= 0.5 && margin >= 0.1 ? 'medium' : 'low';
  return { scores, best, confidence, evidence };
}

type Add = (stage: Stage, w: number, why: string) => void;

function scoreJson(json: unknown, add: Add): void {
  const shapes: [Stage, { safeParse(v: unknown): { success: boolean } }, string][] = [
    ['COURSE_MODEL', CourseModelSchema, 'course model'],
    ['STORYBOARD', StoryboardSchema, 'storyboard'],
    ['INSTRUCTIONAL_DESIGN', InstructionalDesignSchema, 'instructional design'],
    ['RESEARCH_DOSSIER', ResearchDossierSchema, 'research dossier'],
    ['RESEARCH_BRIEF', ResearchBriefSchema, 'research brief'],
    ['CONCEPT', ConceptBriefSchema, 'concept brief'],
  ];
  const hit = shapes.find(([, schema]) => schema.safeParse(json).success);
  if (hit) {
    add(hit[0], 1, `JSON matches the ${hit[2]} schema`);
    return;
  }
  if (json && typeof json === 'object' && 'screens' in json) add('COURSE_MODEL', 0.4, 'JSON has a screens array (not schema-valid)');
}

function scoreText(doc: NormalizedDocument, add: Add): void {
  const text = doc.text;
  const headers = doc.tables.map((t) => t.header.join(' | ').toLowerCase());
  const hasHeader = (...parts: string[]) => headers.some((h) => parts.every((p) => h.includes(p)));
  const headingMatch = (re: RegExp) => doc.headings.some((h) => re.test(h.text));
  const words = text.split(/\s+/).filter(Boolean).length;

  // Storyboard / editorial
  const sbSignals: [boolean, number, string][] = [
    [hasHeader('block id', 'complete learner-facing content'), 0.5, 'block tables with learner-facing content'],
    [hasHeader('item id', 'correct answer'), 0.2, 'formative item tables'],
    [hasHeader('assessment item id'), 0.1, 'graded item table'],
    [/storyboard/i.test(doc.title) || headingMatch(/storyboard/i), 0.2, '"storyboard" heading'],
  ];
  const sb = sbSignals.reduce((n, [hit, w]) => (hit ? n + w : n), 0);
  const sbWhy = sbSignals.filter(([hit]) => hit).map(([, , why]) => why);
  const editorial = /editorial (pass|revision)|humani[sz]ed/i.test(`${doc.name}\n${text}`);
  if (sb > 0) {
    if (editorial && sb >= 0.5) {
      add('EDITORIAL', sb + 0.1, `${sbWhy.join(', ')} + editorial-pass markers`);
      add('STORYBOARD', sb - 0.3, `${sbWhy.join(', ')} (editorial markers present)`);
    } else add('STORYBOARD', sb, sbWhy.join(', '));
  }

  // Research brief: one fenced prompt, ALL-CAPS section labels, many research questions.
  const fences = text.match(/^```/gm)?.length ?? 0;
  const fenced = /```[a-z]*\n([\s\S]*?)```/.exec(text)?.[1] ?? '';
  if (fences === 2 && fenced.length > text.length * 0.7) add('RESEARCH_BRIEF', 0.3, 'single fenced prompt block');
  const caps = text.split('\n').filter((l) => /^[A-Z][A-Z ,&/()-]{5,}$/.test(l.trim())).length;
  if (caps >= 4) add('RESEARCH_BRIEF', 0.2, `${caps} ALL-CAPS section labels`);
  if (/research questions/i.test(text) && /research (dossier|document)/i.test(text))
    add('RESEARCH_BRIEF', 0.2, 'asks for research questions / dossier');
  const questions = text.split('\n').filter((l) => /^\s*\d+\.\s.*\?/.test(l)).length;
  if (questions >= 8 && !hasHeader('claim')) add('RESEARCH_BRIEF', 0.2, `${questions} numbered questions`);

  // Research dossier
  if (doc.tables.some((t) => /^claim/i.test(t.header[0] ?? '') && t.header.some((h) => /source/i.test(h))))
    add('RESEARCH_DOSSIER', 0.4, 'claim-to-source table');
  if (headingMatch(/annotated bibliography|source register/i)) add('RESEARCH_DOSSIER', 0.3, 'annotated bibliography');
  if (headingMatch(/research dossier/i) || /research dossier/i.test(doc.title)) add('RESEARCH_DOSSIER', 0.2, '"research dossier" heading');
  const cites = text.match(/\[[A-Z][A-Z0-9.-]*(?:\s[^\]]*)?(?:;[^\]]*)?\]/g)?.length ?? 0;
  if (cites >= 20 && !sb) add('RESEARCH_DOSSIER', 0.1, `${cites} bracket citation tokens`);

  // Instructional design
  const loHeadings = doc.headings.filter((h) => /^LO\d+\b/.test(h.text) && h.level >= 2).length;
  if (loHeadings >= 3) add('INSTRUCTIONAL_DESIGN', 0.35, `${loHeadings} LO headings`);
  if (hasHeader('disposition')) add('INSTRUCTIONAL_DESIGN', 0.25, 'content disposition matrix');
  if (doc.tables.some((t) => /objective/i.test(t.header[0] ?? '') && t.header.some((h) => /formative|assessment/i.test(h))) && !sb)
    add('INSTRUCTIONAL_DESIGN', 0.2, 'objective alignment matrix');
  if (/instructional design|design blueprint/i.test(doc.title)) add('INSTRUCTIONAL_DESIGN', 0.2, 'design title');

  // Course QA report
  if (/\bQA\b|quality assurance/i.test(doc.title) || headingMatch(/\bQA report\b/i)) add('COURSE_QA', 0.4, 'QA report title');
  const qaSections = doc.headings.filter((h) => /verification|accessibility|functional|known boundaries/i.test(h.text)).length;
  if (qaSections >= 2 && !sb) add('COURSE_QA', 0.2, `${qaSections} verification sections`);
  if ((text.match(/\*\*\d+(?:\/\d+)?\*\*/g)?.length ?? 0) >= 5 && /\bpass\b/i.test(text) && !sb)
    add('COURSE_QA', 0.2, 'bold verification counts');

  // Concept note: short, little structure.
  if (!doc.html && doc.tables.length === 0 && doc.headings.length <= 3 && words < 800 && fences === 0)
    add('CONCEPT', words < 300 ? 0.8 : 0.7, `short unstructured note (${words} words)`);
}
