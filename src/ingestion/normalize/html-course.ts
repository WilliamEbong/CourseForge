/**
 * Existing HTML course → canonical Storyboard + CourseModel.
 * (a) embedded data (`const COURSE = {…}` / JSON script) → complete reconstruction;
 * (b) DOM heuristics otherwise → partial, `lossy: true`.
 */
import { load } from 'cheerio';
import { z } from 'zod';
import { type BlockKind, type ComponentType, DIFFICULTIES } from '../../core/enums.js';
import { parseWith } from '../../core/fsx.js';
import type { Block, DesignDirection, Interaction, Storyboard, VisualSpec } from '../../core/schemas/content.js';
import { StoryboardSchema } from '../../core/schemas/content.js';
import { type CourseModel, CourseModelSchema } from '../../core/schemas/model.js';
import type { NormalizedDocument } from '../types.js';
import { expandLoRefs, htmlToMarkdownLite, parseCitationTokens, stripMd, uniq } from '../util.js';
import { blockKindFor, moduleRole, optionFeedbackFrom, toSourceRecord, toVisualSpec } from './common.js';
import { storyboardCounts } from './storyboard.js';

export const DEFAULT_THEME: DesignDirection = {
  family: 'scientific-clinical',
  accentHue: 180,
  density: 'comfortable',
  corner: 'soft',
  typeScale: 'default',
  figureStyle: 'line',
};

export interface CourseImport {
  model: CourseModel | null;
  storyboard: Storyboard | null;
  warnings: string[];
  counts: Record<string, number>;
  lossy: boolean;
}

export interface CourseImportOptions {
  courseId?: string;
  sourcePath?: string;
  sourceHash?: string;
}

/* ------------------------------------------------------------------ embedded data shape (untrusted input) */

const Keyed = z.object({ key: z.coerce.string(), text: z.string() });
const QuestionSchema = z.object({
  itemType: z.string().default(''),
  questionHtml: z.string().default(''),
  options: z.array(Keyed).optional(),
  prompts: z.array(Keyed).optional(),
  targets: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  items: z.array(z.string()).optional(),
  correctKey: z.coerce.string().optional(),
  correctKeys: z.array(z.coerce.string()).optional(),
  answerMap: z.record(z.string(), z.string()).optional(),
  correctSequence: z.array(z.string()).optional(),
  feedbackCorrectHtml: z.string().default(''),
  feedbackIncorrectHtml: z.string().default(''),
  mode: z.string().default('single'),
  difficulty: z.string().nullable().optional(),
  accessibility: z.string().nullable().optional(),
});
const ScreenIn = z.object({
  id: z.string(),
  kind: z.string(),
  type: z.string().default(''),
  subtype: z.string().nullable().default(null),
  title: z.string().default(''),
  contentHtml: z.string().optional(),
  treatment: z.string().nullable().default(''),
  visualDirection: z.string().nullable().optional(),
  accessibility: z.string().nullable().optional(),
  objectives: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  module: z.string(),
  moduleTitle: z.string().optional(),
  visual: z.string().nullable().optional(),
  optional: z.boolean().default(false),
  question: QuestionSchema.optional(),
});
const RefIn = z.object({
  id: z.string(),
  issuer: z.string().nullable().optional(),
  title: z.string().default(''),
  date: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});
