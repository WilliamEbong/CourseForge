/**
 * Handlers for the agent-authored stages: CONCEPT … VISUAL_DIRECTION.
 * Agents return JSON; these handlers merge it deterministically, write canonical JSON + Markdown twins,
 * and run the deterministic validators named in config/stages.json.
 */
import { compileTheme } from '../../../components/course-ui/tokens/compile.js';
import { GATE_STRICTNESS, RISK_TIERS, type RiskTier } from '../../core/enums.js';
import { readJson, readText, writeAtomic, writeJson } from '../../core/fsx.js';
import { toJsonl } from '../../core/log.js';
import { COURSE_FILES } from '../../core/paths.js';
import {
  AcronymSchema,
  BlockSchema,
  ClaimRecordSchema,
  type ConceptBrief,
  ConceptBriefSchema,
  type DesignDirection,
  DesignDirectionSchema,
  type DossierSectionAgent,
  type EditorialResult,
  GlossaryEntrySchema,
  type InstructionalDesign,
  InstructionalDesignSchema,
  LearningObjectiveSchema,
  type ResearchBrief,
  ResearchBriefSchema,
  ResearchDossierSchema,
  SourceRecordSchema,
  type Storyboard,
  type StoryboardModulePart,
  StoryboardModuleSchema,
  StoryboardSchema,
  type VisualDirectionAgent,
  type VisualSpec,
  VisualSpecSchema,
} from '../../core/schemas/index.js';
import { renderBriefMarkdown, renderDesignMarkdown, renderDossierMarkdown, renderStoryboardMarkdown } from '../../ingestion/markdown.js';
import { routeVisual } from '../../routing/visual.js';
import {
  allBlocks,
  answerKeyIssues,
  briefIssues,
  citationIssues,
  designIssues,
  dossierIssues,
  duplicateIds,
  findPlaceholders,
  type Issue,
  loCoverageIssues,
  noDragOnlyIssues,
  storyboardIds,
  storyboardTexts,
  visualIssues,
} from '../checks/content.js';
import { editedTextPairs, editorialStructureIssues, polarityIssues } from '../checks/editorial.js';
import { applyEditorial, mergeDossier, mergeStoryboard } from '../compile/merge.js';
import type { RunContext } from '../context.js';
import { saveManifest } from '../store.js';
import {
  canonicalStoryboard,
  canonicalStoryboardPath,
  claims,
  has,
  lockedIds,
  type Produced,
  p,
  read,
  type StageHandler,
  type Subject,
  sources,
  tryRead,
  wants,
} from './common.js';
import { lockIssues } from './locks.js';

const F = COURSE_FILES;

