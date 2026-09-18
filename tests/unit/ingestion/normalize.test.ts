import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CourseModelSchema } from '../../../src/core/schemas/model.js';
import {
  checkContract,
  courseModelFromHtml,
  interactionKeysConsistent,
  parseDocument,
  renderBriefMarkdown,
  renderDesignMarkdown,
  renderDossierMarkdown,
  renderStoryboardMarkdown,
  scoreStages,
  storyboardFromMarkdown,
} from '../../../src/ingestion/index.js';

const FIX = join(import.meta.dirname, '../../fixtures/ingest');
const load = (name: string) => parseDocument(readFileSync(join(FIX, name)), name);

describe('storyboard markdown normaliser (fixture)', () => {
  it('@F4 builds modules, blocks, interactions, appendices', async () => {
    const { storyboard: sb, counts, warnings } = storyboardFromMarkdown(await load('mini-storyboard.md'), { courseId: 'mini' });
    expect(counts).toMatchObject({
      modules: 3,
      blocks: 11,
      content: 4,
      formative: 5,
      graded: 2,
      visuals: 2,
      glossary: 1,
      acronyms: 1,
      references: 2,
    });
    expect(sb.modules.map((m) => [m.id, m.title, m.role])).toEqual([
      ['S1', 'Introduction', 'intro'],
      ['T1', 'Controls', 'topic'],
      ['GA', 'Graded assessment', 'graded'],
    ]);
    const blocks = new Map(sb.modules.flatMap((m) => m.blocks).map((b) => [b.id, b]));
    expect(blocks.get('S1-01')).toMatchObject({
      kind: 'section-title',
      loIds: ['LO1', 'LO2'],
      visualId: 'V-01',
      body: 'Hazard is **not** risk.\n\nRisk depends on the task.',
    });
    expect(blocks.get('S1-01')?.citations).toEqual([{ sourceId: 'SRC-A', locator: null }]);
    expect(blocks.get('S1-01')?.treatment).toContain('Internal references (not external sources): source dossier §2');
    expect(blocks.get('S1-02')).toMatchObject({ kind: 'technical-depth', optional: true, loIds: [], citations: [] });
    expect(blocks.get('T1-02')).toMatchObject({ kind: 'content', subtype: 'quiz intro: odd type' });
    expect(blocks.get('T1-01')?.citations).toEqual([{ sourceId: 'SRC-B', locator: 's.9' }]);
    expect(blocks.get('F1-03')?.interaction?.mode).toBe('matching');
    expect(blocks.get('F1-04')?.interaction?.order).toEqual(['2', '3', '1']);
    expect(blocks.get('F1-05')?.interaction?.mode).toBe('categorization');
    expect(blocks.get('F1-01')?.interaction?.optionFeedback).toEqual([{ key: 'A', text: 'They differ.' }]);
    expect(blocks.get('GA-01')).toMatchObject({ kind: 'graded', difficulty: 'applied', title: 'Assessment item 1' });
    expect(blocks.get('GA-02')?.interaction).toMatchObject({ mode: 'single', correctKeys: ['B'], rationale: 'Hood is engineering.' });
    for (const b of blocks.values()) if (b.interaction) expect(interactionKeysConsistent(b.interaction)).toBe(true);
    expect(sb.objectives).toEqual([
      { id: 'LO1', text: 'Distinguish hazard from risk.' },
      { id: 'LO2', text: 'Select controls using the hierarchy.' },
    ]);
    expect(sb.estimatedMinutes).toBe(20);
    expect(sb.references[1]).toMatchObject({ id: 'SRC-B', author: 'Smith J, Doe A', type: 'peer-reviewed' });
    expect(sb.visuals[1]?.textEquivalent.long).toMatch(/^Elimination first/);
    expect(warnings.some((w) => w.startsWith('V-01'))).toBe(true);
    expect(sb.notes.some((n) => n.includes('Appendix F'))).toBe(true);

    const gaps = checkContract('STORYBOARD', { storyboard: sb });
    expect(gaps.find((g) => g.requirement === 'interactions with answer keys')?.status).toBe('met');
    expect(gaps.find((g) => g.requirement === 'citations resolve to references')?.status).toBe('met');
  });

  it('@F4 markdown renderers are deterministic and carry cf:id markers', async () => {
    const { storyboard } = storyboardFromMarkdown(await load('mini-storyboard.md'), { courseId: 'mini' });
    const a = renderStoryboardMarkdown(storyboard);
    expect(renderStoryboardMarkdown(structuredClone(storyboard))).toBe(a);
    expect(a).toContain('<!-- cf:id S1-01 -->\n### S1-01 · Welcome');
    expect(a).toContain('<!-- cf:id V-02 -->');
    expect(a).not.toMatch(/\n0\n/);
    const dossier = {
      schemaVersion: '1' as const,
      title: 'D',
      version: 1,
      sections: [{ sectionId: 'RS-01', title: 'Intro', markdown: 'Body [SRC-A]', claimIds: [], sourceIds: ['SRC-A'] }],
    };
    expect(renderDossierMarkdown(dossier)).toBe(renderDossierMarkdown(dossier));
    expect(renderDossierMarkdown(dossier)).toContain('<!-- cf:id RS-01 -->\n## RS-01 — Intro');
    const brief = {
      title: 'B',
      purpose: 'p',
      audience: 'a',
      scope: ['s'],
      exclusions: ['e'],
      researchQuestions: [{ id: 'RQ1', question: 'q?', priority: 'core' as const }],
      sourceHierarchy: [{ rank: 1, sourceType: 'legislation' as const, rationale: 'r' }],
      jurisdictions: [],
      safetyBoundaries: ['x'],
      dossierPlan: [{ sectionId: 'RS-01', title: 't', questionIds: ['RQ1'], notes: '' }],
      evidenceRequirements: ['cite'],
      currentnessRequirements: ['current'],
    };
    expect(renderBriefMarkdown(brief)).toContain('<!-- cf:id RQ1 -->');
    expect(renderBriefMarkdown(brief)).not.toContain('## Jurisdictions');
    const design = {
      title: 'D',
      audience: 'a',
      prerequisites: [],
      scopeBoundaries: [],
      durationMinutes: 30,
      objectives: [{ id: 'LO1', statement: 's', verb: 'explain', bloomLevel: 'understand' as const, claimIds: [], sourceIds: [] }],
      dispositions: [],
      modules: [],
      alignment: [],
      assessmentStrategy: { formativePerModule: 1, gradedItemCount: 2, passingPercent: 80, notes: 'n' },
      scenarioStrategy: 's',
      glossaryPlan: [],
      evidenceGaps: [],
    };
    expect(renderDesignMarkdown(design)).toBe(renderDesignMarkdown(design));
    expect(renderDesignMarkdown(design)).toContain('<!-- cf:id LO1 -->');
  });
});

