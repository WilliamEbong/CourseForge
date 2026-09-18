/** Stage-contract checks (spec 03) for imported artifacts → intake-report `contractGaps`. */
import type { Stage } from '../core/enums.js';
import { isValidId } from '../core/ids.js';
import type {
  ClaimRecord,
  InstructionalDesign,
  ResearchBrief,
  ResearchDossier,
  SourceRecord,
  Storyboard,
} from '../core/schemas/content.js';
import type { CourseModel } from '../core/schemas/model.js';
import { interactionKeysConsistent, isAuthoringInstruction } from './normalize/common.js';
import { NOT_SPECIFIED } from './normalize/design.js';

export interface ContractArtifacts {
  storyboard?: Storyboard | null;
  model?: CourseModel | null;
  lossy?: boolean;
  dossier?: ResearchDossier | null;
  sources?: SourceRecord[];
  claims?: ClaimRecord[];
  design?: InstructionalDesign | null;
  brief?: ResearchBrief | null;
  conceptText?: string | null;
}

export interface ContractCheck {
  requirement: string;
  status: 'met' | 'partial' | 'missing';
  detail: string;
}

const PLACEHOLDER = /\b(TBD|TODO|lorem ipsum|placeholder|to be written)\b/i;

/** met when nothing fails, partial when some pass, missing when all fail (or nothing to check and `required`). */
function ratio(requirement: string, total: number, failures: string[], required = true): ContractCheck {
  if (total === 0) return { requirement, status: required ? 'missing' : 'met', detail: required ? 'nothing found' : 'not applicable' };
  const status = failures.length === 0 ? 'met' : failures.length < total ? 'partial' : 'missing';
  const sample = failures.slice(0, 6).join(', ');
  return {
    requirement,
    status,
    detail: failures.length ? `${failures.length}/${total} failing: ${sample}${failures.length > 6 ? ' …' : ''}` : `${total} checked`,
  };
}

const present = (requirement: string, ok: boolean, detail: string): ContractCheck => ({
  requirement,
  status: ok ? 'met' : 'missing',
  detail,
});
const specified = (v: string | string[]) =>
  Array.isArray(v) ? v.length > 0 && !v.every((x) => x === NOT_SPECIFIED) : !!v && v !== NOT_SPECIFIED;

export function checkContract(stage: Stage, a: ContractArtifacts): ContractCheck[] {
  switch (stage) {
    case 'CONCEPT': {
      const t = a.conceptText ?? '';
      return [
        present('topic or title', t.trim().length > 0, t.trim() ? 'concept text present' : 'empty'),
        present(
          'intended audience',
          /audience|learners?|for (?:new|staff|employees|students)/i.test(t),
          'looked for an audience statement',
        ),
        present('target duration', /\b\d+\s*(min|minutes|hours?|hrs?)\b/i.test(t), 'looked for a duration'),
        present(
          'jurisdiction / industry constraints',
          /jurisdiction|regulat|law|industry|canada|alberta|united states|eu\b/i.test(t),
          'looked for constraints',
        ),
      ];
    }
    case 'RESEARCH_BRIEF': {
      const b = a.brief;
      if (!b) return [present('research brief', false, 'could not be normalised')];
      return [
        present('purpose and audience', specified(b.purpose) && specified(b.audience), 'purpose/audience'),
        present('scope and exclusions', specified(b.scope) && specified(b.exclusions), 'scope/exclusions'),
        present('research questions', specified(b.researchQuestions.map((q) => q.question)), `${b.researchQuestions.length} questions`),
        present('source-quality hierarchy', b.sourceHierarchy.length > 0, `${b.sourceHierarchy.length} ranks`),
        present('jurisdiction', b.jurisdictions.length > 0, b.jurisdictions.join(', ') || 'none detected'),
        present('safety boundaries', specified(b.safetyBoundaries), 'safety section'),
        present('planned dossier structure', specified(b.dossierPlan.map((s) => s.title)), `${b.dossierPlan.length} planned sections`),
        present('evidence requirements', specified(b.evidenceRequirements), 'citation/evidence rules'),
        present('currentness requirements', specified(b.currentnessRequirements), 'currentness statements'),
      ];
    }
    case 'RESEARCH_DOSSIER': {
      const sources = a.sources ?? [];
      const claims = a.claims ?? [];
      const known = new Set(sources.map((s) => s.id));
      return [
        present('dossier sections', (a.dossier?.sections.length ?? 0) > 0, `${a.dossier?.sections.length ?? 0} sections`),
        ratio(
          'source records with URL/DOI',
          sources.length,
          sources.filter((s) => !s.url && !s.doi).map((s) => s.id),
        ),
        ratio(
          'source access dates',
          sources.length,
          sources.filter((s) => !s.accessed).map((s) => s.id),
        ),
        ratio(
          'claims with stable IDs and sources',
          claims.length,
          claims.filter((c) => !c.citations.length).map((c) => c.id),
        ),
        ratio(
          'claim citations resolve to sources',
          claims.length,
          claims.filter((c) => c.citations.some((x) => !known.has(x.sourceId))).map((c) => c.id),
        ),
      ];
    }
    case 'INSTRUCTIONAL_DESIGN': {
      const d = a.design;
      if (!d) return [present('instructional design', false, 'could not be normalised')];
      const n = d.objectives.length;
      return [
        present('content disposition', d.dispositions.length > 0, `${d.dispositions.length} rows`),
        {
          requirement: 'learning objectives (4–6)',
          status: n >= 4 && n <= 6 ? 'met' : n > 0 ? 'partial' : 'missing',
          detail: `${n} objectives`,
        },
        present('audience / prerequisites', specified(d.audience) && specified(d.prerequisites), 'audience and prerequisites'),
        present('scope / qualification boundaries', specified(d.scopeBoundaries), 'boundaries'),
        present(
          'module plans',
          d.modules.some((m) => m.title !== NOT_SPECIFIED),
          `${d.modules.length} modules`,
        ),
        ratio(
          'objective alignment',
          n,
          d.objectives.filter((o) => !d.alignment.some((x) => x.loId === o.id)).map((o) => o.id),
        ),
        present('assessment strategy', d.assessmentStrategy.gradedItemCount > 0, `${d.assessmentStrategy.gradedItemCount} graded items`),
        present('scenario strategy', specified(d.scenarioStrategy), 'scenario plan'),
        present('glossary plan', d.glossaryPlan.length > 0, `${d.glossaryPlan.length} terms`),
        present('evidence gaps recorded', d.evidenceGaps.length > 0, `${d.evidenceGaps.length} gaps`),
        ratio(
          'objective source fidelity',
          n,
          d.objectives.filter((o) => !o.sourceIds.length).map((o) => o.id),
        ),
      ];
    }
    case 'STORYBOARD':
    case 'EDITORIAL':
      return a.storyboard ? storyboardChecks(a.storyboard) : [present('storyboard', false, 'could not be normalised')];
    case 'COURSE_MODEL':
    case 'COURSE_BUILD':
    case 'COURSE_QA':
    case 'RELEASE': {
      const model: ContractCheck = a.model
        ? {
            requirement: 'reconstructable course model',
            status: a.lossy ? 'partial' : 'met',
            detail: `${a.model.screens.length} screens${a.lossy ? ' (lossy DOM reconstruction)' : ''}`,
          }
        : {
            requirement: 'reconstructable course model',
            status: 'missing',
            detail: stage === 'COURSE_QA' ? 'QA reports carry no course model' : 'no model',
          };
      return [model, ...(a.storyboard ? storyboardChecks(a.storyboard) : [])];
    }
    case 'VISUAL_DIRECTION':
      return [
        present(
          'visual direction artifact',
          false,
          'imported visual-direction documents are preserved only; regenerate at VISUAL_DIRECTION',
        ),
      ];
  }
}

