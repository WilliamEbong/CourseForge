/**
 * Regression fixture: the examples/chemical-risk lineage (read-only) must classify, normalise and reconstruct with
 * exact counts. The HTML/storyboard counts are the ones stated in 07_html_qa_report.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Block, Storyboard } from '../../../src/core/schemas/content.js';
import { StoryboardSchema } from '../../../src/core/schemas/content.js';
import { CourseModelSchema } from '../../../src/core/schemas/model.js';
import {
  briefFromMarkdown,
  checkContract,
  courseModelFromHtml,
  designFromMarkdown,
  dossierFromMarkdown,
  interactionKeysConsistent,
  type NormalizedDocument,
  parseDocument,
  scoreStages,
  storyboardFromMarkdown,
} from '../../../src/ingestion/index.js';

const DIR = join(import.meta.dirname, '../../../examples/chemical-risk');
const docs = new Map<string, NormalizedDocument>();
const doc = (name: string) => {
  const d = docs.get(name);
  if (!d) throw new Error(`not loaded: ${name}`);
  return d;
};

const EXPECTED: [string, string][] = [
  ['00_research_brief.md', 'RESEARCH_BRIEF'],
  ['01_research_dossier_first_pass.md', 'RESEARCH_DOSSIER'],
  ['02_research_dossier_expanded.md', 'RESEARCH_DOSSIER'],
  ['03_instructional_design_blueprint.md', 'INSTRUCTIONAL_DESIGN'],
  ['04_storyboard.md', 'STORYBOARD'],
  ['05_storyboard_humanized.md', 'EDITORIAL'],
  ['06_interactive_course.html', 'COURSE_BUILD'],
  ['07_html_qa_report.md', 'COURSE_QA'],
];

beforeAll(async () => {
  for (const [name] of EXPECTED) docs.set(name, await parseDocument(readFileSync(join(DIR, name)), name));
});

const blocksOf = (sb: Storyboard): Block[] => sb.modules.flatMap((m) => m.blocks);

describe('chemical-risk lineage', () => {
  it('@F4 @K3 all 8 example files classify to the expected stage with high confidence', () => {
    for (const [name, stage] of EXPECTED) {
      const s = scoreStages(doc(name));
      expect({ name, best: s.best, confidence: s.confidence }).toEqual({ name, best: stage, confidence: 'high' });
    }
  });

  for (const name of ['04_storyboard.md', '05_storyboard_humanized.md'])
    it(`@F4 ${name} normalises with exact counts and valid keys`, () => {
      const { storyboard, counts } = storyboardFromMarkdown(doc(name), { courseId: 'chemical-risk' });
      expect(StoryboardSchema.safeParse(storyboard).success).toBe(true);
      expect(counts).toMatchObject({
        blocks: 133,
        content: 94,
        formative: 24,
        graded: 15,
        interactions: 39,
        modules: 11,
        visuals: 20,
        glossary: 29,
        acronyms: 9,
        references: 38,
        objectives: 6,
      });
      expect(storyboard.modules.map((m) => m.id)).toEqual(['S1', 'S2', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'R', 'GA']);
      const modes: Record<string, number> = {};
      for (const b of blocksOf(storyboard)) {
        if (!b.interaction) continue;
        expect({ id: b.id, ok: interactionKeysConsistent(b.interaction) }).toEqual({ id: b.id, ok: true });
        modes[b.interaction.mode] = (modes[b.interaction.mode] ?? 0) + 1;
      }
      expect(modes).toEqual({ single: 28, multiple: 3, matching: 3, sequencing: 2, categorization: 3 });
      // internal tokens never become external citations; every external citation resolves
      const refs = new Set(storyboard.references.map((r) => r.id));
      const cited = blocksOf(storyboard).flatMap((b) => b.citations.map((c) => c.sourceId));
      expect(cited.filter((id) => !refs.has(id))).toEqual([]);
      expect(cited.some((id) => /dossier|named/i.test(id))).toBe(false);
      expect(storyboard.visuals.every((v) => !/^Alt text/i.test(v.textEquivalent.long))).toBe(true);
      expect(checkContract('STORYBOARD', { storyboard }).find((g) => g.requirement.startsWith('interactions'))?.status).toBe('met');
    });

  it('@K1 @K3 06 HTML reconstructs the complete course model from embedded data', () => {
    const r = courseModelFromHtml(doc('06_interactive_course.html'), { courseId: 'chemical-risk' });
    expect(r.lossy).toBe(false);
    const model = CourseModelSchema.parse(r.model);
    const interactions = model.screens.filter((s) => s.interaction);
    expect({
      screens: model.screens.length,
      interactions: interactions.length,
      references: model.references.length,
      glossary: model.glossary.length,
      acronyms: model.acronyms.length,
      visuals: model.visuals.length,
      modules: model.modules.length,
    }).toEqual({ screens: 133, interactions: 39, references: 38, glossary: 29, acronyms: 9, visuals: 20, modules: 11 });
    expect(model.screens.filter((s) => s.kind === 'formative')).toHaveLength(24);
    expect(model.assessment.gradedScreenIds).toHaveLength(15);
    for (const s of interactions)
      expect({ id: s.id, ok: s.interaction && interactionKeysConsistent(s.interaction) }).toEqual({ id: s.id, ok: true });
    expect(model.version).toBe('1.0.0');
    expect(model.theme).toMatchObject({ family: 'scientific-clinical', accentHue: 180 });
    expect(model.objectives.map((o) => o.id)).toEqual(['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6']);
  });

  it('@F4 HTML model and storyboard 05 agree on structure (the HTML was built from 05)', () => {
    const html = courseModelFromHtml(doc('06_interactive_course.html'), { courseId: 'c' }).model;
    const sb = storyboardFromMarkdown(doc('05_storyboard_humanized.md'), { courseId: 'c' }).storyboard;
    const sbBlocks = blocksOf(sb);
    expect(html?.screens.map((s) => s.id)).toEqual(sbBlocks.map((b) => b.id));
    expect(html?.screens.map((s) => s.interaction?.mode ?? null)).toEqual(sbBlocks.map((b) => b.interaction?.mode ?? null));
  });

  it('@F4 dossier 02 (expanded): minted CLM ids, all bibliography sources, resolved citations', () => {
    const d = dossierFromMarkdown(doc('02_research_dossier_expanded.md'));
    expect(d.sources).toHaveLength(38);
    expect(d.claims.length).toBeGreaterThanOrEqual(38);
    expect(d.claims.length).toBeLessThanOrEqual(46);
    expect(d.claims.map((c) => c.id)).toEqual(d.claims.map((_, i) => `CLM-${String(i + 1).padStart(4, '0')}`));
    expect(d.warnings).toEqual([]);
    expect(d.dossier.sections[27]).toMatchObject({ sectionId: 'RS-28', title: 'Claim-to-source matrix' });
    expect(d.dossier.sections[27]?.claimIds).toHaveLength(d.claims.length);
    expect(d.sources.find((s) => s.id === 'KYUNG-2023')).toMatchObject({
      type: 'peer-reviewed',
      author: 'Kyung M, Lee S-J, Dancu C, Hong O',
    });
    expect(new Set(d.claims.map((c) => c.category)).has('law-regulation')).toBe(true);
    expect(checkContract('RESEARCH_DOSSIER', d).every((g) => g.status !== 'missing')).toBe(true);
  });

  it('@F4 dossier 01 (first pass): S-number sources and ranged citations', () => {
    const d = dossierFromMarkdown(doc('01_research_dossier_first_pass.md'));
    expect(d.sources).toHaveLength(31);
    expect(d.sources[0]).toMatchObject({ id: 'S1', publisher: 'Health Canada', title: 'Roles and responsibilities under WHMIS' });
    expect(d.dossier.sections).toHaveLength(17);
    const capa = d.claims.find((c) => c.text.startsWith('Health Canada NHP CAPA'));
    expect(capa?.citations.map((c) => c.sourceId)).toEqual(['S11', 'S12']);
    expect(d.warnings).toEqual([]);
  });

  it('@F4 design 03 yields LO1–LO6 with Bloom levels and sources', () => {
    const { design } = designFromMarkdown(doc('03_instructional_design_blueprint.md'));
    expect(design.objectives.map((o) => o.id)).toEqual(['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6']);
    expect(design.objectives[0]).toMatchObject({ verb: 'Distinguish', bloomLevel: 'analyze' });
    expect(design.objectives.every((o) => o.sourceIds.length > 0)).toBe(true);
    expect(design.alignment.map((a) => a.loId)).toEqual(['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6']);
    expect(design.dispositions.length).toBeGreaterThan(50);
    expect(design.modules.length).toBeGreaterThanOrEqual(9);
    expect(design.durationMinutes).toBe(120);
  });

  it('@F4 brief 00 yields 21 research questions and a 17-section dossier plan', () => {
    const { brief } = briefFromMarkdown(doc('00_research_brief.md'));
    expect(brief.researchQuestions).toHaveLength(21);
    expect(brief.researchQuestions[0]?.id).toBe('RQ1');
    expect(brief.dossierPlan.map((s) => s.sectionId)).toEqual(Array.from({ length: 17 }, (_, i) => `RS-${String(i + 1).padStart(2, '0')}`));
    expect(brief.jurisdictions).toContain('Alberta, Canada');
  });
});

describe('EDITORIAL structural-diff baseline: 04 vs 05', () => {
  const structure = (b: Block) => ({
    id: b.id,
    kind: b.kind,
    loIds: b.loIds,
    citations: [...b.citations.map((c) => `${c.sourceId} ${c.locator ?? ''}`)].sort(),
    visualId: b.visualId,
    key: b.interaction && {
      mode: b.interaction.mode,
      correctKeys: b.interaction.correctKeys,
      mapping: b.interaction.mapping,
      order: b.interaction.order,
      options: b.interaction.options.map((o) => o.key),
    },
  });

  it('@F4 block ids, kinds, LO maps, citation sets and answer keys are identical', () => {
    const a = storyboardFromMarkdown(doc('04_storyboard.md'), { courseId: 'c' }).storyboard;
    const b = storyboardFromMarkdown(doc('05_storyboard_humanized.md'), { courseId: 'c' }).storyboard;
    expect(blocksOf(b).map(structure)).toEqual(blocksOf(a).map(structure));
    expect(b.references.map((r) => r.id)).toEqual(a.references.map((r) => r.id));
    expect(b.objectives.map((o) => o.id)).toEqual(a.objectives.map((o) => o.id));
  });

  it('@F4 exposes the known polarity defect: "not only" dropped in GA-01 / F1-01 of 05', () => {
    const find = (name: string, id: string) =>
      blocksOf(storyboardFromMarkdown(doc(name), { courseId: 'c' }).storyboard).find((x) => x.id === id);
    for (const id of ['F1-01', 'GA-01']) {
      expect(find('04_storyboard.md', id)?.interaction?.feedbackCorrect).toContain('not only the product classification');
      const humanized = find('05_storyboard_humanized.md', id)?.interaction?.feedbackCorrect ?? '';
      expect(humanized).not.toContain('not only');
      expect(humanized).toContain('the product classification alone');
    }
  });
});
