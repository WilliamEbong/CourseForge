/**
 * `ingestFile`: preserve the original (byte copy, read-only), parse, infer/validate the stage, normalise into canonical
 * course files, and write `input/intake-report.json`. Never touches state.json / artifacts.json (the pipeline does).
 */
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { z } from 'zod';
import { EXIT, type IntakeMode, STAGES, type Stage, stageIndex } from '../core/enums.js';
import { CfError } from '../core/errors.js';
import { parseWith, toJsonText, writeAtomic, writeFileRaw } from '../core/fsx.js';
import { hashBytes, shortHash } from '../core/hash.js';
import { toJsonl } from '../core/log.js';
import { COURSE_FILES } from '../core/paths.js';
import {
  ConceptBriefSchema,
  InstructionalDesignSchema,
  ResearchBriefSchema,
  ResearchDossierSchema,
  StoryboardSchema,
} from '../core/schemas/content.js';
import { CourseModelSchema } from '../core/schemas/model.js';
import { type IntakeReport, IntakeReportSchema } from '../core/schemas/reports.js';
import { detectFormat, parseDocument } from './adapters/index.js';
import { type ContractArtifacts, checkContract } from './contracts.js';
import { scoreStages } from './infer.js';
import { renderBriefMarkdown, renderDesignMarkdown, renderDossierMarkdown, renderStoryboardMarkdown } from './markdown.js';
import { briefFromMarkdown, conceptFromText } from './normalize/brief.js';
import { designFromMarkdown } from './normalize/design.js';
import { dossierFromMarkdown } from './normalize/dossier.js';
import { courseModelFromHtml } from './normalize/html-course.js';
import { storyboardCounts, storyboardFromMarkdown } from './normalize/storyboard.js';
import type { NormalizedDocument } from './types.js';

/** Imported concept notes are the CONCEPT stage's input; `input/concept.md` is that stage's output. */
export const CONCEPT_REQUEST = 'input/concept-request.md';

export interface IngestFileOptions {
  filePath: string;
  courseDir: string;
  courseId: string;
  declaredStage?: Stage | null;
  mode?: IntakeMode;
  now?: Date;
}

export interface ProducedArtifact {
  /** `COURSE_FILES` key (or `conceptRequest`). */
  logicalKey: string;
  /** Course-relative, forward slashes. */
  path: string;
  stage: Stage;
}

export interface IngestResult {
  report: IntakeReport;
  produced: ProducedArtifact[];
}

const LATE = new Set<Stage>(['COURSE_MODEL', 'COURSE_BUILD', 'COURSE_QA', 'RELEASE']);

export function idKind(id: string): string {
  if (/^LO\d+$/.test(id)) return 'objectives';
  if (/^V-\d+$/.test(id)) return 'visuals';
  if (/^(F\d+|GA)-\d+$/.test(id)) return 'items';
  if (/^[A-Z]\d*-\d{2}$/.test(id)) return 'blocks';
  if (/^CLM-\d+$/.test(id)) return 'claims';
  if (/^RS-\d+$/.test(id)) return 'sections';
  return 'sources';
}

