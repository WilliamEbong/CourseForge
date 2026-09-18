/**
 * Deterministic content validators. Each returns `Issue`s which the stage loop turns into validator findings.
 * These encode the "code can decide this" half of the review: structure, keys, coverage, integrity.
 */
import type { FindingCategory, Severity } from '../../core/enums.js';
import type {
  Block,
  ClaimRecord,
  InstructionalDesign,
  Interaction,
  ResearchBrief,
  ResearchDossier,
  SourceRecord,
  Storyboard,
  VisualSpec,
} from '../../core/schemas/index.js';

export interface Issue {
  checkId: string;
  severity: Severity;
  category: FindingCategory;
  location: string;
  problem: string;
  evidence?: string[];
  recommendedAction?: string;
}

const issue = (
  checkId: string,
  severity: Severity,
  category: FindingCategory,
  location: string,
  problem: string,
  recommendedAction = '',
  evidence: string[] = [],
): Issue => ({ checkId, severity, category, location, problem, recommendedAction, evidence });

/* --------------------------------------------------------------- placeholders */

const PLACEHOLDER =
  /\b(TBD|TODO|FIXME|lorem ipsum|to be determined|to be confirmed|insert (?:text|content|here)|placeholder|continue as above|same as above|XXX+)\b|\[insert[^\]]*\]/i;

export function findPlaceholders(texts: { location: string; text: string }[], checkId = 'no-placeholders'): Issue[] {
  const out: Issue[] = [];
  for (const { location, text } of texts) {
    const m = PLACEHOLDER.exec(text);
    if (m)
      out.push(
        issue(
          checkId,
          'major',
          'completeness',
          location,
          `Placeholder text "${m[0]}" in learner-facing or artifact content`,
          'Replace the placeholder with complete content.',
          [text.slice(Math.max(0, m.index - 40), m.index + 60)],
        ),
      );
  }
  return out;
}

export function storyboardTexts(sb: Storyboard): { location: string; text: string }[] {
  const out: { location: string; text: string }[] = [];
  for (const m of sb.modules) {
    out.push({ location: m.id, text: `${m.title}\n${m.summary}` });
    for (const b of m.blocks) {
      out.push({ location: b.id, text: `${b.title}\n${b.body}` });
      if (b.interaction) {
        const i = b.interaction;
        out.push({
          location: b.id,
          text: [
            i.stem,
            i.feedbackCorrect,
            i.feedbackIncorrect,
            i.rationale,
            ...i.options.map((o) => o.text),
            ...i.targets.map((t) => t.text),
          ].join('\n'),
        });
      }
    }
  }
  for (const v of sb.visuals) out.push({ location: v.id, text: `${v.title}\n${v.textEquivalent.short}\n${v.textEquivalent.long}` });
  for (const g of sb.glossary) out.push({ location: g.id, text: g.definition });
  return out;
}

/* ------------------------------------------------------------------ ID checks */

export function duplicateIds(ids: { id: string; where: string }[], checkId = 'ids-unique'): Issue[] {
  const seen = new Map<string, string>();
  const out: Issue[] = [];
  for (const { id, where } of ids) {
    const prev = seen.get(id);
    if (prev)
      out.push(
        issue(
          checkId,
          'critical',
          'structure',
          id,
          `Duplicate ID "${id}" (${prev} and ${where})`,
          'Give every block, item, visual and glossary entry a unique stable ID.',
        ),
      );
    else seen.set(id, where);
  }
  return out;
}

export function storyboardIds(sb: Storyboard): { id: string; where: string }[] {
  return [
    ...sb.modules.map((m) => ({ id: m.id, where: 'module' })),
    ...sb.modules.flatMap((m) => m.blocks.map((b) => ({ id: b.id, where: `block in ${m.id}` }))),
    ...sb.visuals.map((v) => ({ id: v.id, where: 'visual' })),
    ...sb.glossary.map((g) => ({ id: g.id, where: 'glossary' })),
    ...sb.acronyms.map((a) => ({ id: a.id, where: 'acronym' })),
  ];
}

/* ---------------------------------------------------------------- answer keys */