function schemaIssues(
  ctx: RunContext,
  files: {
    rel: string;
    schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } };
  }[],
): Issue[] {
  const out: Issue[] = [];
  for (const f of files) {
    if (!has(ctx, f.rel)) {
      out.push({
        checkId: 'schema',
        severity: 'blocker',
        category: 'structure',
        location: f.rel,
        problem: `Required artifact ${f.rel} is missing`,
        recommendedAction: 'Regenerate the stage.',
      });
      continue;
    }
    const res = f.schema.safeParse(readJson(p(ctx, f.rel)));
    if (!res.success)
      out.push({
        checkId: 'schema',
        severity: 'blocker',
        category: 'structure',
        location: f.rel,
        problem: `Artifact fails schema validation: ${(res.error?.issues ?? [])
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
        recommendedAction: 'Regenerate or repair the artifact so it matches its schema.',
      });
  }
  return out;
}

/* ------------------------------------------------------------------ CONCEPT */

function conceptMarkdown(c: ConceptBrief): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- None recorded');
  return `# ${c.title}

${c.summary}

| Field | Value |
|---|---|
| Audience | ${c.audience} |
| Target duration | ${c.targetDurationMinutes} minutes |
| Language | ${c.language} |
| Jurisdiction | ${c.jurisdiction ?? 'Not jurisdiction-specific'} |
| Risk tier | ${c.riskTier} — ${c.riskRationale} |
| Domains | ${c.domains.join(', ')} |

## Prerequisites
${list(c.prerequisites)}

## Learning goals
${list(c.learningGoals)}

## Assumptions
${c.assumptions.length ? c.assumptions.map((a) => `- ${a.text}${a.highStakes ? ' **(high-stakes — needs human confirmation)**' : ''}`).join('\n') : '- None'}

## Gaps / open questions
${list(c.gaps)}

## Out of scope
${list(c.outOfScope)}
`;
}

export const concept: StageHandler = {
  generatorExtra(ctx) {
    return {
      request: has(ctx, F.conceptMd.replace('concept.md', 'concept-request.md'))
        ? readText(p(ctx, 'input/concept-request.md'))
        : ctx.manifest.course.title,
    };
  },
  merge(ctx, outputs) {
    const c = outputs[0]?.output as ConceptBrief;
    writeJson(p(ctx, F.conceptJson), c);
    writeAtomic(p(ctx, F.conceptMd), conceptMarkdown(c));
    // Risk tier can only be raised by the concept analysis, never silently lowered.
    const m = ctx.manifest;
    const rank = (t: RiskTier) => RISK_TIERS.indexOf(t);
    if (rank(c.riskTier) > rank(m.course.risk_tier)) m.course.risk_tier = c.riskTier;
    m.course.audience ??= c.audience;
    m.course.jurisdiction ??= c.jurisdiction;
    m.course.target_duration_minutes ??= c.targetDurationMinutes;
    saveManifest(ctx.dir, m);
    return [{ logicalKey: 'concept', path: F.conceptJson, stage: 'CONCEPT' }];
  },
  async validate(ctx, ids) {
    const out = wants(ids, 'schema') ? schemaIssues(ctx, [{ rel: F.conceptJson, schema: ConceptBriefSchema }]) : [];
    const c = tryRead(ctx, F.conceptJson, ConceptBriefSchema);
    if (c && wants(ids, 'concept-complete')) {
      if (!c.learningGoals.length)
        out.push({
          checkId: 'concept-complete',
          severity: 'major',
          category: 'completeness',
          location: 'global',
          problem: 'No learning goals',
          recommendedAction: 'State what learners should be able to do.',
        });
      if (!c.audience.trim())
        out.push({
          checkId: 'concept-complete',
          severity: 'major',
          category: 'completeness',
          location: 'global',
          problem: 'Audience not described',
          recommendedAction: 'Describe the intended audience.',
        });
    }
    return out;
  },
  repair: () => ({
    path: F.conceptJson,
    logicalKey: 'concept',
    schemas: {},
    rootSchema: ConceptBriefSchema,
    save: (ctx, doc) => concept.merge?.(ctx, [{ subject: null, output: doc }]) ?? [],
  }),
};

/* ----------------------------------------------------------- RESEARCH_BRIEF */

export const researchBrief: StageHandler = {
  generatorExtra(ctx) {
    return { concept: tryRead(ctx, F.conceptJson, ConceptBriefSchema) };
  },
  merge(ctx, outputs) {
    const b = outputs[0]?.output as ResearchBrief;
    writeJson(p(ctx, F.researchBriefJson), b);
    writeAtomic(p(ctx, F.researchBriefMd), renderBriefMarkdown(b));
    return [{ logicalKey: 'research-brief', path: F.researchBriefJson, stage: 'RESEARCH_BRIEF' }];
  },
  async validate(ctx, ids) {
    const out = wants(ids, 'schema') ? schemaIssues(ctx, [{ rel: F.researchBriefJson, schema: ResearchBriefSchema }]) : [];
    const b = tryRead(ctx, F.researchBriefJson, ResearchBriefSchema);
    if (b && wants(ids, 'brief-sections')) out.push(...briefIssues(b, ctx.manifest.course.risk_tier === 'high_stakes'));
    return out;
  },
  repair: () => ({
    path: F.researchBriefJson,
    logicalKey: 'research-brief',
    schemas: {
      researchQuestions: ResearchBriefSchema.shape.researchQuestions.element,
      dossierPlan: ResearchBriefSchema.shape.dossierPlan.element,
    },
    rootSchema: ResearchBriefSchema,
    save: (ctx, doc) => researchBrief.merge?.(ctx, [{ subject: null, output: doc }]) ?? [],
  }),
};

/* --------------------------------------------------------- RESEARCH_DOSSIER */

function writeDossier(ctx: RunContext, doc: { dossier: unknown; sources: unknown[]; claims: unknown[] }): Produced[] {
  const dossier = ResearchDossierSchema.parse(doc.dossier);
  writeJson(p(ctx, F.dossierJson), dossier);
  writeAtomic(p(ctx, F.sources), toJsonl(doc.sources));
  writeAtomic(p(ctx, F.claims), toJsonl(doc.claims));
  writeAtomic(
    p(ctx, F.dossierMd),
    renderDossierMarkdown(
      dossier,
      doc.sources.map((s) => SourceRecordSchema.parse(s)),
      doc.claims.map((c) => ClaimRecordSchema.parse(c)),
    ),
  );
  return [
    { logicalKey: 'dossier', path: F.dossierJson, stage: 'RESEARCH_DOSSIER' },
    { logicalKey: 'sources', path: F.sources, stage: 'RESEARCH_DOSSIER' },
    { logicalKey: 'claims', path: F.claims, stage: 'RESEARCH_DOSSIER' },
  ];
}

export const researchDossier: StageHandler = {
  subjects(ctx) {
    const b = read(ctx, F.researchBriefJson, ResearchBriefSchema);
    return b.dossierPlan.map((s) => ({
      key: s.sectionId,
      title: s.title,
      extra: {
        section: s,
        questions: b.researchQuestions.filter((q) => s.questionIds.includes(q.id)),
        sourceHierarchy: b.sourceHierarchy,
        jurisdictions: b.jurisdictions,
        safetyBoundaries: b.safetyBoundaries,
        evidenceRequirements: b.evidenceRequirements,
        currentnessRequirements: b.currentnessRequirements,
        otherSections: b.dossierPlan.filter((x) => x.sectionId !== s.sectionId).map((x) => ({ sectionId: x.sectionId, title: x.title })),
      },
    }));
  },
  merge(ctx, outputs) {
    const b = read(ctx, F.researchBriefJson, ResearchBriefSchema);
    const merged = mergeDossier(
      b.title,
      outputs.map((o) => ({ subject: o.subject ?? '', output: o.output as DossierSectionAgent })),
      b.dossierPlan.map((s) => s.sectionId),
    );
    return writeDossier(ctx, merged);
  },
  async validate(ctx, ids) {
    const out = wants(ids, 'schema') ? schemaIssues(ctx, [{ rel: F.dossierJson, schema: ResearchDossierSchema }]) : [];
    const d = tryRead(ctx, F.dossierJson, ResearchDossierSchema);
    if (!d) return out;
    if (wants(ids, 'dossier-integrity')) out.push(...dossierIssues(d, sources(ctx), claims(ctx)));
    if (wants(ids, 'no-placeholders')) out.push(...findPlaceholders(d.sections.map((s) => ({ location: s.sectionId, text: s.markdown }))));
    return out;
  },
  repair: () => ({
    path: F.dossierJson,
    logicalKey: 'dossier',
    schemas: { sections: ResearchDossierSchema.shape.sections.element, sources: SourceRecordSchema, claims: ClaimRecordSchema },
    load: (ctx) => ({ dossier: read(ctx, F.dossierJson, ResearchDossierSchema), sources: sources(ctx), claims: claims(ctx) }),
    save: (ctx, doc) => writeDossier(ctx, doc as { dossier: unknown; sources: unknown[]; claims: unknown[] }),
  }),
};

/* ----------------------------------------------------- INSTRUCTIONAL_DESIGN */

function writeDesign(ctx: RunContext, d: InstructionalDesign): Produced[] {
  writeJson(p(ctx, F.designJson), d);
  writeAtomic(p(ctx, F.designMd), renderDesignMarkdown(d));
  return [{ logicalKey: 'design', path: F.designJson, stage: 'INSTRUCTIONAL_DESIGN' }];
}

export const instructionalDesign: StageHandler = {
  generatorExtra(ctx) {
    return {
      concept: tryRead(ctx, F.conceptJson, ConceptBriefSchema),
      brief: tryRead(ctx, F.researchBriefJson, ResearchBriefSchema),
      sourceIndex: sources(ctx).map((s) => ({ id: s.id, title: s.title, type: s.type })),
      claimCount: claims(ctx).length,
    };
  },
  merge(ctx, outputs) {
    return writeDesign(ctx, outputs[0]?.output as InstructionalDesign);
  },
  async validate(ctx, ids) {
    const out = wants(ids, 'schema') ? schemaIssues(ctx, [{ rel: F.designJson, schema: InstructionalDesignSchema }]) : [];
    const d = tryRead(ctx, F.designJson, InstructionalDesignSchema);
    if (!d) return out;
    const srcIds = has(ctx, F.sources) ? new Set(sources(ctx).map((s) => s.id)) : null;
    if (wants(ids, 'design-alignment') || wants(ids, 'ids-unique')) out.push(...designIssues(d, srcIds));
    if (wants(ids, 'no-placeholders'))
      out.push(
        ...findPlaceholders([
          ...d.objectives.map((o) => ({ location: o.id, text: o.statement })),
          ...d.modules.map((m) => ({ location: m.id, text: [m.purpose, ...m.contentSequence].join('\n') })),
        ]),
      );
    return out;
  },
  repair: () => ({
    path: F.designJson,
    logicalKey: 'design',
    schemas: { objectives: LearningObjectiveSchema, modules: InstructionalDesignSchema.shape.modules.element },
    rootSchema: InstructionalDesignSchema,
    save: (ctx, doc) => writeDesign(ctx, InstructionalDesignSchema.parse(doc)),
  }),
};

/* --------------------------------------------------------------- STORYBOARD */

export const GRADED_MODULE_ID = 'GA';

function writeStoryboard(ctx: RunContext, sb: Storyboard, edited: boolean): Produced[] {
  const json = edited ? F.storyboardEditedJson : F.storyboardJson;
  const md = edited ? F.storyboardEditedMd : F.storyboardMd;
  writeJson(p(ctx, json), StoryboardSchema.parse(sb));
  writeAtomic(p(ctx, md), renderStoryboardMarkdown(sb));
  return [{ logicalKey: edited ? 'storyboard-edited' : 'storyboard', path: json, stage: edited ? 'EDITORIAL' : 'STORYBOARD' }];
}

export function storyboardValidators(ctx: RunContext, rel: string, ids: readonly string[], logicalKey: string): Issue[] {
  const out = wants(ids, 'schema') ? schemaIssues(ctx, [{ rel, schema: StoryboardSchema }]) : [];
  const sb = tryRead(ctx, rel, StoryboardSchema);
  if (!sb) return out;
  const blocks = allBlocks(sb);
  if (wants(ids, 'ids-unique')) out.push(...duplicateIds(storyboardIds(sb)));
  if (wants(ids, 'no-placeholders')) out.push(...findPlaceholders(storyboardTexts(sb)));
  if (wants(ids, 'answer-keys')) out.push(...answerKeyIssues(sb));
  if (wants(ids, 'lo-coverage')) out.push(...loCoverageIssues(sb));
  if (wants(ids, 'citations-resolve')) out.push(...citationIssues(sb));
  if (wants(ids, 'visual-text-equivalents')) out.push(...visualIssues(sb.visuals, blocks));
  if (wants(ids, 'no-drag-only')) out.push(...noDragOnlyIssues(blocks));
  if (wants(ids, 'locks-intact')) out.push(...lockIssues(ctx, logicalKey));
  return out;
}

const STORYBOARD_SCHEMAS = {
  modules: StoryboardModuleSchema,
  blocks: BlockSchema,
  visuals: VisualSpecSchema,
  glossary: GlossaryEntrySchema,
  acronyms: AcronymSchema,
};

export const storyboard: StageHandler = {
  subjects(ctx) {
    const d = read(ctx, F.designJson, InstructionalDesignSchema);
    const outline = d.modules.map((m) => ({ id: m.id, title: m.title, loIds: m.loIds }));
    const srcIndex = has(ctx, F.sources) ? sources(ctx).map((s) => ({ id: s.id, title: s.title })) : [];
    const subjects: Subject[] = d.modules.map((m, i) => ({
      key: m.id,
      title: m.title,
      extra: {
        role: i === 0 ? 'intro' : 'topic',
        module: m,
        blockIdPrefix: `${m.id}-B`,
        formativeIdPrefix: `${m.id}-F`,
        objectives: d.objectives.filter((o) => m.loIds.includes(o.id)),
        alignment: d.alignment.filter((a) => m.loIds.includes(a.loId)),
        assessmentStrategy: d.assessmentStrategy,
        glossaryPlan: d.glossaryPlan,
        scenarioStrategy: d.scenarioStrategy,
        courseOutline: outline,
        sourceIndex: srcIndex,
      },
    }));
    if (d.assessmentStrategy.gradedItemCount > 0)
      subjects.push({
        key: GRADED_MODULE_ID,
        title: 'Final assessment',
        extra: {
          role: 'graded',
          module: null,
          blockIdPrefix: 'GA-',
          formativeIdPrefix: 'GA-',
          objectives: d.objectives,
          alignment: d.alignment,
          assessmentStrategy: d.assessmentStrategy,
          glossaryPlan: [],
          scenarioStrategy: d.scenarioStrategy,
          courseOutline: outline,
          sourceIndex: srcIndex,
        },
      });
    return subjects;
  },
  merge(ctx, outputs) {
    const d = read(ctx, F.designJson, InstructionalDesignSchema);
    const order = [...d.modules.map((m) => m.id), GRADED_MODULE_ID];
    const { storyboard: sb, warnings } = mergeStoryboard({
      courseId: ctx.courseId,
      title: ctx.manifest.course.title,
      language: ctx.manifest.course.language,
      design: d,
      parts: outputs.map((o) => ({ subject: o.subject ?? '', output: o.output as StoryboardModulePart })),
      moduleOrder: order,
      sources: has(ctx, F.sources) ? sources(ctx) : [],
    });
    sb.notes = warnings.map((w) => `${w.location}: ${w.message}`);
    return writeStoryboard(ctx, sb, false);
  },
  async validate(ctx, ids) {
    return storyboardValidators(ctx, F.storyboardJson, ids, 'storyboard');
  },
  repair: () => ({
    path: F.storyboardJson,
    logicalKey: 'storyboard',
    schemas: STORYBOARD_SCHEMAS,
    save: (ctx, doc) => writeStoryboard(ctx, StoryboardSchema.parse(doc), false),
  }),
};

/* ---------------------------------------------------------------- EDITORIAL */

export const editorial: StageHandler = {
  subjects(ctx) {
    const sb = read(ctx, F.storyboardJson, StoryboardSchema);
    const locked = [...lockedIds(ctx, 'storyboard')];
    return sb.modules.map((m) => ({ key: m.id, title: m.title, extra: { module: m, locked } }));
  },
  merge(ctx, outputs) {
    const sb = read(ctx, F.storyboardJson, StoryboardSchema);
    const locked = new Set([...lockedIds(ctx, 'storyboard'), ...lockedIds(ctx, 'storyboard-edited')]);
    const { edited, applied, skipped } = applyEditorial(
      sb,
      outputs.map((o) => ({ subject: o.subject ?? '', output: o.output as EditorialResult })),
      locked,
    );
    const produced = writeStoryboard(ctx, edited, true);
    writeJson(p(ctx, F.editorialDiff), { applied, skipped, changes: editedTextPairs(sb, edited) });
    return produced;
  },
  async validate(ctx, ids) {
    const out = storyboardValidators(
      ctx,
      F.storyboardEditedJson,
      ids.filter((i) => i !== 'editorial-structure' && i !== 'editorial-polarity'),
      'storyboard-edited',
    );
    const before = tryRead(ctx, F.storyboardJson, StoryboardSchema);
    const after = tryRead(ctx, F.storyboardEditedJson, StoryboardSchema);
    if (before && after) {
      if (wants(ids, 'editorial-structure')) out.push(...editorialStructureIssues(before, after));
      if (wants(ids, 'editorial-polarity')) out.push(...polarityIssues(editedTextPairs(before, after)));
    }
    return out;
  },
  repair: () => ({
    path: F.storyboardEditedJson,
    logicalKey: 'storyboard-edited',
    schemas: { blocks: BlockSchema, glossary: GlossaryEntrySchema },
    save: (ctx, doc) => writeStoryboard(ctx, StoryboardSchema.parse(doc), true),
  }),
};

/* --------------------------------------------------------- VISUAL_DIRECTION */

interface VisualSpecsFile {
  visuals: VisualSpec[];
}

function writeVisualDirection(
  ctx: RunContext,
  direction: DesignDirection,
  briefMarkdown: string,
  visuals: VisualSpec[],
  rationale: string,
): Produced[] {
  const sb = canonicalStoryboard(ctx);
  const theme = compileTheme(direction);
  const routes = visuals.map((v) => ({
    visualId: v.id,
    archetype: v.archetype,
    ...routeVisual(v, ctx.registries.routing, ctx.registries.tools),
  }));
  const componentMap = ctx.registries.routing.components;
  writeJson(p(ctx, F.direction), direction);
  writeJson(p(ctx, F.visualSpecs), { visuals } satisfies VisualSpecsFile);
  writeJson(p(ctx, F.designTokens), { direction, tokens: theme.tokens, contrast: theme.contrast });
  writeJson(p(ctx, F.componentPlan), {
    components: componentMap,
    screens: allBlocks(sb).map((b) => ({
      blockId: b.id,
      kind: b.kind,
      component: componentMap[b.kind] ?? 'content',
      visualId: b.visualId,
    })),
    visuals: routes,
  });
  const failing = theme.contrast.filter((c) => !c.pass);
  writeAtomic(
    p(ctx, F.designBrief),
    `${briefMarkdown.trim()}

## Resolved direction

| Parameter | Value |
|---|---|
| Visual family | ${direction.family} |
| Accent hue | ${direction.accentHue}° |
| Density | ${direction.density} |
| Corners | ${direction.corner} |
| Type scale | ${direction.typeScale} |
| Figure style | ${direction.figureStyle} |

Rationale: ${rationale}

## Contrast verification
${theme.contrast.length} colour pairs checked in light and dark schemes; ${failing.length} failing after adjustment; ${theme.contrast.filter((c) => c.adjusted).length} adjusted deterministically.

## Visual routing
| Visual | Archetype | Renderer | Fallbacks | Rule |
|---|---|---|---|---|
${routes.map((r) => `| ${r.visualId} | ${r.archetype} | ${r.renderer} | ${r.fallbacks.join(' → ')} | ${r.rule} |`).join('\n')}
`,
  );
  return [
    { logicalKey: 'direction', path: F.direction, stage: 'VISUAL_DIRECTION' },
    { logicalKey: 'visual-specs', path: F.visualSpecs, stage: 'VISUAL_DIRECTION' },
  ];
}

export function readVisualSpecs(ctx: RunContext): VisualSpec[] {
  const raw = readJson<unknown>(p(ctx, F.visualSpecs));
  const list = Array.isArray(raw) ? raw : (raw as VisualSpecsFile).visuals;
  return list.map((v) => VisualSpecSchema.parse(v));
}

export const visualDirection: StageHandler = {
  generatorExtra(ctx) {
    const sb = canonicalStoryboard(ctx);
    return {
      subject: {
        title: sb.title,
        audience: ctx.manifest.course.audience,
        riskTier: ctx.manifest.course.risk_tier,
        preferredFamily: ctx.manifest.pipeline.visual_family,
      },
      modules: sb.modules.map((m) => ({ id: m.id, title: m.title })),
      visuals: sb.visuals.map((v) => ({
        id: v.id,
        title: v.title,
        purpose: v.purpose,
        archetype: v.archetype,
        itemCount: v.content.items.length,
      })),
      blockKinds: [...new Set(allBlocks(sb).map((b) => b.kind))],
    };
  },
  merge(ctx, outputs) {
    const out = outputs[0]?.output as VisualDirectionAgent;
    const sb = canonicalStoryboard(ctx);
    const byId = new Map(out.visualClassifications.map((c) => [c.visualId, c]));
    const visuals = sb.visuals.map((v) => {
      const c = byId.get(v.id);
      return c ? { ...v, archetype: c.archetype, rendererOverride: c.rendererOverride } : v;
    });
    const family = ctx.manifest.pipeline.visual_family;
    const direction = DesignDirectionSchema.parse(family && family !== out.direction.family ? { ...out.direction, family } : out.direction);
    return writeVisualDirection(ctx, direction, out.briefMarkdown, visuals, out.rationale);
  },
  async validate(ctx, ids) {
    const out = wants(ids, 'schema') ? schemaIssues(ctx, [{ rel: F.direction, schema: DesignDirectionSchema }]) : [];
    if (!has(ctx, F.designTokens)) return out;
    if (wants(ids, 'direction-contrast')) {
      const t = readJson<{ contrast: { pair: string; scheme: string; ratio: number; required: number; pass: boolean }[] }>(
        p(ctx, F.designTokens),
      );
      for (const c of t.contrast.filter((x) => !x.pass))
        out.push({
          checkId: 'direction-contrast',
          severity: 'critical',
          category: 'accessibility',
          location: `${c.pair}/${c.scheme}`,
          problem: `Contrast ${c.ratio.toFixed(2)}:1 below ${c.required}:1`,
          recommendedAction: 'Choose a different accent hue or family.',
        });
    }
    const visuals = has(ctx, F.visualSpecs) ? readVisualSpecs(ctx) : [];
    if (wants(ids, 'visual-routes'))
      for (const v of visuals) {
        try {
          routeVisual(v, ctx.registries.routing, ctx.registries.tools);
        } catch (e) {
          out.push({
            checkId: 'visual-routes',
            severity: 'critical',
            category: 'visual',
            location: v.id,
            problem: `No valid route: ${(e as Error).message}`,
            recommendedAction: 'Use a supported archetype/renderer.',
          });
        }
      }
    if (wants(ids, 'visual-text-equivalents')) out.push(...visualIssues(visuals, allBlocks(canonicalStoryboard(ctx))));
    return out;
  },
  repair: () => ({
    path: F.visualSpecs,
    logicalKey: 'visual-specs',
    schemas: { visuals: VisualSpecSchema },
    save: (ctx, doc) => {
      const direction = read(ctx, F.direction, DesignDirectionSchema);
      const brief = has(ctx, F.designBrief) ? (readText(p(ctx, F.designBrief)).split('\n## Resolved direction')[0] ?? '') : '';
      return writeVisualDirection(
        ctx,
        direction,
        brief,
        (doc as VisualSpecsFile).visuals.map((v) => VisualSpecSchema.parse(v)),
        'Repaired visual specifications.',
      );
    },
  }),
};

/** Default design direction used when a course enters after VISUAL_DIRECTION (e.g. imported HTML). */
export function defaultDirection(ctx: RunContext): DesignDirection {
  return DesignDirectionSchema.parse({
    family: (ctx.manifest.pipeline.visual_family as DesignDirection['family'] | null) ?? 'corporate-professional',
    accentHue: 210,
    density: 'comfortable',
    corner: 'soft',
    typeScale: 'default',
    figureStyle: 'line',
  });
}

export function ensureVisualDirection(ctx: RunContext): void {
  if (has(ctx, F.direction) && has(ctx, F.visualSpecs)) return;
  const sb = canonicalStoryboard(ctx);
  writeVisualDirection(
    ctx,
    defaultDirection(ctx),
    '# Design brief\n\nDefault CourseForge direction applied to an imported course.',
    sb.visuals,
    'Default direction for imported content.',
  );
}

export { canonicalStoryboardPath, GATE_STRICTNESS };