export function storyboardChecks(sb: Storyboard): ContractCheck[] {
  const blocks = sb.modules.flatMap((m) => m.blocks);
  const ids = blocks.map((b) => b.id);
  const items = blocks.filter((b) => b.kind === 'formative' || b.kind === 'graded');
  const refs = new Set(sb.references.map((r) => r.id));
  const visuals = new Map(sb.visuals.map((v) => [v.id, v]));
  const teaching = blocks.filter((b) => !['section-title', 'topic-title'].includes(b.kind) && !b.optional);
  const counts = new Map<string, { any: number; graded: number }>();
  for (const b of items)
    for (const lo of b.loIds) {
      const c = counts.get(lo) ?? { any: 0, graded: 0 };
      c.any++;
      if (b.kind === 'graded') c.graded++;
      counts.set(lo, c);
    }
  return [
    ratio(
      'stable unique block IDs',
      ids.length,
      ids.filter((id, i) => !isValidId(id) || ids.indexOf(id) !== i),
    ),
    ratio(
      'complete learner-facing content',
      blocks.length,
      blocks.filter((b) => !b.body.trim() || PLACEHOLDER.test(b.body)).map((b) => b.id),
    ),
    ratio(
      'interactions with answer keys',
      items.length,
      items.filter((b) => !b.interaction || !interactionKeysConsistent(b.interaction)).map((b) => b.id),
    ),
    ratio(
      'feedback / rationales',
      items.length,
      items.filter((b) => !b.interaction?.feedbackCorrect || !b.interaction.feedbackIncorrect).map((b) => b.id),
    ),
    ratio(
      'objective mapping',
      teaching.length,
      teaching.filter((b) => !b.loIds.length).map((b) => b.id),
    ),
    ratio(
      'citations resolve to references',
      blocks.filter((b) => b.citations.length).length,
      blocks.filter((b) => b.citations.some((c) => !refs.has(c.sourceId))).map((b) => b.id),
      false,
    ),
    ratio(
      'accessibility alternatives',
      blocks.filter((b) => b.visualId || b.kind === 'formative').length,
      blocks.filter((b) => (b.visualId || b.kind === 'formative') && !b.accessibility.trim()).map((b) => b.id),
      false,
    ),
    ratio(
      'visual specs with real text equivalents',
      sb.visuals.length + blocks.filter((b) => b.visualId).length,
      [
        ...sb.visuals.filter((v) => isAuthoringInstruction(v.textEquivalent.long)).map((v) => v.id),
        ...blocks.filter((b) => b.visualId && !visuals.has(b.visualId)).map((b) => `${b.id}→${b.visualId}`),
      ],
      false,
    ),
    present(
      'glossary and references',
      sb.glossary.length > 0 && sb.references.length > 0,
      `${sb.glossary.length} glossary, ${sb.references.length} references`,
    ),
    ratio(
      'assessment coverage (each LO ≥2 items, ≥1 graded)',
      sb.objectives.length,
      sb.objectives.filter((o) => (counts.get(o.id)?.any ?? 0) < 2 || (counts.get(o.id)?.graded ?? 0) < 1).map((o) => o.id),
    ),
  ];
}