export function interactionIssues(location: string, i: Interaction, checkId = 'answer-keys'): Issue[] {
  const out: Issue[] = [];
  const bad = (problem: string) =>
    out.push(
      issue(
        checkId,
        'critical',
        'assessment',
        location,
        problem,
        'Make the answer key consistent with the interaction mode and its options.',
      ),
    );
  const optionKeys = new Set(i.options.map((o) => o.key));
  const targetKeys = new Set(i.targets.map((t) => t.key));
  if (optionKeys.size !== i.options.length) bad('Duplicate option keys');
  if (!i.stem.trim()) bad('Empty question stem');
  switch (i.mode) {
    case 'single':
      if (i.options.length < 2) bad('Single-choice question needs at least 2 options');
      if (i.correctKeys.length !== 1) bad(`Single-choice question must have exactly one correct key (has ${i.correctKeys.length})`);
      break;
    case 'multiple':
      if (i.options.length < 3) bad('Multiple-response question needs at least 3 options');
      if (i.correctKeys.length < 1) bad('Multiple-response question has no correct keys');
      break;
    case 'matching':
    case 'categorization': {
      if (i.targets.length < 2) bad(`${i.mode} needs at least 2 targets`);
      const mapped = new Set(i.mapping.map((m) => m.key));
      for (const k of optionKeys) if (!mapped.has(k)) bad(`Option ${k} has no mapping`);
      for (const m of i.mapping) {
        if (!optionKeys.has(m.key)) bad(`Mapping references unknown option ${m.key}`);
        if (!targetKeys.has(m.target)) bad(`Mapping references unknown target ${m.target}`);
      }
      if (i.mode === 'matching' && new Set(i.mapping.map((m) => m.target)).size < Math.min(i.targets.length, i.mapping.length) - 0) {
        // matching may legitimately reuse targets; only flag when every option maps to one target
        if (new Set(i.mapping.map((m) => m.target)).size === 1 && i.mapping.length > 1) bad('All matching prompts map to the same target');
      }
      break;
    }
    case 'sequencing': {
      if (i.options.length < 3) bad('Sequencing needs at least 3 steps');
      const ord = new Set(i.order);
      if (ord.size !== i.order.length || ord.size !== optionKeys.size || [...ord].some((k) => !optionKeys.has(k)))
        bad('Sequence order must be a permutation of the option keys');
      break;
    }
    case 'reveal':
      break;
  }
  if (i.mode === 'single' || i.mode === 'multiple')
    for (const k of i.correctKeys) if (!optionKeys.has(k)) bad(`Correct key ${k} is not an option`);
  if (i.mode !== 'reveal') {
    if (!i.feedbackCorrect.trim() || !i.feedbackIncorrect.trim())
      out.push(
        issue(
          checkId,
          'major',
          'assessment',
          location,
          'Missing correct/incorrect feedback',
          'Write feedback that explains why, for both outcomes.',
        ),
      );
  }
  return out;
}

export function answerKeyIssues(sb: Storyboard): Issue[] {
  const out: Issue[] = [];
  for (const m of sb.modules)
    for (const b of m.blocks) {
      const isQuestion = b.kind === 'formative' || b.kind === 'graded';
      if (isQuestion && !b.interaction)
        out.push(issue('answer-keys', 'critical', 'assessment', b.id, `${b.kind} block has no interaction`, 'Add a complete interaction.'));
      if (b.interaction) out.push(...interactionIssues(b.id, b.interaction));
      if (b.kind === 'graded' && b.interaction?.mode === 'reveal')
        out.push(
          issue('answer-keys', 'critical', 'assessment', b.id, 'Graded item cannot be reveal-only', 'Use a scorable interaction mode.'),
        );
    }
  return out;
}

/* ---------------------------------------------------------------- LO coverage */

