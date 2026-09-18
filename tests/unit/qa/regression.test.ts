import { describe, expect, it } from 'vitest';
import { compareQaRuns, regressionMarkdown } from '../../../src/qa/regression.js';
import { accessibility, functional, violation } from './helpers.js';

const failing = functional({
  screens: [{ id: 's1', index: 0, viewport: 1440, ok: false, errors: ['page error: x'], overflow: [], missingIds: [] }],
  interactions: [
    { id: 'q1', mode: 'single', correctPath: 'pass', incorrectPath: 'fail', detail: '' },
    { id: 'q2', mode: 'single', correctPath: 'pass', incorrectPath: 'pass', detail: '' },
  ],
  summary: { pass: false, failures: ['screen s1@1440: page error: x', 'console: 3 console/page error(s)'] },
});
const clean = functional({
  interactions: [
    { id: 'q1', mode: 'single', correctPath: 'pass', incorrectPath: 'pass', detail: '' },
    { id: 'q2', mode: 'single', correctPath: 'pass', incorrectPath: 'pass', detail: '' },
  ],
});

describe('compareQaRuns @K7', () => {
  it('improved: failures fixed, a11y down, pass rate up', () => {
    const r = compareQaRuns(
      { functional: failing, accessibility: accessibility([violation('a', 'serious')]) },
      { functional: clean, accessibility: accessibility([]) },
    );
    expect(r.verdict).toBe('improved');
    expect(r.newFailures).toEqual([]);
    expect(r.fixedFailures).toEqual(['console: # console/page error(s)', 'interaction q1', 'screen s1@1440']);
    expect(r.interactionPassRate).toEqual({ before: 50, after: 100 });
    expect(r.a11y.before.serious).toBe(1);
    expect(regressionMarkdown(r)).toContain('**Verdict:** improved');
  });

  it('regressed wins over improvements; identical runs are unchanged', () => {
    expect(
      compareQaRuns({ functional: clean, accessibility: accessibility() }, { functional: failing, accessibility: accessibility() }).verdict,
    ).toBe('regressed');
    const mixed = compareQaRuns(
      { functional: failing, accessibility: accessibility() },
      { functional: clean, accessibility: accessibility([violation('b', 'minor')]) },
    );
    expect(mixed.verdict).toBe('regressed');
    const same = compareQaRuns(
      { functional: clean, accessibility: accessibility() },
      { functional: clean, accessibility: accessibility() },
    );
    expect(same.verdict).toBe('unchanged');
    expect(regressionMarkdown(same)).toContain('- none');
  });
});