export async function ingestFile(o: IngestFileOptions): Promise<IngestResult> {
  const now = o.now ?? new Date();
  const mode = o.mode ?? 'preserve';
  const name = basename(o.filePath);
  const bytes = readFileSync(o.filePath);
  const format = detectFormat(name, bytes); // fails clearly before anything is written

  // 1. Preserve the original, byte-identical and read-only.
  const originalRel = `${COURSE_FILES.originals}/${shortHash(bytes)}-${name}`;
  const originalAbs = join(o.courseDir, originalRel);
  if (!existsSync(originalAbs)) {
    writeFileRaw(originalAbs, bytes);
    chmodSync(originalAbs, 0o444);
  }

  // 2. Parse and infer.
  const doc = await parseDocument(bytes, name);
  const inferred = scoreStages(doc);
  const warnings = [...doc.warnings];
  const accepted = o.declaredStage ?? inferred.best;
  if (!accepted)
    throw new CfError('STAGE_UNDETERMINED', `Cannot infer the production stage of ${name}; pass --stage explicitly`, {
      exitCode: EXIT.USAGE,
      kind: 'input_invalid',
      detail: { scores: inferred.scores },
    });
  if (o.declaredStage && inferred.best && inferred.best !== o.declaredStage)
    warnings.push(
      `Declared stage ${o.declaredStage} differs from inferred ${inferred.best} (${inferred.confidence}); the declaration is used and validated against its contract`,
    );
  if (!o.declaredStage && inferred.confidence !== 'high')
    warnings.push(`Stage inference confidence is ${inferred.confidence}; confirm the stage or use review-only mode`);

  // 3. Normalise.
  const produced: ProducedArtifact[] = [];
  const emit = (logicalKey: string, rel: string, content: string | Buffer, stage: Stage) => {
    if (typeof content === 'string') writeAtomic(join(o.courseDir, rel), content);
    else writeFileRaw(join(o.courseDir, rel), content);
    produced.push({ logicalKey, path: rel, stage });
  };
  const n = normalise(doc, bytes, accepted, o, originalRel, emit);
  warnings.push(...n.warnings);

  // 4. Report.
  const idsFound: Record<string, number> = {};
  for (const { id } of doc.ids) idsFound[idKind(id)] = (idsFound[idKind(id)] ?? 0) + 1;
  const report = parseWith(
    IntakeReportSchema,
    {
      schemaVersion: 1,
      courseId: o.courseId,
      createdAt: now.toISOString(),
      originals: [{ name, path: originalRel, hash: hashBytes(bytes, name), bytes: bytes.length, format }],
      declaredStage: o.declaredStage ?? null,
      inferred: {
        stage: inferred.best,
        confidence: inferred.confidence,
        method: 'heuristic',
        scores: inferred.scores,
        evidence: inferred.evidence,
      },
      acceptedStage: accepted,
      mode,
      contractGaps: checkContract(accepted, n.artifacts),
      idsFound,
      counts: n.counts,
      producedArtifacts: produced.map((p) => p.path),
      warnings,
      lossy: doc.lossy || !!n.artifacts.lossy,
      nextLegalTargets: STAGES.filter((s) => stageIndex(s) > stageIndex(accepted)),
    },
    'intake report',
  );
  writeAtomic(join(o.courseDir, COURSE_FILES.intakeReport), toJsonText(report));
  return { report, produced };
}

type Emit = (logicalKey: string, rel: string, content: string | Buffer, stage: Stage) => void;

