import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGE_STATUSES } from '../../../src/core/enums.js';
import { IllegalTransitionError } from '../../../src/core/errors.js';
import { repoRoot } from '../../../src/core/paths.js';
import {
  type Block,
  type Interaction,
  type RepairPlan,
  type Storyboard,
  StoryboardModulePartSchema,
} from '../../../src/core/schemas/index.js';
import {
  answerKeyIssues,
  citationIssues,
  findPlaceholders,
  interactionIssues,
  loCoverageIssues,
  visualIssues,
} from '../../../src/pipeline/checks/content.js';
import { editedTextPairs, editorialStructureIssues, polarityIssues } from '../../../src/pipeline/checks/editorial.js';
import { applyEditorial, mergeDossier } from '../../../src/pipeline/compile/merge.js';
import { applyReplacements, indexObjects } from '../../../src/pipeline/repair-target.js';
import { canTransition, nextStatus, stageRange, transitionTable } from '../../../src/pipeline/transitions.js';

const demo = (rel: string) => JSON.parse(readFileSync(join(repoRoot(), 'tests/fixtures/harness/demo', rel), 'utf8')).output;

function demoStoryboard(): Storyboard {
  const parts = ['M1', 'M2', 'GA'].map((m) => StoryboardModulePartSchema.parse(demo(`storyboard-module/${m}.json`)));
  const design = demo('instructional-design/default.json');
  const sources = demo('dossier-section/RS-01.json').sources;
  return {
    schemaVersion: '1',
    courseId: 'demo',
    title: 'Demo',
    subtitle: null,
    language: 'en',
    estimatedMinutes: 20,
    objectives: design.objectives.map((o: { id: string; statement: string }) => ({ id: o.id, text: o.statement })),
    modules: parts.map((p) => p.module),
    glossary: parts.flatMap((p) => p.glossary),
    acronyms: parts.flatMap((p) => p.acronyms),
    references: sources,
    visuals: parts.flatMap((p) => p.visuals),
    assessment: { passingPercent: 75 },
    notes: [],
  };
}

describe('state machine @C1', () => {
  it('rejects illegal transitions', () => {
    expect(() => nextStatus('NOT_STARTED', 'approve')).toThrow(IllegalTransitionError);
    expect(() => nextStatus('LOCKED', 'repair')).toThrow(IllegalTransitionError);
    expect(nextStatus('REVIEWING', 'repair')).toBe('REPAIRING');
    expect(nextStatus('WAITING_FOR_HUMAN', 'human-approve')).toBe('APPROVED');
  });
  it('every status has at least one exit and the table only uses known statuses', () => {
    const t = transitionTable();
    for (const s of STAGE_STATUSES)
      expect(
        t.some((r) => r.from === s),
        s,
      ).toBe(true);
    for (const r of t) expect(STAGE_STATUSES).toContain(r.to);
    expect(canTransition('APPROVED', 'lock')).toBe(true);
  });
  it('stage ranges are ordered and inclusive', () => {
    expect(stageRange('STORYBOARD', 'VISUAL_DIRECTION')).toEqual(['STORYBOARD', 'EDITORIAL', 'VISUAL_DIRECTION']);
    expect(() => stageRange('RELEASE', 'CONCEPT')).toThrow(IllegalTransitionError);
  });
});

describe('deterministic content validators', () => {
  it('the demo storyboard passes answer-key, coverage, citation and visual checks', () => {
    const sb = demoStoryboard();
    expect(answerKeyIssues(sb)).toEqual([]);
    expect(loCoverageIssues(sb).filter((i) => i.severity !== 'minor')).toEqual([]);
    expect(citationIssues(sb).filter((i) => i.severity === 'critical')).toEqual([]);
    expect(
      visualIssues(
        sb.visuals,
        sb.modules.flatMap((m) => m.blocks),
      ).filter((i) => i.severity !== 'minor'),
    ).toEqual([]);
  });
  it('flags inconsistent answer keys per mode', () => {
    const base: Interaction = {
      mode: 'single',
      stem: 'Q',
      options: [
        { key: 'A', text: 'a' },
        { key: 'B', text: 'b' },
      ],
      targets: [],
      correctKeys: ['A', 'B'],
      mapping: [],
      order: [],
      feedbackCorrect: 'y',
      feedbackIncorrect: 'n',
      optionFeedback: [],
      rationale: '',
    };
    expect(interactionIssues('X', base).some((i) => i.problem.includes('exactly one'))).toBe(true);
    const seq: Interaction = {
      ...base,
      mode: 'sequencing',
      correctKeys: [],
      options: [
        { key: 'a', text: '1' },
        { key: 'b', text: '2' },
        { key: 'c', text: '3' },
      ],
      order: ['a', 'b'],
    };
    expect(interactionIssues('Y', seq).some((i) => i.problem.includes('permutation'))).toBe(true);
  });
  it('flags unassessed objectives and dangling citations', () => {
    const sb = demoStoryboard();
    sb.objectives.push({ id: 'LO9', text: 'Orphan' });
    const b = sb.modules[0]?.blocks[1] as Block;
    b.citations = [...b.citations, { sourceId: 'NOPE', locator: null }];
    expect(loCoverageIssues(sb).some((i) => i.location === 'LO9' && i.severity === 'critical')).toBe(true);
    expect(citationIssues(sb).some((i) => i.problem.includes('NOPE'))).toBe(true);
  });
  it('@J6 rejects text equivalents that are authoring instructions', () => {
    const sb = demoStoryboard();
    const v = sb.visuals[0];
    if (!v) throw new Error('fixture');
    v.textEquivalent.short = 'Alt text must state the full loop in order.';
    expect(
      visualIssues(
        sb.visuals,
        sb.modules.flatMap((m) => m.blocks),
      ).some((i) => i.problem.includes('authoring instruction')),
    ).toBe(true);
  });
  it('finds placeholders', () => {
    expect(findPlaceholders([{ location: 'x', text: 'Content TBD later' }])).toHaveLength(1);
    expect(findPlaceholders([{ location: 'x', text: 'A complete sentence.' }])).toHaveLength(0);
  });
});

