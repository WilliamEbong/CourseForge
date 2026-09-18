import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { RepairPlan } from '../../../src/core/schemas/review.js';
import { applyHtmlEdits, applyRepairResult, lockedRegionHashes } from '../../../src/review/apply.js';

const BlockSchema = z.strictObject({ id: z.string(), title: z.string(), body: z.string() });
const block = (id: string, body = `body of ${id}`) => ({ id, title: `Title ${id}`, body });

const storyboard = () => ({
  schemaVersion: '1',
  modules: [
    { id: 'M1', title: 'Module 1', blocks: [block('B-01'), block('B-02'), block('Q-02')] },
    { id: 'M2', title: 'Module 2', blocks: [block('B-05')] },
  ],
});

const plan: RepairPlan = {
  schemaVersion: 1,
  stage: 'STORYBOARD',
  cycle: 1,
  artifactId: 'ART-SB',
  target: 'model',
  actions: [
    { actionId: 'A1-01', targetId: 'B-02', findingIds: ['SB-C1-001'], severity: 'major', category: 'accuracy', instruction: 'fix' },
    { actionId: 'A1-02', targetId: 'Q-02', findingIds: ['SB-C1-002'], severity: 'major', category: 'assessment', instruction: 'fix' },
    { actionId: 'A1-03', targetId: 'M2', findingIds: ['SB-C1-003'], severity: 'minor', category: 'structure', instruction: 'fix' },
  ],
  lockConflicts: [],
  deferred: [],
  rejected: [],
  unrepairable: [],
};

const locked = new Set(['Q-02', 'B-05']);
const schemaFor = (id: string) => (id.startsWith('M') ? z.object({ id: z.string() }).passthrough() : BlockSchema);
const repl = (targetId: string, obj: unknown, actionIds: string[]) => ({ targetId, objectJson: JSON.stringify(obj), actionIds });

describe('applyRepairResult @E5 @C5', () => {
  it('applies the planned replacement and rejects locked / out-of-plan targets', () => {
    const art = storyboard();
    const hashesBefore = lockedRegionHashes(art, locked);
    const out = applyRepairResult(
      art,
      {
        replacements: [
          repl('B-02', block('B-02', 'repaired'), ['A1-01']),
          repl('Q-02', block('Q-02', 'malicious'), ['A1-02']),
          repl('B-01', block('B-01', 'sneaky'), ['A1-01']),
        ],
        notes: '',
      },
      plan,
      { lockedIds: locked, schemaFor },
    );
    expect(out.applied).toEqual(['B-02']);
    expect(out.rejected).toEqual([
      { targetId: 'Q-02', reason: 'target is locked' },
      { targetId: 'B-01', reason: 'target is not in the repair plan' },
    ]);
    expect(out.artifact.modules[0]?.blocks.map((b) => b.body)).toEqual(['body of B-01', 'repaired', 'body of Q-02']);
    expect(lockedRegionHashes(out.artifact, locked)).toEqual(hashesBefore);
    expect(Object.values(hashesBefore).every((h) => h?.startsWith('sha256:'))).toBe(true);
    // input untouched
    expect(art.modules[0]?.blocks[1]?.body).toBe('body of B-02');
  });

  it('rejects a replacement of a parent that would alter a locked child', () => {
    const art = storyboard();
    const out = applyRepairResult(
      art,
      { replacements: [repl('M2', { id: 'M2', title: 'Module 2', blocks: [block('B-05', 'changed')] }, ['A1-03'])], notes: '' },
      plan,
      { lockedIds: locked, schemaFor },
    );
    expect(out.applied).toEqual([]);
    expect(out.rejected).toEqual([{ targetId: 'M2', reason: 'replacement would modify locked content' }]);
    expect(out.artifact).toEqual(art);
  });

  it.each([
    ['schema-invalid', repl('B-02', { id: 'B-02', title: 'x' }, ['A1-01']), /^schema invalid/],
    ['id mismatch', repl('B-02', block('B-99'), ['A1-01']), /id does not match/],
    ['foreign action id', repl('B-02', block('B-02'), ['A1-02']), /actionIds/],
    ['unknown action id', repl('B-02', block('B-02'), ['A9-99']), /actionIds/],
    ['no action ids', repl('B-02', block('B-02'), []), /actionIds/],
    ['bad JSON', { targetId: 'B-02', objectJson: '{', actionIds: ['A1-01'] }, /not valid JSON/],
  ])('rejects %s', (_n, r, reason) => {
    const out = applyRepairResult(storyboard(), { replacements: [r], notes: '' }, plan, { lockedIds: locked, schemaFor });
    expect(out.applied).toEqual([]);
    expect(out.rejected[0]?.reason).toMatch(reason);
    expect(out.artifact).toEqual(storyboard());
  });

  it('rejects when no schema is available', () => {
    const out = applyRepairResult(storyboard(), { replacements: [repl('B-02', block('B-02'), ['A1-01'])], notes: '' }, plan, {
      lockedIds: locked,
      schemaFor: () => null,
    });
    expect(out.rejected).toEqual([{ targetId: 'B-02', reason: 'no schema' }]);
  });
});

describe('applyHtmlEdits @E5', () => {
  const html = '<main><p class="a">One</p><p class="b">Two</p><p class="b">Two</p><script>go()</script></main>';
  const htmlPlan: RepairPlan = { ...plan, target: 'html-direct' };

  it('applies exact-once edits sequentially and rejects the rest', () => {
    const out = applyHtmlEdits(
      html,
      {
        edits: [
          { actionId: 'A1-01', find: '<p class="a">One</p>', replace: '<p class="a">Uno</p>' },
          { actionId: 'A1-02', find: '<p class="b">Two</p>', replace: 'x' },
          { actionId: 'A1-03', find: 'missing', replace: 'x' },
          { actionId: 'A9-99', find: 'Uno', replace: 'x' },
          { actionId: 'A1-01', find: 'Uno', replace: 'Eins' },
        ],
        notes: '',
      },
      htmlPlan,
    );
    expect(out.html).toBe(html.replace('One', 'Eins'));
    expect(out.applied).toEqual(['A1-01', 'A1-01']);
    expect(out.rejected).toEqual([
      { actionId: 'A1-02', reason: 'ambiguous' },
      { actionId: 'A1-03', reason: 'not found' },
      { actionId: 'A9-99', reason: 'action is not in the repair plan' },
    ]);
  });

  it('guards the script count', () => {
    const out = applyHtmlEdits(
      html,
      {
        edits: [
          { actionId: 'A1-01', find: '<p class="a">One</p>', replace: '<script>evil()</script>' },
          { actionId: 'A1-02', find: '<script>go()</script>', replace: '' },
          { actionId: 'A1-03', find: '<script>go()</script>', replace: '<script>go2()</script>' },
        ],
        notes: '',
      },
      htmlPlan,
    );
    expect(out.rejected.map((r) => r.actionId)).toEqual(['A1-01', 'A1-02']);
    expect(out.applied).toEqual(['A1-03']);
    expect(out.html).toContain('go2()');
  });
});