function normalise(
  doc: NormalizedDocument,
  bytes: Buffer,
  stage: Stage,
  o: IngestFileOptions,
  originalRel: string,
  emit: Emit,
): { artifacts: ContractArtifacts; counts: Record<string, number>; warnings: string[] } {
  const warnings: string[] = [];
  const edited = stage === 'EDITORIAL';
  const sbKeys = edited ? (['storyboardEditedJson', 'storyboardEditedMd'] as const) : (['storyboardJson', 'storyboardMd'] as const);
  const sbStage: Stage = edited ? 'EDITORIAL' : 'STORYBOARD';

  // JSON artifacts are validated against the accepted stage's schema and written as-is.
  if (doc.format === 'json') {
    const target: Partial<Record<Stage, [string, string, z.ZodType]>> = {
      CONCEPT: ['conceptJson', COURSE_FILES.conceptJson, ConceptBriefSchema],
      RESEARCH_BRIEF: ['researchBriefJson', COURSE_FILES.researchBriefJson, ResearchBriefSchema],
      RESEARCH_DOSSIER: ['dossierJson', COURSE_FILES.dossierJson, ResearchDossierSchema],
      INSTRUCTIONAL_DESIGN: ['designJson', COURSE_FILES.designJson, InstructionalDesignSchema],
      STORYBOARD: ['storyboardJson', COURSE_FILES.storyboardJson, StoryboardSchema],
      EDITORIAL: ['storyboardEditedJson', COURSE_FILES.storyboardEditedJson, StoryboardSchema],
      COURSE_MODEL: ['courseModel', COURSE_FILES.courseModel, CourseModelSchema],
    };
    const t = target[stage];
    if (!t) return { artifacts: {}, counts: {}, warnings: [`JSON import is not supported for ${stage}; original preserved only`] };
    const res = t[2].safeParse(doc.json);
    if (!res.success) {
      const why = res.error.issues.slice(0, 5).map((i) => `${i.path.map(String).join('.')}: ${i.message}`);
      return { artifacts: {}, counts: {}, warnings: [`JSON does not match the ${stage} schema: ${why.join('; ')}`] };
    }
    emit(t[0], t[1], toJsonText(doc.json), stage);
    const artifacts: ContractArtifacts = {};
    if (stage === 'STORYBOARD' || stage === 'EDITORIAL') artifacts.storyboard = StoryboardSchema.parse(doc.json);
    if (stage === 'COURSE_MODEL') artifacts.model = CourseModelSchema.parse(doc.json);
    if (stage === 'INSTRUCTIONAL_DESIGN') artifacts.design = InstructionalDesignSchema.parse(doc.json);
    if (stage === 'RESEARCH_BRIEF') artifacts.brief = ResearchBriefSchema.parse(doc.json);
    if (stage === 'RESEARCH_DOSSIER') artifacts.dossier = ResearchDossierSchema.parse(doc.json);
    return { artifacts, counts: artifacts.storyboard ? storyboardCounts(artifacts.storyboard) : {}, warnings };
  }

  // HTML (and DOCX) course pages.
  if (doc.html && (doc.format === 'html' || LATE.has(stage))) {
    const imp = courseModelFromHtml(doc, { courseId: o.courseId, sourcePath: originalRel, sourceHash: hashBytes(bytes, doc.name) });
    warnings.push(...imp.warnings);
    if (doc.format === 'html' && LATE.has(stage)) emit('buildHtml', COURSE_FILES.buildHtml, bytes, 'COURSE_BUILD');
    if (imp.model && LATE.has(stage)) emit('courseModel', COURSE_FILES.courseModel, toJsonText(imp.model), 'COURSE_MODEL');
    if (imp.storyboard) {
      emit(sbKeys[0], COURSE_FILES[sbKeys[0]], toJsonText(imp.storyboard), sbStage);
      emit(sbKeys[1], COURSE_FILES[sbKeys[1]], renderStoryboardMarkdown(imp.storyboard), sbStage);
    }
    return { artifacts: { model: imp.model, storyboard: imp.storyboard, lossy: imp.lossy }, counts: imp.counts, warnings };
  }

  switch (stage) {
    case 'CONCEPT': {
      const c = conceptFromText(doc);
      emit('conceptRequest', CONCEPT_REQUEST, c.markdown, 'CONCEPT');
      return {
        artifacts: { conceptText: doc.text },
        counts: { words: doc.text.split(/\s+/).filter(Boolean).length },
        warnings: c.warnings,
      };
    }
    case 'RESEARCH_BRIEF': {
      const b = briefFromMarkdown(doc);
      emit('researchBriefJson', COURSE_FILES.researchBriefJson, toJsonText(b.brief), stage);
      emit('researchBriefMd', COURSE_FILES.researchBriefMd, renderBriefMarkdown(b.brief), stage);
      return {
        artifacts: { brief: b.brief },
        counts: { researchQuestions: b.brief.researchQuestions.length, dossierSections: b.brief.dossierPlan.length },
        warnings: b.warnings,
      };
    }
    case 'RESEARCH_DOSSIER': {
      const d = dossierFromMarkdown(doc);
      emit('dossierJson', COURSE_FILES.dossierJson, toJsonText(d.dossier), stage);
      emit('dossierMd', COURSE_FILES.dossierMd, renderDossierMarkdown(d.dossier, d.sources, d.claims), stage);
      emit('sources', COURSE_FILES.sources, toJsonl(d.sources), stage);
      emit('claims', COURSE_FILES.claims, toJsonl(d.claims), stage);
      return {
        artifacts: { dossier: d.dossier, sources: d.sources, claims: d.claims },
        counts: { sections: d.dossier.sections.length, sources: d.sources.length, claims: d.claims.length },
        warnings: d.warnings,
      };
    }
    case 'INSTRUCTIONAL_DESIGN': {
      const d = designFromMarkdown(doc);
      emit('designJson', COURSE_FILES.designJson, toJsonText(d.design), stage);
      emit('designMd', COURSE_FILES.designMd, renderDesignMarkdown(d.design), stage);
      return {
        artifacts: { design: d.design },
        counts: { objectives: d.design.objectives.length, modules: d.design.modules.length, dispositions: d.design.dispositions.length },
        warnings: d.warnings,
      };
    }
    case 'STORYBOARD':
    case 'EDITORIAL': {
      const s = storyboardFromMarkdown(doc, { courseId: o.courseId });
      emit(sbKeys[0], COURSE_FILES[sbKeys[0]], toJsonText(s.storyboard), sbStage);
      emit(sbKeys[1], COURSE_FILES[sbKeys[1]], renderStoryboardMarkdown(s.storyboard), sbStage);
      return { artifacts: { storyboard: s.storyboard }, counts: s.counts, warnings: s.warnings };
    }
    case 'COURSE_QA':
      return {
        artifacts: {},
        counts: {},
        warnings: [
          'QA reports are evidence only: the original is preserved, nothing canonical is produced; import the course HTML to QA it',
        ],
      };
    default:
      return {
        artifacts: {},
        counts: {},
        warnings: [`A ${doc.format} document cannot be normalised as ${stage}; original preserved only`],
      };
  }
}