export function loCoverageIssues(sb: Storyboard, minAssessments = 2): Issue[] {
  const out: Issue[] = [];
  const taught = new Map<string, number>();
  const assessed = new Map<string, number>();
  const known = new Set(sb.objectives.map((o) => o.id));
  for (const m of sb.modules)
    for (const b of m.blocks) {
      const target = b.kind === 'formative' || b.kind === 'graded' ? assessed : taught;
      for (const lo of b.loIds) {
        target.set(lo, (target.get(lo) ?? 0) + 1);
        if (known.size && !known.has(lo))
          out.push(
            issue(
              'lo-coverage',
              'major',
              'traceability',
              b.id,
              `Block maps to unknown objective ${lo}`,
              'Map blocks only to defined learning objectives.',
            ),
          );
      }
    }
  for (const o of sb.objectives) {
    if (!taught.get(o.id))
      out.push(
        issue(
          'lo-coverage',
          'major',
          'alignment',
          o.id,
          `Objective ${o.id} is never taught (TRACE-ORPHAN-LO)`,
          'Add or map instructional content for this objective.',
        ),
      );
    const n = assessed.get(o.id) ?? 0;
    if (n < minAssessments)
      out.push(
        issue(
          'lo-coverage',
          n === 0 ? 'critical' : 'major',
          'alignment',
          o.id,
          `Objective ${o.id} is assessed ${n} time(s); at least ${minAssessments} required (TRACE-UNASSESSED-LO)`,
          'Add formative/graded items aligned to this objective.',
        ),
      );
  }
  // untaught assessment content: item LO never taught
  for (const m of sb.modules)
    for (const b of m.blocks)
      if ((b.kind === 'formative' || b.kind === 'graded') && b.loIds.some((lo) => !taught.get(lo)))
        out.push(
          issue(
            'lo-coverage',
            'major',
            'alignment',
            b.id,
            'Item assesses an objective that is never taught (TRACE-UNTAUGHT-ITEM)',
            'Teach the content before assessing it, or remap the item.',
          ),
        );
  return out;
}

/* ------------------------------------------------------------------ citations */

export function citationIssues(sb: Storyboard): Issue[] {
  const out: Issue[] = [];
  const refs = new Set(sb.references.map((r) => r.id));
  const cited = new Set<string>();
  const check = (location: string, sourceIds: string[]) => {
    for (const s of sourceIds) {
      cited.add(s);
      if (!refs.has(s))
        out.push(
          issue(
            'citations-resolve',
            'critical',
            'citation',
            location,
            `Citation "${s}" does not resolve to a reference (TRACE-DANGLING-REF)`,
            'Cite only sources present in the reference library, or add the source with full details.',
          ),
        );
    }
  };
  for (const m of sb.modules)
    for (const b of m.blocks)
      check(
        b.id,
        b.citations.map((c) => c.sourceId),
      );
  for (const v of sb.visuals) check(v.id, v.sourceIds);
  for (const g of sb.glossary) check(g.id, g.sourceIds);
  for (const r of sb.references)
    if (!cited.has(r.id))
      out.push(
        issue(
          'citations-resolve',
          'minor',
          'citation',
          r.id,
          `Reference ${r.id} is never cited (TRACE-UNUSED-SOURCE)`,
          'Cite it where used or move it to further reading.',
        ),
      );
  const factual = new Set(['content', 'concept', 'technical-depth', 'evidence', 'warning', 'comparison', 'process']);
  for (const m of sb.modules)
    for (const b of m.blocks)
      if (factual.has(b.kind) && b.citations.length === 0 && b.body.length > 280)
        out.push(
          issue(
            'citations-resolve',
            'minor',
            'evidence',
            b.id,
            'Substantive factual block has no citation',
            'Attach supporting citations or mark the block as synthesis.',
          ),
        );
  return out;
}

/* ------------------------------------------------------------- visuals / a11y */

export const AUTHORING_INSTRUCTION =
  /^\s*(alt text|alt-text|create (an )?original|insert|placeholder|describe (the|this)|todo|tbd|text alternative (must|should))/i;

export function visualIssues(visuals: readonly VisualSpec[], blocks: readonly Block[], checkId = 'visual-text-equivalents'): Issue[] {
  const out: Issue[] = [];
  const ids = new Set(visuals.map((v) => v.id));
  const used = new Set<string>();
  for (const b of blocks)
    if (b.visualId) {
      used.add(b.visualId);
      if (!ids.has(b.visualId))
        out.push(
          issue(
            checkId,
            'critical',
            'structure',
            b.id,
            `Block references missing visual ${b.visualId}`,
            'Define the visual spec or remove the reference.',
          ),
        );
    }
  for (const v of visuals) {
    const { short, long } = v.textEquivalent;
    if (short.trim().length < 3 || long.trim().length < 10)
      out.push(
        issue(
          checkId,
          'critical',
          'accessibility',
          v.id,
          'Visual lacks a meaningful text equivalent',
          'Write a short label and a long description conveying the same information.',
        ),
      );
    if (AUTHORING_INSTRUCTION.test(short) || AUTHORING_INSTRUCTION.test(long))
      out.push(
        issue(
          checkId,
          'critical',
          'accessibility',
          v.id,
          'Text equivalent is an authoring instruction, not a description',
          'Replace it with a description of what the visual shows.',
          [short],
        ),
      );
    const hasContent = v.content.items.length + v.content.rows.length > 0 || !!v.mermaid;
    if (!hasContent)
      out.push(
        issue(checkId, 'major', 'visual', v.id, 'Visual spec has no content to render', 'Provide items/links/rows describing the diagram.'),
      );
    if (!used.has(v.id))
      out.push(
        issue(
          checkId,
          'minor',
          'structure',
          v.id,
          'Visual is defined but not used by any block',
          'Reference it from a block or remove it.',
        ),
      );
  }
  return out;
}

