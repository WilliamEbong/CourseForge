/**
 * Pure grading shared by the browser runtime and Node tests. Exact key comparison only: no string
 * similarity, no case folding of learner text (learners never type free text).
 */
import type { CfItem, CfResponse } from './types.js';

export interface GradeResult {
  /** All parts answered (incomplete responses are not graded and do not count as an attempt). */
  complete: boolean;
  correct: boolean;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && new Set(a).size === a.length && a.every((k) => b.includes(k));

export function grade(item: Pick<CfItem, 'mode' | 'correctKeys' | 'mapping' | 'order'>, response: CfResponse): GradeResult {
  switch (item.mode) {
    case 'single': {
      const keys = response.keys ?? [];
      return { complete: keys.length === 1, correct: keys.length === 1 && keys[0] === item.correctKeys[0] };
    }
    case 'multiple': {
      const keys = response.keys ?? [];
      return { complete: keys.length > 0, correct: keys.length > 0 && sameSet(keys, item.correctKeys) };
    }
    case 'matching':
    case 'categorization': {
      const given = response.mapping ?? {};
      const expected = Object.keys(item.mapping);
      const complete = expected.length > 0 && expected.every((k) => Boolean(given[k]));
      return { complete, correct: complete && expected.every((k) => given[k] === item.mapping[k]) };
    }
    case 'sequencing': {
      const order = response.order ?? [];
      const complete = order.length === item.order.length && order.length > 0;
      return { complete, correct: complete && order.every((k, i) => k === item.order[i]) };
    }
    case 'reveal':
      return { complete: true, correct: true };
  }
}

export interface GradedSummary {
  answered: number;
  correct: number;
  total: number;
  percent: number | null;
  passed: boolean | null;
}

/** Summative score over graded item ids; percent/passed are null until every graded item is answered. */
export function summarize(
  gradedIds: readonly string[],
  answers: Record<string, { correct: boolean }>,
  passingPercent: number,
): GradedSummary {
  const total = gradedIds.length;
  const answeredIds = gradedIds.filter((id) => answers[id]);
  const correct = answeredIds.filter((id) => answers[id]!.correct).length;
  const done = total > 0 && answeredIds.length === total;
  const percent = done ? Math.round((correct / total) * 100) : null;
  return { answered: answeredIds.length, correct, total, percent, passed: percent === null ? null : percent >= passingPercent };
}
