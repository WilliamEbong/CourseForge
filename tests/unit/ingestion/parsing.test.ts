import { describe, expect, it } from 'vitest';
import {
  chooseArchetype,
  expandLoRefs,
  htmlToMarkdownLite,
  interactionKeysConsistent,
  isAuthoringInstruction,
  parseAnswer,
  parseCitationCell,
  parseOptions,
  toVisualSpec,
} from '../../../src/ingestion/index.js';

const ABCDE = 'A. one<br>B. two<br>C. three<br>D. four<br>E. five';

describe('correct-answer prose parsing', () => {
  const cases: {
    name: string;
    type: string;
    options: string;
    correct: string;
    expect: Record<string, unknown>;
  }[] = [
    { name: 'single letter', type: 'multiple choice', options: ABCDE, correct: 'B', expect: { mode: 'single', correctKeys: ['B'] } },
    {
      name: 'single for scenario judgment',
      type: 'scenario judgment',
      options: ABCDE,
      correct: 'C',
      expect: { mode: 'single', correctKeys: ['C'] },
    },
    {
      name: 'multi with "and"',
      type: 'multiple response',
      options: ABCDE,
      correct: 'A, B, C, D, and E',
      expect: { mode: 'multiple', correctKeys: ['A', 'B', 'C', 'D', 'E'] },
    },
    {
      name: 'multi with trailing prose',
      type: 'multiple response',
      options: ABCDE,
      correct: 'A, B, C, D, and E. A–C are explicit triggers; D–E are good practice.',
      expect: { mode: 'multiple', correctKeys: ['A', 'B', 'C', 'D', 'E'] },
    },
    {
      name: 'answer shape beats item-type label',
      type: 'categorization',
      options: 'A. x<br>B. y',
      correct: 'B',
      expect: { mode: 'single', correctKeys: ['B'] },
    },
    {
      name: 'matching arrows',
      type: 'matching',
      options: '1. a<br>2. b<br>3. c',
      correct: '1 → Federal supplier side; 2 → Alberta employer side; 3 → Alberta employer side.',
      expect: {
        mode: 'matching',
        targets: [
          { key: 'T1', text: 'Federal supplier side' },
          { key: 'T2', text: 'Alberta employer side' },
        ],
        mapping: [
          { key: '1', target: 'T1' },
          { key: '2', target: 'T2' },
          { key: '3', target: 'T2' },
        ],
      },
    },
    {
      name: 'categorization numbered list',
      type: 'categorization',
      options: '1. a<br>2. b',
      correct: '1 Correction; 2 Containment.',
      expect: {
        mode: 'categorization',
        mapping: [
          { key: '1', target: 'C1' },
          { key: '2', target: 'C2' },
        ],
      },
    },
    {
      name: 'categorization label groups',
      type: 'categorization',
      options: '1. a<br>2. b<br>3. c<br>4. d',
      correct: 'Evidence/observation: 1 and 3. Interpretation/hypothesis requiring support: 2 and 4.',
      expect: {
        mode: 'categorization',
        targets: [
          { key: 'C1', text: 'Evidence/observation' },
          { key: 'C2', text: 'Interpretation/hypothesis requiring support' },
        ],
        mapping: [
          { key: '1', target: 'C1' },
          { key: '2', target: 'C2' },
          { key: '3', target: 'C1' },
          { key: '4', target: 'C2' },
        ],
      },
    },
    {
      name: 'sequencing with abbreviations and prefixes',
      type: 'sequencing',
      options: 'Elimination; Substitution; Engineering controls; Administrative controls; Personal protective equipment.',
      correct: 'Elimination → Substitution → Engineering → Administrative → PPE.',
      expect: { mode: 'sequencing', order: ['1', '2', '3', '4', '5'] },
    },
    {
      name: 'sequencing shuffled options',
      type: 'sequencing',
      options: 'Preserve evidence; Protect people; Activate local emergency response; Begin investigation when safe.',
      correct: 'Protect people → Activate local emergency response → Preserve evidence when safe → Begin investigation.',
      expect: { mode: 'sequencing', order: ['2', '3', '1', '4'] },
    },
  ];
  for (const c of cases)
    it(`@F4 ${c.name}`, () => {
      const { interaction, warnings } = parseAnswer(c.type, c.options, c.correct);
      expect(interaction).toMatchObject(c.expect);
      expect(interactionKeysConsistent(interaction)).toBe(true);
      expect(warnings).toEqual([]);
    });

  it('unparseable answers warn and stay inconsistent', () => {
    const { interaction, warnings } = parseAnswer('multiple choice', 'A. x<br>B. y', 'See facilitator');
    expect(interactionKeysConsistent(interaction)).toBe(false);
    expect(warnings[0]).toMatch(/unparsed/);
  });

  it('parseOptions keys letters, numbers, or ;-lists', () => {
    expect(parseOptions('A. **x**<br>B. y').map((o) => o.key)).toEqual(['A', 'B']);
    expect(parseOptions('1. x<br>2. y')[1]).toEqual({ key: '2', text: 'y' });
    expect(parseOptions('x; y; z.').map((o) => o.text)).toEqual(['x', 'y', 'z']);
  });
});