const VisualIn = z.object({
  id: z.string().optional(),
  purpose: z.string().default(''),
  content: z.string().default(''),
  sources: z.array(z.string()).default([]),
  alt: z.string().default(''),
  note: z.string().optional(),
});
export const EmbeddedCourseSchema = z.object({
  id: z.string().optional(),
  version: z.string().optional(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  estimatedMinutes: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  screens: z.array(ScreenIn).min(1),
  modules: z.record(z.string(), z.string()).default({}),
  glossary: z
    .array(
      z.object({
        term: z.string(),
        definitionHtml: z.string().optional(),
        definition: z.string().optional(),
        sources: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  acronyms: z.array(z.object({ acronym: z.string(), term: z.string(), firstUse: z.string().nullable().optional() })).default([]),
  references: z.union([z.record(z.string(), RefIn), z.array(RefIn)]).default({}),
  visuals: z.union([z.record(z.string(), VisualIn), z.array(VisualIn)]).default({}),
  build: z.object({ assessmentSuggestedPassing: z.string().optional() }).optional(),
});
type ScreenInT = z.infer<typeof ScreenIn>;
type QuestionT = z.infer<typeof QuestionSchema>;

/* ------------------------------------------------------------------ entry point */

export function courseModelFromHtml(doc: NormalizedDocument, opts: CourseImportOptions = {}): CourseImport {
  const embedded = doc.html?.embeddedCourse ?? null;
  if (embedded !== null) {
    const parsed = EmbeddedCourseSchema.safeParse(embedded);
    if (parsed.success) return fromEmbedded(parsed.data, opts);
    const why = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    const res = fromDom(doc, opts);
    res.warnings.unshift(`Embedded course data did not match the expected shape (${why}); fell back to DOM heuristics`);
    return res;
  }
  return fromDom(doc, opts);
}

/* ------------------------------------------------------------------ model compilation */

const COMPONENT: Record<BlockKind, ComponentType> = {
  'section-title': 'module-landing',
  'topic-title': 'module-landing',
  content: 'content',
  concept: 'concept',
  'technical-depth': 'technical-depth',
  example: 'content',
  comparison: 'comparison',
  process: 'process',
  evidence: 'evidence-callout',
  warning: 'warning-callout',
  misconception: 'misconception',
  scenario: 'scenario',
  review: 'review',
  summary: 'review',
  formative: 'question',
  graded: 'assessment-question',
};

/** Deterministic Storyboard → CourseModel (screens = blocks in module order). */
export function modelFromStoryboard(
  sb: Storyboard,
  opts: { version?: string; theme?: DesignDirection; sourceArtifacts?: CourseModel['sourceArtifacts'] } = {},
): CourseModel {
  let index = 0;
  const screens = sb.modules.flatMap((m) =>
    m.blocks.map((b) => ({
      id: b.id,
      index: index++,
      moduleId: m.id,
      kind: b.kind,
      component: COMPONENT[b.kind],
      title: b.title,
      subtype: b.subtype,
      optional: b.optional,
      body: b.body,
      treatment: b.treatment,
      loIds: b.loIds,
      claimIds: b.claimIds,
      citations: b.citations,
      visualId: b.visualId,
      interaction: b.interaction,
      graded: b.kind === 'graded',
      difficulty: b.difficulty,
      accessibility: b.accessibility,
    })),
  );
  return parseWith(
    CourseModelSchema,
    {
      schemaVersion: '1',
      courseId: sb.courseId,
      title: sb.title,
      subtitle: sb.subtitle,
      language: sb.language,
      estimatedMinutes: sb.estimatedMinutes,
      version: opts.version ?? '1.0.0',
      theme: opts.theme ?? DEFAULT_THEME,
      objectives: sb.objectives,
      modules: sb.modules.map((m) => ({
        id: m.id,
        title: m.title,
        summary: m.summary,
        role: m.role,
        loIds: m.loIds,
        screenIds: m.blocks.map((b) => b.id),
      })),
      screens,
      glossary: sb.glossary,
      acronyms: sb.acronyms,
      references: sb.references,
      visuals: sb.visuals,
      visualRoutes: [],
      assessment: { passingPercent: sb.assessment.passingPercent, gradedScreenIds: screens.filter((s) => s.graded).map((s) => s.id) },
      sourceArtifacts: opts.sourceArtifacts ?? [],
    },
    'reconstructed course model',
  );
}

function withCounts(sb: Storyboard, model: CourseModel, warnings: string[], lossy: boolean): CourseImport {
  const c = storyboardCounts(sb);
  return {
    model,
    storyboard: sb,
    warnings,
    lossy,
    counts: { ...c, screens: model.screens.length },
  };
}

/* ------------------------------------------------------------------ (a) embedded data */

function fromEmbedded(c: z.infer<typeof EmbeddedCourseSchema>, opts: CourseImportOptions): CourseImport {
  const warnings: string[] = [];
  const internal = new Set<string>();
  const modules = new Map<string, { title: string; blocks: Block[] }>();
  for (const s of c.screens) {
    let m = modules.get(s.module);
    if (!m) {
      m = { title: c.modules[s.module] ?? s.moduleTitle ?? s.module, blocks: [] };
      modules.set(s.module, m);
    }
    m.blocks.push(screenToBlock(s, warnings, internal));
  }
  if (internal.size) warnings.push(`Internal citation notes kept out of external citations: ${[...internal].slice(0, 8).join('; ')}`);

  const refs = Array.isArray(c.references) ? c.references : Object.values(c.references);
  const visualsIn = Array.isArray(c.visuals) ? c.visuals : Object.entries(c.visuals).map(([id, v]) => ({ ...v, id: v.id ?? id }));
  const visuals: VisualSpec[] = visualsIn.map((v, i) =>
    toVisualSpec(
      {
        id: v.id ?? `V-${String(i + 1).padStart(2, '0')}`,
        purpose: v.purpose,
        content: v.content,
        sources: v.sources.join('; '),
        alt: v.alt,
        ...(v.note ? { note: v.note } : {}),
      },
      warnings,
    ),
  );
  const objectives = (c.metadata['Learning objectives'] ?? '')
    .split(/(?=\bLO\d+\s)|<br\s*\/?>|\n/)
    .map((l) => /^(LO\d+)\s*(?:—|–|-|:)?\s*(.+)$/.exec(stripMd(l.trim())))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ id: m[1] ?? '', text: (m[2] ?? '').trim() }));
  const pass = /(\d{2,3})\s*(?:%|[–-]\s*(\d{2,3})\s*%)/.exec(c.build?.assessmentSuggestedPassing ?? '');

  const sb = parseWith(
    StoryboardSchema,
    {
      schemaVersion: '1',
      courseId: opts.courseId ?? c.id ?? 'imported-course',
      title: c.title,
      subtitle: c.subtitle ?? null,
      language: 'en',
      estimatedMinutes: c.estimatedMinutes ?? null,
      objectives,
      modules: [...modules].map(([id, m], i) => ({
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
      })),
      glossary: c.glossary.map((g, i) => ({
        id: `GL-${String(i + 1).padStart(3, '0')}`,
        term: g.term,
        definition: htmlToMarkdownLite(g.definitionHtml ?? g.definition ?? ''),
        sourceIds: uniq(parseCitationTokens(g.sources).citations.map((x) => x.sourceId)),
      })),
      acronyms: c.acronyms.map((a, i) => ({
        id: `ACR-${String(i + 1).padStart(3, '0')}`,
        acronym: a.acronym,
        expansion: a.term,
        firstUseBlockId: a.firstUse ?? null,
      })),
      references: refs.map((r) =>
        toSourceRecord({ id: r.id, issuer: r.issuer ?? null, title: r.title, date: r.date ?? null, url: r.url ?? null }),
      ),
      visuals,
      assessment: { passingPercent: pass ? Number(pass[2] ?? pass[1]) : 80 },
      notes: pass?.[2] ? [`Imported passing range ${pass[1]}–${pass[2]}%; the upper bound is used`] : [],
    },
    'embedded course data',
  );
  const model = modelFromStoryboard(sb, {
    version: c.version ?? '1.0.0',
    sourceArtifacts: opts.sourcePath ? [{ artifactId: null, path: opts.sourcePath, hash: opts.sourceHash ?? '' }] : [],
  });
  return withCounts(sb, model, warnings, false);
}

function screenToBlock(s: ScreenInT, warnings: string[], internal: Set<string>): Block {
  const graded = s.kind === 'graded';
  const isItem = s.kind === 'formative' || graded;
  const { kind, known } = isItem ? { kind: s.kind as BlockKind, known: true } : blockKindFor(s.type);
  const cites = parseCitationTokens(s.sources);
  for (const x of cites.internal) internal.add(x);
  const loRaw = s.objectives.join(', ');
  const loNote = loRaw
    .replace(/LO\s?\d+(?:\s*[–—-]\s*(?:LO\s?)?\d+)?/g, '')
    .replace(/[,/;\s]+/g, ' ')
    .trim();
  const q = s.question;
  const difficulty = (q?.difficulty ?? '').toLowerCase();
  const treatment = [
    s.treatment ?? '',
    s.visualDirection ? `Visual direction: ${s.visualDirection}` : '',
    loNote ? `Objective mapping note: ${loNote}` : '',
    cites.internal.length ? `Internal references (not external sources): ${cites.internal.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    id: s.id,
    kind,
    subtype: isItem ? (q?.itemType ?? s.subtype) || null : known ? s.subtype : [s.type, s.subtype].filter(Boolean).join(': ') || null,
    title: s.title,
    optional: s.optional,
    body: htmlToMarkdownLite(s.contentHtml ?? q?.questionHtml ?? ''),
    treatment,
    loIds: expandLoRefs(loRaw),
    citations: cites.citations,
    claimIds: [],
    visualId: s.visual ?? null,
    accessibility: s.accessibility ?? q?.accessibility ?? '',
    interaction: q ? questionToInteraction(s.id, q, graded, warnings) : null,
    difficulty: (DIFFICULTIES as readonly string[]).includes(difficulty) ? (difficulty as Block['difficulty']) : null,
  };
}

function questionToInteraction(id: string, q: QuestionT, graded: boolean, warnings: string[]): Interaction {
  const feedbackCorrect = htmlToMarkdownLite(q.feedbackCorrectHtml);
  const feedbackIncorrect = htmlToMarkdownLite(q.feedbackIncorrectHtml);
  const it: Interaction = {
    mode: 'single',
    stem: htmlToMarkdownLite(q.questionHtml),
    options: [],
    targets: [],
    correctKeys: [],
    mapping: [],
    order: [],
    feedbackCorrect,
    feedbackIncorrect,
    optionFeedback: [],
    rationale: graded ? feedbackCorrect : '',
  };
  const mapped = (prefix: string, labels: string[] | undefined) => {
    it.options = q.prompts ?? q.options ?? [];
    const values = q.answerMap ?? {};
    const all = uniq([...(labels ?? []), ...Object.values(values)]);
    it.targets = all.map((text, i) => ({ key: `${prefix}${i + 1}`, text }));
    it.mapping = Object.entries(values).map(([key, v]) => ({ key, target: it.targets.find((t) => t.text === v)?.key ?? '' }));
  };
  switch (q.mode) {
    case 'single':
      it.options = q.options ?? [];
      it.correctKeys = q.correctKey ? [q.correctKey] : [];
      break;
    case 'multi':
    case 'multiple':
      it.mode = 'multiple';
      it.options = q.options ?? [];
      it.correctKeys = q.correctKeys ?? [];
      break;
    case 'matching':
      it.mode = 'matching';
      mapped('T', q.targets);
      break;
    case 'category':
    case 'categorization':
      it.mode = 'categorization';
      mapped('C', q.categories ?? q.targets);
      break;
    case 'sequence':
    case 'sequencing': {
      it.mode = 'sequencing';
      const items = q.items ?? [];
      it.options = items.map((text, i) => ({ key: String(i + 1), text }));
      const used = new Set<string>();
      it.order = (q.correctSequence ?? []).map((text) => {
        const o = it.options.find((x) => x.text === text && !used.has(x.key));
        if (o) used.add(o.key);
        return o?.key ?? '';
      });
      break;
    }
    default:
      warnings.push(`${id}: unknown question mode "${q.mode}"; imported as single choice without a key`);
  }
  it.optionFeedback = optionFeedbackFrom(
    feedbackIncorrect,
    it.options.map((o) => o.key),
  );
  return it;
}

/* ------------------------------------------------------------------ (b) DOM heuristics */

function fromDom(doc: NormalizedDocument, opts: CourseImportOptions): CourseImport {
  const warnings = ['No embedded course data; model reconstructed from DOM heuristics (lossy)'];
  const $ = load(doc.rawHtml ?? '');
  $('script,style,noscript,template').remove();
  const candidates = $('section,article,[data-screen]').filter((_, el) => $(el).find('section,article,[data-screen]').length === 0);
  const nodes = candidates.length ? candidates.toArray() : $('body').toArray();
  const blocks: Block[] = [];
  const idOk = /^[A-Za-z][A-Za-z0-9]*(?:[-_.][A-Za-z0-9]+)*$/;
  nodes.forEach((el, i) => {
    const $el = $(el);
    const raw = $el.attr('data-screen') ?? $el.attr('id') ?? '';
    const id = idOk.test(raw) && !blocks.some((b) => b.id === raw) ? raw : `SCR-${String(i + 1).padStart(3, '0')}`;
    const title = $el.find('h1,h2,h3,h4').first().text().replace(/\s+/g, ' ').trim() || `Screen ${i + 1}`;
    const radios = $el.find('input[type="radio"]');
    const checks = $el.find('input[type="checkbox"]');
    let interaction: Interaction | null = null;
    if (radios.length || checks.length) {
      const inputs = (radios.length ? radios : checks).toArray();
      const options = inputs.map((inp, k) => {
        const idAttr = $(inp).attr('id');
        const label =
          (idAttr ? $el.find(`label[for="${idAttr}"]`).text() : '') || $(inp).parent('label').text() || $(inp).attr('value') || '';
        return { key: String.fromCharCode(65 + (k % 26)), text: label.replace(/\s+/g, ' ').trim() };
      });
      const correctKeys = inputs
        .map((inp, k) => ($(inp).is('[data-correct="true"],[data-correct=""]') ? options[k]?.key : null))
        .filter((k): k is string => !!k);
      if (!correctKeys.length) warnings.push(`${id}: answer key not encoded in the DOM; interaction imported without a key`);
      interaction = {
        mode: radios.length ? 'single' : 'multiple',
        stem: ($el.find('legend').first().text() || title).trim(),
        options,
        targets: [],
        correctKeys,
        mapping: [],
        order: [],
        feedbackCorrect: '',
        feedbackIncorrect: '',
        optionFeedback: [],
        rationale: '',
      };
    }
    blocks.push({
      id,
      kind: interaction ? 'formative' : i === 0 ? 'section-title' : 'content',
      subtype: null,
      title,
      optional: false,
      body: htmlToMarkdownLite($el.html() ?? ''),
      treatment: 'Reconstructed from the DOM of an imported HTML course.',
      loIds: [],
      citations: [],
      claimIds: [],
      visualId: null,
      accessibility: '',
      interaction,
      difficulty: null,
    });
  });

  const references = doc.links.map((url, i) => {
    const text = $(`a[href="${url}"]`).first().text().replace(/\s+/g, ' ').trim();
    return toSourceRecord({ id: `SRC-${String(i + 1).padStart(3, '0')}`, title: text || url, url });
  });
  const visuals: VisualSpec[] = $('figure,svg,img')
    .filter((_, el) => $(el).parents('figure').length === 0)
    .toArray()
    .map((el, i) => {
      const $el = $(el);
      const id = `V-${String(i + 1).padStart(2, '0')}`;
      const alt = (
        $el.find('figcaption').text() ||
        $el.attr('aria-label') ||
        $el.attr('alt') ||
        $el.find('[aria-label]').first().attr('aria-label') ||
        $el.find('img[alt]').first().attr('alt') ||
        $el.find('title').first().text() ||
        ''
      ).trim();
      if (!alt) warnings.push(`${id}: imported figure has no text equivalent`);
      return toVisualSpec({ id, purpose: alt || `Imported figure ${i + 1}`, content: alt, sources: '', alt: alt || '' }, []);
    });
  const glossary = $('dl dt')
    .toArray()
    .map((dt, i) => ({
      id: `GL-${String(i + 1).padStart(3, '0')}`,
      term: $(dt).text().trim(),
      definition: $(dt).next('dd').text().trim(),
      sourceIds: [],
    }))
    .filter((g) => g.term && g.definition);
  const dialogs = doc.html?.dom.dialogs ?? 0;
  if (!blocks.length) {
    return {
      model: null,
      storyboard: null,
      warnings: [...warnings, 'No screens could be identified in the HTML'],
      counts: {},
      lossy: true,
    };
  }
  const sb = parseWith(
    StoryboardSchema,
    {
      schemaVersion: '1',
      courseId: opts.courseId ?? 'imported-course',
      title: doc.title,
      objectives: [],
      modules: [{ id: 'M1', title: doc.title, summary: '', loIds: [], role: 'topic', blocks }],
      glossary,
      references,
      visuals,
      notes: dialogs ? [`${dialogs} dialog(s) present in the original; panels were not reconstructed`] : [],
    },
    'DOM-reconstructed storyboard',
  );
  const model = modelFromStoryboard(sb, {
    sourceArtifacts: opts.sourcePath ? [{ artifactId: null, path: opts.sourcePath, hash: opts.sourceHash ?? '' }] : [],
  });
  return withCounts(sb, model, warnings, true);
}