export function noDragOnlyIssues(blocks: readonly Block[]): Issue[] {
  const out: Issue[] = [];
  for (const b of blocks) {
    const t = `${b.treatment} ${b.accessibility}`.toLowerCase();
    if (/\bdrag/.test(t) && !/keyboard|button|select|alternative/.test(t))
      out.push(
        issue(
          'no-drag-only',
          'critical',
          'accessibility',
          b.id,
          'Interaction described as drag-based without a keyboard-operable alternative',
          'Specify keyboard/select/button controls as the primary interaction.',
        ),
      );
  }
  return out;
}

export function allBlocks(sb: Storyboard): Block[] {
  return sb.modules.flatMap((m) => m.blocks);
}

/* ------------------------------------------------------------- design checks */

const BANNED_VERBS = /^(know|understand|learn|appreciate|be aware|become familiar|grasp|realize|realise)\b/i;

export function designIssues(d: InstructionalDesign, sources: ReadonlySet<string> | null): Issue[] {
  const out: Issue[] = [];
  const los = new Set(d.objectives.map((o) => o.id));
  if (d.objectives.length < 3 || d.objectives.length > 8)
    out.push(
      issue(
        'design-alignment',
        'major',
        'instructional',
        'global',
        `${d.objectives.length} learning objectives; 4–6 is the target range (3–8 tolerated)`,
        'Consolidate or split objectives.',
      ),
    );
  for (const o of d.objectives) {
    if (BANNED_VERBS.test(o.verb.trim()) || BANNED_VERBS.test(o.statement.trim()))
      out.push(
        issue(
          'design-alignment',
          'major',
          'alignment',
          o.id,
          `Objective uses a non-measurable verb ("${o.verb}")`,
          'Use an observable verb (explain, distinguish, identify, interpret, select, evaluate…).',
        ),
      );
    const a = d.alignment.find((x) => x.loId === o.id);
    if (!a)
      out.push(
        issue(
          'design-alignment',
          'critical',
          'alignment',
          o.id,
          'Objective missing from the alignment matrix',
          'Align it to content, formative practice and graded assessment.',
        ),
      );
    else {
      if (!a.formativeMethod.trim() || !a.gradedMethod.trim())
        out.push(
          issue(
            'design-alignment',
            'major',
            'alignment',
            o.id,
            'Objective lacks a formative or graded method',
            'Define both practice and assessment.',
          ),
        );
      for (const mid of a.moduleIds)
        if (!d.modules.some((m) => m.id === mid))
          out.push(issue('design-alignment', 'major', 'alignment', o.id, `Alignment references unknown module ${mid}`, 'Fix module IDs.'));
    }
    if (!d.modules.some((m) => m.loIds.includes(o.id)))
      out.push(
        issue('design-alignment', 'major', 'alignment', o.id, 'No module teaches this objective', 'Assign the objective to a module.'),
      );
    if (sources)
      for (const s of o.sourceIds)
        if (!sources.has(s))
          out.push(issue('design-alignment', 'major', 'citation', o.id, `Unknown source ${s}`, 'Use sources from the research dossier.'));
  }
  for (const m of d.modules)
    for (const lo of m.loIds)
      if (!los.has(lo))
        out.push(issue('design-alignment', 'major', 'alignment', m.id, `Module references unknown objective ${lo}`, 'Fix objective IDs.'));
  for (const disp of d.dispositions)
    if (disp.disposition === 'excluded' && !disp.reason.trim())
      out.push(issue('design-alignment', 'minor', 'scope', disp.topic, 'Excluded topic without a reason', 'Record why it is excluded.'));
  out.push(
    ...duplicateIds([
      ...d.objectives.map((o) => ({ id: o.id, where: 'objective' })),
      ...d.modules.map((m) => ({ id: m.id, where: 'module' })),
    ]),
  );
  return out;
}

