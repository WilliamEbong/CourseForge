import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTraceGraph, buildTraceGraphFromParts, impact, trace, traceIssues, traceSummary } from '../../../src/artifacts/trace.js';

const block = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind,
  title: id,
  loIds: [],
  claimIds: [],
  citations: [],
  visualId: null,
  ...extra,
});

const storyboard = {
  objectives: [],
  modules: [
    {
      id: 'M1',
      title: 'Module 1',
      loIds: ['LO1', 'LO2', 'LO4'],
      blocks: [
        block('B1', 'content', { loIds: ['LO1'], claimIds: ['C1'], citations: [{ sourceId: 'S1', locator: 's.4' }], visualId: 'V1' }),
        block('B2', 'concept', { loIds: ['LO4'] }),
        block('Q1', 'formative', { loIds: ['LO1'] }),
        block('Q2', 'graded', { loIds: ['LO2'] }),
        block('B3', 'content', { claimIds: ['C9'], citations: [{ sourceId: 'S9 p.2', locator: null }] }),
      ],
    },
    { id: 'M2', title: 'Module 2', loIds: ['LO3'], blocks: [block('B2', 'content')] },
  ],
  visuals: [],
  glossary: [{ id: 'C1', term: 'Term named like a claim', sourceIds: ['S1'] }],
};

function writeCourse(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cf-trace-'));
  const put = (rel: string, text: string) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  const jsonl = (rows: object[]) => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;
  put('research/sources.jsonl', jsonl([{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }]));
  put(
    'research/claims.jsonl',
    jsonl([
      { id: 'C1', citations: [{ sourceId: 'S1 s.21', locator: null }], sectionId: 'RS-1' },
      { id: 'C2', citations: [{ sourceId: 'S2', locator: 'p.3' }], sectionId: 'RS-1' },
      { id: 'C3', citations: [], sectionId: null },
    ]),
  );
  put('research/research-dossier.json', JSON.stringify({ sections: [{ sectionId: 'RS-1', claimIds: ['C1', 'C2'], sourceIds: ['S1'] }] }));
  put(
    'design/instructional-design.json',
    JSON.stringify({
      objectives: [
        { id: 'LO1', claimIds: ['C1'], sourceIds: [] },
        { id: 'LO2', claimIds: ['C2'], sourceIds: [] },
        { id: 'LO3', claimIds: [], sourceIds: [] },
        { id: 'LO4', claimIds: [], sourceIds: [] },
      ],
      modules: [
        { id: 'M1', loIds: ['LO1', 'LO2', 'LO4'], sourceIds: [] },
        { id: 'M2', loIds: ['LO3'], sourceIds: [] },
      ],
    }),
  );
  put('storyboard/storyboard.json', JSON.stringify(storyboard));
  put('visual/visual-specs.json', JSON.stringify({ visuals: [{ id: 'V1', sourceIds: ['S2'] }] }));
  put('model/course.json', JSON.stringify({ screens: [{ id: 'B1' }, { id: 'Q1' }, { id: 'X99' }] }));
  return dir;
}

describe('trace graph @F5 @F1', () => {
  const g = buildTraceGraph(writeCourse());
  const keys = (r: { nodes: { key: string }[] }) => r.nodes.map((n) => n.key);

  it('detects orphan / unassessed / untaught / uncited / dangling / duplicate / unused', () => {
    const issues = traceIssues(g).map((i) => `${i.code} ${i.id} ${i.severity}`);
    expect(issues.sort()).toEqual(
      [
        'TRACE-DANGLING-REF claim:C9 critical',
        'TRACE-DANGLING-REF source:S9 critical',
        'TRACE-DANGLING-REF block:X99 critical',
        'TRACE-DUP-ID B2 major',
        'TRACE-ORPHAN-LO LO3 major',
        'TRACE-UNASSESSED-LO LO4 major',
        'TRACE-UNTAUGHT-ITEM Q2 major',
        'TRACE-UNCITED-CLAIM C3 major',
        'TRACE-UNUSED-SOURCE S3 minor',
      ].sort(),
    );
  });

  it('upward trace from a rendered element reaches the sources (locators stripped)', () => {
    const up = keys(trace(g, 'cf-B1', 'up'));
    expect(up).toEqual(
      expect.arrayContaining(['component:C-B1', 'block:B1', 'module:M1', 'lo:LO1', 'claim:C1', 'visual:V1', 'source:S1', 'source:S2']),
    );
    expect(trace(g, 'cf-B1', 'up', 1).nodes.map((n) => n.key)).toEqual(['component:C-B1']);
  });

  it('downward trace from a source reaches learner-facing elements', () => {
    expect(keys(trace(g, 'source:S1', 'down'))).toEqual(
      expect.arrayContaining(['claim:C1', 'section:RS-1', 'lo:LO1', 'block:B1', 'item:Q1', 'component:C-B1', 'element:cf-B1']),
    );
  });

  it('bare ids resolve when unique and fail when ambiguous or unknown', () => {
    expect(trace(g, 'M1', 'down').root).toBe('module:M1');
    expect(() => trace(g, 'C1', 'up')).toThrow(/ambiguous/);
    expect(() => trace(g, 'NOPE', 'up')).toThrow(/no node/);
  });

  it('impact of a changed source lists downstream nodes and stages in pipeline order', () => {
    const r = impact(g, ['source:S2']);
    expect(r.nodes).toEqual(
      expect.arrayContaining(['source:S2', 'claim:C2', 'lo:LO2', 'item:Q2', 'visual:V1', 'block:B1', 'element:cf-B1']),
    );
    expect(r.nodes).not.toContain('source:S1');
    expect(r.stages).toEqual([
      'RESEARCH_DOSSIER',
      'INSTRUCTIONAL_DESIGN',
      'STORYBOARD',
      'EDITORIAL',
      'VISUAL_DIRECTION',
      'COURSE_MODEL',
      'COURSE_BUILD',
    ]);
  });

  it('summarises coverage', () => {
    const s = traceSummary(g);
    expect(s).toMatchObject({ objectives: 4, assessedObjectives: 2, unassessed: ['LO3', 'LO4'], sourcesCited: 2 });
    expect(s.dangling.sort()).toEqual(['block:X99', 'claim:C9', 'source:S9']);
  });
});

describe('trace from parts @F5', () => {
  it('builds from a storyboard object alone; unknown upstream refs become stubs, not dangling', () => {
    const g = buildTraceGraphFromParts({
      storyboard: { ...storyboard, visuals: undefined, objectives: [{ id: 'LO1' }, { id: 'LO2' }, { id: 'LO3' }, { id: 'LO4' }] },
    });
    const codes = traceIssues(g).map((i) => i.code);
    expect(codes).not.toContain('TRACE-DANGLING-REF');
    expect(codes).not.toContain('TRACE-UNCITED-CLAIM');
    expect(g.nodes.get('source:S1')?.label).toContain('unresolved');
    expect(trace(g, 'B1', 'up').nodes.map((n) => n.key)).toEqual(expect.arrayContaining(['module:M1', 'lo:LO1', 'claim:C1', 'source:S1']));
    expect(g.dangling).toEqual([]);
    expect(traceSummary(g).unassessed).toEqual(['LO3', 'LO4']);
  });
});
