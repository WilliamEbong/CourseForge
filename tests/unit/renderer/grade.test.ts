import { describe, expect, it } from 'vitest';
import { grade, summarize } from '../../../components/course-ui/src/runtime/grade.js';
import type { CfItem, CfResponse } from '../../../components/course-ui/src/runtime/types.js';

type ItemKeys = Pick<CfItem, 'mode' | 'correctKeys' | 'mapping' | 'order'>;
const item = (p: Partial<ItemKeys> & Pick<ItemKeys, 'mode'>): ItemKeys => ({ correctKeys: [], mapping: {}, order: [], ...p });

const cases: Array<[string, ItemKeys, CfResponse, { complete: boolean; correct: boolean }]> = [
  ['single correct', item({ mode: 'single', correctKeys: ['b'] }), { keys: ['b'] }, { complete: true, correct: true }],
  ['single wrong', item({ mode: 'single', correctKeys: ['b'] }), { keys: ['a'] }, { complete: true, correct: false }],
  ['single empty', item({ mode: 'single', correctKeys: ['b'] }), { keys: [] }, { complete: false, correct: false }],
  ['single case is exact', item({ mode: 'single', correctKeys: ['b'] }), { keys: ['B'] }, { complete: true, correct: false }],
  ['multiple exact set', item({ mode: 'multiple', correctKeys: ['a', 'c'] }), { keys: ['c', 'a'] }, { complete: true, correct: true }],
  ['multiple subset', item({ mode: 'multiple', correctKeys: ['a', 'c'] }), { keys: ['a'] }, { complete: true, correct: false }],
  ['multiple superset', item({ mode: 'multiple', correctKeys: ['a', 'c'] }), { keys: ['a', 'b', 'c'] }, { complete: true, correct: false }],
  ['multiple duplicates', item({ mode: 'multiple', correctKeys: ['a', 'c'] }), { keys: ['a', 'a'] }, { complete: true, correct: false }],
  ['multiple none', item({ mode: 'multiple', correctKeys: ['a'] }), { keys: [] }, { complete: false, correct: false }],
  [
    'matching correct',
    item({ mode: 'matching', mapping: { x: '1', y: '2' } }),
    { mapping: { x: '1', y: '2' } },
    { complete: true, correct: true },
  ],
  [
    'matching swapped',
    item({ mode: 'matching', mapping: { x: '1', y: '2' } }),
    { mapping: { x: '2', y: '1' } },
    { complete: true, correct: false },
  ],
  [
    'matching missing',
    item({ mode: 'matching', mapping: { x: '1', y: '2' } }),
    { mapping: { x: '1', y: '' } },
    { complete: false, correct: false },
  ],
  [
    'categorization correct',
    item({ mode: 'categorization', mapping: { a: 'k', b: 'k', c: 'm' } }),
    { mapping: { a: 'k', b: 'k', c: 'm' } },
    { complete: true, correct: true },
  ],
  [
    'categorization one off',
    item({ mode: 'categorization', mapping: { a: 'k', b: 'k', c: 'm' } }),
    { mapping: { a: 'k', b: 'm', c: 'm' } },
    { complete: true, correct: false },
  ],
  [
    'sequencing correct',
    item({ mode: 'sequencing', order: ['1', '2', '3'] }),
    { order: ['1', '2', '3'] },
    { complete: true, correct: true },
  ],
  [
    'sequencing swapped',
    item({ mode: 'sequencing', order: ['1', '2', '3'] }),
    { order: ['2', '1', '3'] },
    { complete: true, correct: false },
  ],
  ['sequencing short', item({ mode: 'sequencing', order: ['1', '2', '3'] }), { order: ['1', '2'] }, { complete: false, correct: false }],
  ['reveal always complete', item({ mode: 'reveal' }), {}, { complete: true, correct: true }],
];

describe('grade() @G6', () => {
  it.each(cases)('@G6 %s', (_name, it_, response, expected) => {
    expect(grade(it_, response)).toEqual(expected);
  });

  it('@G6 summarize: percent and pass only once every graded item is answered', () => {
    const ids = ['q1', 'q2', 'q3'];
    expect(summarize(ids, {}, 65)).toEqual({ answered: 0, correct: 0, total: 3, percent: null, passed: null });
    expect(summarize(ids, { q1: { correct: true } }, 65)).toMatchObject({ answered: 1, percent: null });
    expect(summarize(ids, { q1: { correct: true }, q2: { correct: true }, q3: { correct: false } }, 65)).toEqual({
      answered: 3,
      correct: 2,
      total: 3,
      percent: 67,
      passed: true,
    });
    expect(summarize(ids, { q1: { correct: false }, q2: { correct: false }, q3: { correct: false } }, 65)).toMatchObject({
      percent: 0,
      passed: false,
    });
    expect(summarize(ids, { q1: { correct: true }, q2: { correct: true }, q3: { correct: true } }, 100)).toMatchObject({
      percent: 100,
      passed: true,
    });
    // ungraded answers never count
    expect(summarize(ids, { other: { correct: true } }, 65)).toMatchObject({ answered: 0 });
  });
});
