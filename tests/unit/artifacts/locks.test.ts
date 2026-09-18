import { describe, expect, it } from 'vitest';
import { regionHashes } from '../../../src/artifacts/locks.js';
import { hashJson } from '../../../src/core/hash.js';

describe('region hashes @C8', () => {
  it('JSON: finds nested objects by id, key-order independent', () => {
    const a = regionHashes(JSON.stringify({ x: [{ id: 'LO1', b: 1, a: 2 }] }), 'd.json', ['LO1', 'LO9']);
    expect(a.LO1).toBe(hashJson({ a: 2, b: 1, id: 'LO1' }));
    expect(a.LO9).toBeNull();
  });

  it('JSONL: searches each record', () => {
    const h = regionHashes('{"id":"S1","t":"a"}\n{"id":"S2","t":"b"}\n', 'sources.jsonl', ['S2']);
    expect(h.S2).toBe(hashJson({ id: 'S2', t: 'b' }));
  });

  it('Markdown: region ends at the next same-or-higher heading, not at deeper ones', () => {
    const md = '## A\n<!-- cf:id X -->\n### X title\nbody\n#### deeper\nmore\n### Next\nafter';
    const base = regionHashes(md, 'f.md', ['X']).X;
    expect(base).toMatch(/^sha256:/);
    expect(regionHashes(md.replace('after', 'changed'), 'f.md', ['X']).X).toBe(base);
    expect(regionHashes(md.replace('more', 'changed'), 'f.md', ['X']).X).not.toBe(base);
    expect(regionHashes(md.replace(/\n/g, '\r\n'), 'f.md', ['X']).X).toBe(base);
  });

  it('Markdown: marker inside a section runs to the next marker', () => {
    const md = '## A\nintro\n<!-- cf:id P1 -->\npara one\n<!-- cf:id P2 -->\npara two\n## B';
    const h = regionHashes(md, 'f.md', ['P1', 'P2', 'P3']);
    expect(regionHashes(md.replace('para two', 'x'), 'f.md', ['P1']).P1).toBe(h.P1);
    expect(h.P3).toBeNull();
  });
});