describe('objective and citation parsing', () => {
  it('@F4 LO lists and en-dash ranges', () => {
    expect(expandLoRefs('LO1, LO3')).toEqual(['LO1', 'LO3']);
    expect(expandLoRefs('LO1–LO6')).toEqual(['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6']);
    expect(expandLoRefs('LO2-4; LO1')).toEqual(['LO2', 'LO3', 'LO4', 'LO1']);
    expect(expandLoRefs('Enrichment / LO4')).toEqual(['LO4']);
    expect(expandLoRefs('Reference only')).toEqual([]);
  });

  it('@F4 citation tokens: locators split, internal notes excluded', () => {
    const r = parseCitationCell('[AB-OHS-2; AB-OHS-4 ss.16–20; AB-OHS-29 ss.398, 400; source dossier §8]');
    expect(r.citations).toEqual([
      { sourceId: 'AB-OHS-2', locator: null },
      { sourceId: 'AB-OHS-4', locator: 'ss.16–20' },
      { sourceId: 'AB-OHS-29', locator: 'ss.398, 400' },
    ]);
    expect(r.internal).toEqual(['source dossier §8']);
    expect(parseCitationCell('Sources named in block')).toEqual({ citations: [], internal: ['Sources named in block'] });
    expect(parseCitationCell('[AB-OHS-ACT-33(5)] [HPR-5.12]').citations).toEqual([
      { sourceId: 'AB-OHS-ACT-33', locator: '(5)' },
      { sourceId: 'HPR-5.12', locator: null },
    ]);
  });
});

describe('visual heuristics', () => {
  it('@F4 archetype keywords are deterministic', () => {
    expect(chooseArchetype('Teach hierarchy of controls', 'Elimination → PPE')).toBe('HIERARCHY');
    expect(chooseArchetype('Show the complete prevention-to-learning loop')).toBe('FEEDBACK_LOOP');
    expect(chooseArchetype('Show inventory lifecycle')).toBe('LIFECYCLE');
    expect(chooseArchetype('Show WHMIS responsibility split')).toBe('RESPONSIBILITY_MAP');
    expect(chooseArchetype('Compare indicator types')).toBe('COMPARISON');
    expect(chooseArchetype('Organize evidence', 'Four-quadrant diagram')).toBe('EVIDENCE_MAP');
    expect(chooseArchetype('Teach CAPA logic', 'Problem → cause → action')).toBe('PROCESS');
    expect(chooseArchetype('Integrate recurring case', 'Four stages: before, during')).toBe('SCENARIO_MAP');
    expect(chooseArchetype('Show the order', 'Four stages: before, during')).toBe('TIMELINE');
    expect(chooseArchetype('Something else')).toBe('PROCESS');
  });

  it('@F4 authoring-instruction alt text becomes purpose; a real text equivalent is built', () => {
    expect(isAuthoringInstruction('Alt text must state the full loop in order.')).toBe(true);
    expect(isAuthoringInstruction('Elimination first, then engineering controls.')).toBe(false);
    const warnings: string[] = [];
    const v = toVisualSpec(
      {
        id: 'V-01',
        purpose: 'Show the loop',
        content: 'Identify → assess → control',
        sources: '[AB-OHS-2; source dossier §2]',
        alt: 'Alt text must state the loop.',
      },
      warnings,
    );
    expect(v.textEquivalent.long).toBe('Show the loop: Identify → assess → control.');
    expect(v.purpose).toContain('Accessibility requirement: Alt text must state the loop.');
    expect(v.sourceIds).toEqual(['AB-OHS-2']);
    expect(v.content.items.map((i) => i.label)).toEqual(['Identify', 'assess', 'control']);
    expect(v.content.links).toHaveLength(3); // the loop closes back to the first node
    expect(warnings).toHaveLength(1);
  });
});

describe('html → Markdown-lite', () => {
  it('keeps bold/lists/line breaks, drops scripts, decodes entities', () => {
    const md = htmlToMarkdownLite('<p>A <strong>b</strong> &amp; c<br>d</p><ol><li>one</li><li>two</li></ol><script>alert(1)</script>');
    expect(md).toBe('A **b** & c\nd\n\n1. one\n2. two');
  });
});