describe('editorial guard', () => {
  it('applies text-only edits and never touches locked blocks', () => {
    const sb = demoStoryboard();
    const { edited, applied, skipped } = applyEditorial(
      sb,
      [
        {
          subject: 'M1',
          output: {
            edits: [
              { blockId: 'M1-B01', field: 'body', key: null, text: 'New intro.', reason: '' },
              { blockId: 'M1-B02', field: 'body', key: null, text: 'x', reason: '' },
            ],
            notes: '',
          },
        },
      ],
      new Set(['M1-B02']),
    );
    expect(applied).toBe(1);
    expect(skipped.map((s) => s.location)).toContain('M1-B02');
    expect(editorialStructureIssues(sb, edited)).toEqual([]);
  });
  it('detects structural changes', () => {
    const sb = demoStoryboard();
    const after = structuredClone(sb);
    const item = after.modules[1]?.blocks.find((b) => b.id === 'M2-F01');
    if (item?.interaction) item.interaction.correctKeys = ['A'];
    expect(editorialStructureIssues(sb, after).some((i) => i.location === 'M2-F01')).toBe(true);
  });
  it('flags removed negation (the "not only" defect from the reference example) and changed numbers', () => {
    const sb = demoStoryboard();
    const after = structuredClone(sb);
    const b = sb.modules[0]?.blocks[3] as Block;
    b.body = 'Judge risk by exposure and consequence, not only the product classification.';
    const a = after.modules[0]?.blocks[3] as Block;
    a.body = 'Judge risk by exposure and consequence, the product classification alone.';
    const c = after.modules[1]?.blocks[3] as Block;
    c.body = c.body.replace('Early', 'Early (within 5 minutes)');
    const issues = polarityIssues(editedTextPairs(sb, after));
    expect(issues.some((i) => i.location === b.id && i.problem.includes('not only'))).toBe(true);
    expect(issues.some((i) => i.severity === 'critical' && i.problem.includes('numbers'))).toBe(true);
  });
});

describe('merges and scoped repair', () => {
  it('mints stable claim IDs in plan order and renames colliding source IDs', () => {
    const s1 = demo('dossier-section/RS-01.json');
    const s2 = structuredClone(demo('dossier-section/RS-02.json'));
    s2.sources[0].url = 'https://example.org/other';
    const merged = mergeDossier(
      'T',
      [
        { subject: 'RS-02', output: s2 },
        { subject: 'RS-01', output: s1 },
      ],
      ['RS-01', 'RS-02'],
    );
    expect(merged.claims[0]?.id).toBe('CLM-0001');
    expect(merged.claims[0]?.sectionId).toBe('RS-01');
    expect(merged.sources.some((s) => s.id.endsWith('-2'))).toBe(true);
    expect(merged.warnings.length).toBeGreaterThan(0);
  });
  it('@E5 replaces only planned, unlocked, schema-valid objects', async () => {
    const { BlockSchema } = await import('../../../src/core/schemas/index.js');
    const sb = demoStoryboard();
    const target = structuredClone(sb.modules[0]?.blocks.find((b) => b.id === 'M1-F01') as Block);
    target.title = 'Improved';
    const locked = structuredClone(sb.modules[0]?.blocks.find((b) => b.id === 'M1-B02') as Block);
    locked.title = 'Hacked';
    const plan: RepairPlan = {
      schemaVersion: 1,
      stage: 'STORYBOARD',
      cycle: 0,
      artifactId: null,
      target: 'model',
      actions: [
        { actionId: 'A0-01', targetId: 'M1-F01', findingIds: ['F1'], severity: 'major', category: 'assessment', instruction: 'x' },
        { actionId: 'A0-02', targetId: 'M1-B02', findingIds: ['F2'], severity: 'major', category: 'assessment', instruction: 'x' },
      ],
      lockConflicts: [],
      deferred: [],
      rejected: [],
      unrepairable: [],
    };
    const res = applyReplacements(
      sb,
      {
        replacements: [
          { targetId: 'M1-F01', objectJson: JSON.stringify(target), actionIds: ['A0-01'] },
          { targetId: 'M1-B02', objectJson: JSON.stringify(locked), actionIds: ['A0-02'] },
          { targetId: 'M2-B02', objectJson: '{}', actionIds: ['A0-01'] },
        ],
        notes: '',
      },
      plan,
      { schemas: { blocks: BlockSchema }, locked: new Set(['M1-B02']) },
    );
    expect(res.applied).toEqual(['M1-F01']);
    expect(res.rejected.map((r) => r.targetId).sort()).toEqual(['M1-B02', 'M2-B02']);
    expect(indexObjects(res.doc).get('M1-B02')?.container[indexObjects(res.doc).get('M1-B02')?.index ?? 0]).toEqual(
      sb.modules[0]?.blocks[1],
    );
  });
});