/* ----------------------------------------------------------- research checks */

const URL_RE = /^https?:\/\/[^\s<>"]+$/i;
const INLINE_TOKEN = /\[([A-Za-z][A-Za-z0-9._-]*(?:\s[^;\]]*)?(?:;\s*[A-Za-z][A-Za-z0-9._-]*(?:\s[^;\]]*)?)*)\]/g;

export function dossierIssues(dossier: ResearchDossier, sources: readonly SourceRecord[], claims: readonly ClaimRecord[]): Issue[] {
  const out: Issue[] = [];
  const sids = new Set(sources.map((s) => s.id));
  out.push(
    ...duplicateIds(
      sources.map((s) => ({ id: s.id, where: 'source' })),
      'dossier-integrity',
    ),
  );
  out.push(
    ...duplicateIds(
      claims.map((c) => ({ id: c.id, where: 'claim' })),
      'dossier-integrity',
    ),
  );
  for (const s of sources) {
    if (s.url && !URL_RE.test(s.url))
      out.push(issue('dossier-integrity', 'major', 'citation', s.id, `Malformed URL "${s.url}"`, 'Record the exact source URL.'));
    if (!s.url && !s.doi && s.type !== 'internal')
      out.push(
        issue(
          'dossier-integrity',
          'minor',
          'citation',
          s.id,
          'Source has neither URL nor DOI',
          'Record a locator so the source can be verified.',
        ),
      );
  }
  for (const c of claims) {
    if (c.citations.length === 0)
      out.push(
        issue(
          'dossier-integrity',
          'major',
          'evidence',
          c.id,
          'Claim has no supporting source (TRACE-UNCITED-CLAIM)',
          'Cite the source that supports it or remove the claim.',
        ),
      );
    for (const cit of c.citations)
      if (!sids.has(cit.sourceId))
        out.push(
          issue(
            'dossier-integrity',
            'critical',
            'citation',
            c.id,
            `Claim cites unknown source ${cit.sourceId}`,
            'Add the source record or correct the ID.',
          ),
        );
  }
  for (const sec of dossier.sections) {
    for (const m of sec.markdown.matchAll(INLINE_TOKEN)) {
      for (const part of (m[1] ?? '').split(';')) {
        const id = part.trim().split(/\s/)[0] ?? '';
        if (/^[A-Z][A-Z0-9._-]{1,}$/.test(id) && !sids.has(id) && id.length > 1)
          out.push(
            issue(
              'dossier-integrity',
              'major',
              'citation',
              sec.sectionId,
              `Inline citation [${id}] does not resolve to a source`,
              'Correct the token or add the source.',
            ),
          );
      }
    }
  }
  return out;
}

export function briefIssues(b: ResearchBrief, highStakes: boolean): Issue[] {
  const out: Issue[] = [];
  if (b.researchQuestions.length < 3)
    out.push(
      issue(
        'brief-sections',
        'major',
        'completeness',
        'global',
        'Fewer than 3 research questions',
        'Cover the core questions the course must answer.',
      ),
    );
  if (b.dossierPlan.length < 2)
    out.push(
      issue('brief-sections', 'major', 'completeness', 'global', 'Dossier plan has fewer than 2 sections', 'Plan the dossier structure.'),
    );
  if (b.sourceHierarchy.length === 0)
    out.push(issue('brief-sections', 'major', 'evidence', 'global', 'No source-quality hierarchy', 'Rank acceptable source types.'));
  if (highStakes && b.safetyBoundaries.length === 0)
    out.push(
      issue(
        'brief-sections',
        'critical',
        'safety',
        'global',
        'High-stakes subject without safety/scope boundaries',
        'State what the course must not teach or authorise.',
      ),
    );
  const qids = new Set(b.researchQuestions.map((q) => q.id));
  for (const s of b.dossierPlan)
    for (const q of s.questionIds)
      if (!qids.has(q))
        out.push(issue('brief-sections', 'minor', 'structure', s.sectionId, `Unknown research question ${q}`, 'Fix question references.'));
  return out;
}
