/** Setup wizard: question flow, Enter-accepts-default, re-asking on bad input, reconfigure preselection. */
import { describe, expect, it } from 'vitest';
import { runWizard, type WizardOptions } from '../../../src/cli/wizard.js';
import type { GuidanceConfig } from '../../../src/core/schemas/index.js';
import type { SetupAnswers } from '../../../src/pipeline/api.js';
import { loadRegistries } from '../../../src/routing/registries.js';

const base: SetupAnswers = {
  language: 'en',
  audience: null,
  review: 'recommended',
  tracking: { destination: 'none', endpoint: null, identity: 'name', id_label: null },
};

/** Guidance with every tracking destination offered, independent of which ones config/guidance.json ships. */
function guidanceWithAllDestinations(): GuidanceConfig {
  const g = structuredClone(loadRegistries().guidance);
  g.questions.tracking.options = (['none', 'lms', 'sheet', 'tracker'] as const).map((value) => ({ value, label: value, blurb: '' }));
  return g;
}

function script(replies: string[], over: Partial<WizardOptions> = {}) {
  const asked: string[] = [];
  let out = '';
  const opts: WizardOptions = {
    guidance: loadRegistries().guidance,
    courseId: 'demo',
    title: 'Demo course',
    current: base,
    reconfigure: false,
    io: {
      ask: async (q) => {
        asked.push(q);
        return replies.shift() ?? '';
      },
      write: (t) => {
        out += t;
      },
    },
    ...over,
  };
  return { run: () => runWizard(opts), asked, out: () => out };
}

const SHEET = 'https://script.google.com/macros/s/AKfy-abc_123/exec';

describe('setup wizard', () => {
  it('Enter on every question keeps the defaults', async () => {
    const w = script([]);
    expect(await w.run()).toEqual(base);
    expect(w.out()).toContain('Let\'s set up "Demo course"');
  });

  it('asks few questions and skips a choice with only one option', async () => {
    const w = script([]);
    await w.run();
    // language, audience, review (tracking has one shipped option until a destination exists)
    expect(w.asked.length).toBeLessThanOrEqual(4);
  });

  it('re-asks on invalid input and accepts a valid answer', async () => {
    const w = script(['english!', 'de', '', '9', 'x', '3']);
    const a = await w.run();
    expect(a.language).toBe('de');
    expect(a.review).toBe('every_step');
    expect(w.out()).toContain('Please type a number from 1 to 4');
  });

  it('offers one-shot, recommended, every step and strict review', async () => {
    const picks = await Promise.all(['1', '2', '3', '4'].map((n) => script(['', '', n]).run()));
    expect(picks.map((a) => a.review)).toEqual(['one_shot', 'recommended', 'every_step', 'strict']);
  });

  it('offers "keep custom settings" only when the current review settings are custom', async () => {
    const plain = script([]);
    await plain.run();
    expect(plain.out()).not.toContain('Keep my current custom settings');
    const custom = script([], { current: { ...base, review: 'custom' }, reconfigure: true });
    expect((await custom.run()).review).toBe('custom');
    expect(custom.out()).toContain('Keep my current custom settings');
    expect(custom.out()).toContain('Changing the settings for "Demo course"');
  });

  it('sheet: asks identity and staff-number label, validates the address and sends one test result', async () => {
    const tested: string[] = [];
    const w = script(['', '', '', '3', '2', 'Payroll ID', 'https://example.com/nope', SHEET], {
      guidance: guidanceWithAllDestinations(),
      testEndpoint: async (u) => {
        tested.push(u);
        return null;
      },
    });
    const a = await w.run();
    expect(a.tracking).toEqual({ destination: 'sheet', endpoint: SHEET, identity: 'name_and_id', id_label: 'Payroll ID' });
    expect(tested).toEqual([SHEET]);
    expect(w.out()).toContain("That doesn't look like the right kind of address");
    expect(w.out()).toContain('It worked');
  });

  it('sheet: Enter on the address finishes later, without a test', async () => {
    const tested: string[] = [];
    const w = script(['', '', '', '3', '', ''], {
      guidance: guidanceWithAllDestinations(),
      testEndpoint: async (u) => {
        tested.push(u);
        return null;
      },
    });
    const a = await w.run();
    expect(a.tracking).toMatchObject({ destination: 'sheet', endpoint: null, identity: 'name' });
    expect(tested).toEqual([]);
  });

  it('a failed connection test is reported but the address is kept', async () => {
    const w = script(['', '', '', '3', '', SHEET], { guidance: guidanceWithAllDestinations(), testEndpoint: async () => 'offline' });
    expect((await w.run()).tracking.endpoint).toBe(SHEET);
    expect(w.out()).toContain('The test result did not arrive (offline)');
  });

  it('reconfigure keeps the saved address and does not re-test it', async () => {
    const current: SetupAnswers = { ...base, tracking: { destination: 'sheet', endpoint: SHEET, identity: 'name', id_label: null } };
    const tested: string[] = [];
    const w = script([], {
      current,
      reconfigure: true,
      guidance: guidanceWithAllDestinations(),
      testEndpoint: async (u) => {
        tested.push(u);
        return null;
      },
    });
    expect((await w.run()).tracking).toEqual(current.tracking);
    expect(tested).toEqual([]);
  });

  it('lms asks nothing about identity or addresses; switching to none clears the address', async () => {
    const lms = script(['', '', '', '2'], { guidance: guidanceWithAllDestinations() });
    expect((await lms.run()).tracking).toMatchObject({ destination: 'lms', endpoint: null });
    const current: SetupAnswers = { ...base, tracking: { destination: 'sheet', endpoint: SHEET, identity: 'name_and_id', id_label: 'X' } };
    const off = script(['', '', '', '1'], { current, guidance: guidanceWithAllDestinations() });
    expect((await off.run()).tracking).toEqual(base.tracking);
    const toLms = script(['', '', '', '2'], { current, guidance: guidanceWithAllDestinations() });
    expect((await toLms.run()).tracking).toEqual({ ...base.tracking, destination: 'lms' });
  });

  it('a closed input stream cannot loop forever', async () => {
    const w = script([], { io: { ask: async () => 'nonsense', write: () => {} } });
    expect((await w.run()).language).toBe('en');
  });
});
