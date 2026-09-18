import { describe, expect, it } from 'vitest';
import { qaIssues } from '../../../src/qa/issues.js';
import { accessibility, functional, violation } from './helpers.js';

const policy = { axeBlockingImpacts: ['serious', 'critical'] };
const sig = (xs: ReturnType<typeof qaIssues>) => xs.map((i) => `${i.checkId} ${i.severity} ${i.category} ${i.location}`);

describe('qaIssues mapping @J2 @I8', () => {
  it('a clean run yields no issues', () => {
    expect(qaIssues(functional(), accessibility(), policy)).toEqual([]);
  });

  it('maps functional failures to severities/categories', () => {
    const f = functional({
      screens: [
        {
          id: 's1',
          index: 0,
          viewport: 390,
          ok: false,
          errors: ['page error: boom', 'advisory: target-size <24px: x'],
          overflow: ['div#wide'],
          missingIds: ['s1'],
        },
        {
          id: 's2',
          index: 1,
          viewport: 390,
          ok: false,
          errors: ['control without accessible name: button#x'],
          overflow: ['div#wide'],
          missingIds: [],
        },
      ],
      interactions: [{ id: 'q1', mode: 'single', correctPath: 'pass', incorrectPath: 'fail', detail: 'd' }],
      scoring: { checked: true, expectedPercent: 50, actualPercent: 33, ok: false },
      keyboard: { ok: false, focusVisible: false, detail: 'k' },
      offline: { blockedRequests: ['https://x.test/a.js'] },
      consoleErrors: ['err'],
      progress: { persisted: false, resetOk: true },
      navigation: { ok: false, detail: 'n' },
      resources: { glossary: 1, references: 1, ok: false, detail: 'r' },
    });
    expect(sig(qaIssues(f, accessibility(), policy)).sort()).toEqual(
      [
        'qa-functional critical functional s1', // missing id
        'qa-functional critical functional s1', // page error (advisory ignored)
        'qa-accessibility critical accessibility s2', // unnamed control
        'qa-responsive major ui s1', // overflow grouped across s1+s2
        'qa-functional critical assessment q1',
        'qa-functional critical assessment assessment',
        'qa-functional critical functional navigation',
        'qa-functional critical functional resources',
        'qa-functional critical functional progress',
        'qa-accessibility critical accessibility keyboard',
        'qa-accessibility critical accessibility focus',
        'qa-functional critical functional global', // blocked request
        'qa-functional major functional global', // console
      ].sort(),
    );
    const responsive = qaIssues(f, accessibility(), policy).find((i) => i.checkId === 'qa-responsive');
    expect(responsive?.evidence[0]).toBe('screens (2): s1, s2');
  });

  it('maps axe impacts by policy, one issue per rule', () => {
    const a = accessibility([
      violation('color-contrast', 'serious'),
      violation('region', 'moderate'),
      violation('x-minor', 'minor'),
      violation('aria', 'critical'),
    ]);
    const got = Object.fromEntries(qaIssues(functional(), a, policy).map((i) => [i.problem.split(' ')[1], i.severity]));
    expect(got).toEqual({ 'color-contrast': 'critical', region: 'major', 'x-minor': 'minor', aria: 'critical' });
    const lenient = Object.fromEntries(
      qaIssues(functional(), a, { axeBlockingImpacts: ['critical'] }).map((i) => [i.problem.split(' ')[1], i.severity]),
    );
    expect(lenient['color-contrast']).toBe('major');
  });
});
