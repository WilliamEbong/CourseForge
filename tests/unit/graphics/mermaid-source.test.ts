import { describe, expect, it } from 'vitest';
import { mermaidLabel, mermaidSource } from '../../../src/graphics/mermaid.js';
import { FIXTURES, HOSTILE, makeSpec } from '../../fixtures/visuals/index.js';

const f = (k: keyof typeof FIXTURES & string) => {
  const s = FIXTURES[k];
  if (!s) throw new Error(`missing fixture ${k}`);
  return s;
};

describe('mermaidSource @H1', () => {
  it('PROCESS and CAUSE_EFFECT → flowchart LR (chain when no links)', () => {
    const src = mermaidSource(f('process'));
    expect(src.split('\n')[0]).toBe('flowchart LR');
    expect(src).toContain('n_identify["Identify the hazard"]');
    expect(src).toContain('n_identify --> n_assess');
    expect(mermaidSource(f('cause')).startsWith('flowchart LR')).toBe(true);
  });

  it('DECISION_TREE → flowchart TD with decision diamonds and labelled edges', () => {
    const src = mermaidSource(f('decision'));
    expect(src.startsWith('flowchart TD')).toBe(true);
    expect(src).toContain('n_q1{"Is the substance hazardous?"}');
    expect(src).toContain('n_a1("No COSHH action needed")');
    expect(src).toContain('n_q1 -->|"Yes"| n_q2');
  });

  it('SYSTEM_ARCHITECTURE → subgraphs from groups', () => {
    const src = mermaidSource(f('architecture'));
    expect(src).toContain('subgraph g_ext["Extraction"]');
    expect(src).toMatch(/subgraph g_ext\["Extraction"\]\n {4}n_duct\["Ducting"\]/);
    expect(src).toContain('  end');
  });

  it('HIERARCHY → flowchart TD', () => {
    expect(mermaidSource(f('hierarchy'))).toMatch(/^flowchart TD\n/);
  });

  it('TIMELINE → timeline with period : event lines', () => {
    const src = mermaidSource(f('timeline'));
    expect(src.split('\n')[0]).toBe('timeline');
    expect(src).toContain('  1974 : Health and Safety at Work Act');
  });

  it('SEQUENCE → sequenceDiagram (items = participants, links = messages)', () => {
    const src = mermaidSource(f('sequence'));
    expect(src).toContain('sequenceDiagram');
    expect(src).toContain('participant p_w as Worker');
    expect(src).toContain('p_w->>p_s: Reports spill');
    // Colon inside a message would end the grammar token; it is swapped for a look-alike.
    expect(src).toContain('p_s->>p_h: Escalates꞉ “major” spill');
  });

  it('STATE_DIAGRAM → stateDiagram-v2 with start state', () => {
    const src = mermaidSource(f('state'));
    expect(src).toContain('stateDiagram-v2');
    expect(src).toContain('state "Under review" as s_review');
    expect(src).toContain('[*] --> s_draft');
    expect(src).toContain('s_review --> s_approved: sign off');
  });

  it('explicit spec.mermaid wins', () => {
    const spec = makeSpec('x', 'PROCESS', {}, { mermaid: 'flowchart LR\n  a-->b' });
    expect(mermaidSource(spec)).toBe('flowchart LR\n  a-->b');
  });

  it('escapes hostile labels and sanitises ids', () => {
    const src = mermaidSource(HOSTILE);
    expect(src).not.toMatch(/<script>/i);
    expect(src).not.toMatch(/"[^"\n]*"[^"\n]*"[^\]\n]*\]/); // no stray quote inside a quoted label
    expect(src).toContain('n_a_b["Say “hello” ＜script＞alert(1)＜/script＞"]');
    expect(src).toContain('n_c_d_["Brackets [x] {y} (z) & ampersand ＃hash; semi"]');
    for (const line of src.split('\n').slice(1)) expect(line).toMatch(/^\s+n_[A-Za-z0-9_]+(\[|\s-->)/);
    expect(mermaidLabel('a:b;c', true)).toBe('a꞉b；c');
    expect(mermaidLabel('multi\nline   text')).toBe('multi line text');
    expect(mermaidLabel('%%{init: x}%%')).not.toContain('%%');
  });

  it('deduplicates colliding sanitised ids', () => {
    const spec = makeSpec('c', 'PROCESS', {
      items: [
        { id: 'a-b', label: 'One', detail: null, group: null, value: null },
        { id: 'a.b', label: 'Two', detail: null, group: null, value: null },
      ],
    });
    const src = mermaidSource(spec);
    expect(src).toContain('n_a_b["One"]');
    expect(src).toContain('n_a_b_2["Two"]');
    expect(src).toContain('n_a_b --> n_a_b_2');
  });
});