describe('html course reconstruction (fixtures)', () => {
  it('@K1 embedded data → exact model', async () => {
    const r = courseModelFromHtml(await load('embedded-course.html'), {
      courseId: 'mini',
      sourcePath: 'input/originals/x.html',
      sourceHash: 'sha256:abc',
    });
    expect(r.lossy).toBe(false);
    const m = CourseModelSchema.parse(r.model);
    expect(m).toMatchObject({
      courseId: 'mini',
      version: '2.0.0',
      title: 'Mini {braces} course',
      assessment: { passingPercent: 70, gradedScreenIds: ['GA-01'] },
    });
    expect(m.screens.map((s) => [s.id, s.component])).toEqual([
      ['S1-01', 'module-landing'],
      ['F1-01', 'question'],
      ['GA-01', 'assessment-question'],
    ]);
    const s1 = m.screens[0];
    expect(s1?.title).toBe('Hi "there" }');
    expect(s1?.body).toBe('Hazard is **not** risk.\nLine two.\n\n- one\n- two');
    expect(s1?.loIds).toEqual(['LO1', 'LO2']);
    expect(s1?.citations).toEqual([{ sourceId: 'SRC-A', locator: null }]);
    expect(m.screens[1]?.interaction).toMatchObject({ mode: 'sequencing', order: ['2', '1'] });
    expect(m.screens[2]?.interaction).toMatchObject({
      mode: 'matching',
      mapping: [
        { key: '1', target: 'T1' },
        { key: '2', target: 'T2' },
      ],
    });
    expect(m.screens[2]?.difficulty).toBe('applied');
    expect(m.objectives.map((o) => o.id)).toEqual(['LO1', 'LO2']);
    expect(m.glossary[0]).toMatchObject({ definition: 'Can cause harm.', sourceIds: ['SRC-A'] });
    expect(m.visuals[0]?.textEquivalent.long).toBe('Show the loop: Identify → assess → control.');
    expect(m.sourceArtifacts).toEqual([{ artifactId: null, path: 'input/originals/x.html', hash: 'sha256:abc' }]);
  });

  it('@K1 DOM fallback → partial model, lossy', async () => {
    const r = courseModelFromHtml(await load('dom-course.html'), { courseId: 'legacy' });
    expect(r.lossy).toBe(true);
    const m = CourseModelSchema.parse(r.model);
    expect(m.screens.map((s) => s.id)).toEqual(['intro', 'quiz-1', 'figure']);
    expect(m.screens[1]?.interaction).toMatchObject({
      mode: 'single',
      correctKeys: ['A'],
      options: [
        { key: 'A', text: 'Flame' },
        { key: 'B', text: 'Skull' },
      ],
    });
    expect(m.references[0]).toMatchObject({ title: 'WHMIS guidance', url: 'https://example.org/whmis' });
    expect(m.visuals).toHaveLength(2);
    expect(m.visuals[0]?.textEquivalent.short).toBe('Label anatomy: pictogram, signal word, hazard statement');
    expect(m.glossary).toEqual([{ id: 'GL-001', term: 'SDS', definition: 'Safety Data Sheet', sourceIds: [] }]);
    expect(r.warnings.some((w) => /no text equivalent/.test(w))).toBe(true);
    expect(checkContract('COURSE_BUILD', { model: m, lossy: true })[0]?.status).toBe('partial');
  });
});

describe('stage inference (fixtures)', () => {
  it('@F4 concept note, storyboard, embedded html', async () => {
    expect(scoreStages(await load('concept.txt'))).toMatchObject({ best: 'CONCEPT', confidence: 'high' });
    expect(scoreStages(await load('mini-storyboard.md'))).toMatchObject({ best: 'STORYBOARD', confidence: 'high' });
    expect(scoreStages(await load('embedded-course.html'))).toMatchObject({ best: 'COURSE_BUILD', confidence: 'high' });
    const sb = storyboardFromMarkdown(await load('mini-storyboard.md'), { courseId: 'mini' }).storyboard;
    const json = await parseDocument(Buffer.from(JSON.stringify(sb)), 'storyboard.json');
    expect(scoreStages(json)).toMatchObject({ best: 'STORYBOARD', confidence: 'high' });
    const empty = await parseDocument(Buffer.from('{"nothing":true}'), 'x.json');
    expect(scoreStages(empty)).toMatchObject({ best: null, confidence: 'low' });
  });
});
