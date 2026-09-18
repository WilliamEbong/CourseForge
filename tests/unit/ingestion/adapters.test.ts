import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CfError } from '../../../src/core/errors.js';
import { detectFormat, extractEmbeddedCourse, parseDocument, scanBalanced } from '../../../src/ingestion/index.js';
import { makeDocx, makePdf } from './binaries.js';

const FIX = join(import.meta.dirname, '../../fixtures/ingest');
const fixture = (name: string) => readFileSync(join(FIX, name));

describe('ingestion adapters', () => {
  it('@F4 markdown: headings with line numbers, tables, ids, links', async () => {
    const doc = await parseDocument(fixture('mini-storyboard.md'), 'mini-storyboard.md');
    expect(doc.format).toBe('md');
    expect(doc.title).toBe('Mini Lab Safety Course');
    const lines = doc.text.split('\n');
    for (const h of doc.headings) expect(lines[h.line - 1]).toContain(h.text.split(' ')[0]);
    const blockTable = doc.tables.find((t) => t.header[0] === 'Block ID');
    expect(blockTable?.rows[0]?.[0]).toBe('S1-01');
    expect(lines[(blockTable?.line ?? 0) - 1]).toMatch(/^\| Block ID/);
    expect(doc.ids.map((i) => i.id)).toEqual(expect.arrayContaining(['S1-01', 'F1-01', 'GA-02', 'V-01', 'LO1', 'SRC-A']));
    expect(doc.links).toContain('https://example.org/ohs-part-2');
  });

  it('@F4 txt and json', async () => {
    const txt = await parseDocument(fixture('concept.txt'), 'concept.txt');
    expect(txt.format).toBe('txt');
    expect(txt.tables).toEqual([]);
    const json = await parseDocument(Buffer.from('{"title":"T","x":[1]}'), 'a.json');
    expect(json.json).toEqual({ title: 'T', x: [1] });
    expect(json.title).toBe('T');
    await expect(parseDocument(Buffer.from('{bad'), 'a.json')).rejects.toThrow(/Cannot parse JSON/);
  });

  it('@K1 html: embedded course via bracket-balanced scan, DOM summary', async () => {
    const doc = await parseDocument(fixture('embedded-course.html'), 'embedded-course.html');
    const c = doc.html?.embeddedCourse as { title: string; screens: unknown[] };
    expect(c.title).toBe('Mini {braces} course');
    expect(c.screens).toHaveLength(3);
    expect(doc.html?.interactionHints).toContain('embedded-course-data:const COURSE');
    const dom = await parseDocument(fixture('dom-course.html'), 'dom-course.html');
    expect(dom.html?.embeddedCourse).toBeNull();
    expect(dom.html?.dom.radios).toBe(2);
    expect(dom.html?.dom.dialogs).toBe(1);
    expect(dom.links).toContain('https://example.org/whmis');
    expect(dom.text).not.toContain('addEventListener');
  });

  it('scanBalanced ignores brackets inside strings; JSON script fallback', () => {
    const src = 'x = {"a":"}{","b":[1,{"c":"\\"}"}]} ; tail';
    const end = scanBalanced(src, src.indexOf('{'));
    expect(JSON.parse(src.slice(src.indexOf('{'), end))).toEqual({ a: '}{', b: [1, { c: '"}' }] });
    const r = extractEmbeddedCourse('<script type="application/json">{"title":"J"}</script>');
    expect(r).toMatchObject({ value: { title: 'J' }, via: 'application/json' });
    const bad = extractEmbeddedCourse('<script>const COURSE = {a: 1};</script>');
    expect(bad.value).toBeNull();
    expect(bad.warnings[0]).toMatch(/not valid JSON/);
  });

  it('@F4 docx goes through mammoth → html path', async () => {
    const bytes = makeDocx(
      ['Concept for a WHMIS course'],
      [
        ['Block ID', 'Title'],
        ['S1-01', 'Welcome'],
      ],
    );
    const doc = await parseDocument(bytes, 'notes.docx');
    expect(doc.format).toBe('docx');
    expect(doc.text).toContain('Concept for a WHMIS course');
    expect(doc.tables[0]).toMatchObject({ header: ['Block ID', 'Title'], rows: [['S1-01', 'Welcome']] });
  });

  it('@F4 pdf goes through unpdf text extraction and is marked lossy', async () => {
    const doc = await parseDocument(makePdf('Hello PDF LO1'), 'brief.pdf');
    expect(doc.format).toBe('pdf');
    expect(doc.text).toContain('Hello PDF LO1');
    expect(doc.lossy).toBe(true);
  });

  it('@F4 unsupported formats fail clearly with exit 2', async () => {
    for (const name of ['deck.pptx', 'photo.png', 'sheet.xlsx']) {
      const err = await parseDocument(Buffer.from('PKxx'), name).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CfError);
      expect((err as CfError).code).toBe('UNSUPPORTED_FORMAT');
      expect((err as CfError).exitCode).toBe(2);
      expect((err as CfError).message).toMatch(/Supported formats/);
    }
    expect(() => detectFormat('fake.pdf', Buffer.from('not a pdf'))).toThrow(/not a PDF/);
    expect(() => detectFormat('noext', Buffer.from([0x50, 0x4b, 3, 4, 0, 0]))).toThrow(/zip-based/);
  });

  it('detectFormat sniffs extension-less files', () => {
    expect(detectFormat('x', Buffer.from('%PDF-1.4'))).toBe('pdf');
    expect(detectFormat('x', Buffer.from('<!doctype html><html></html>'))).toBe('html');
    expect(detectFormat('x', Buffer.from('{"a":1}'))).toBe('json');
    expect(detectFormat('x', Buffer.from('# Title'))).toBe('md');
    expect(detectFormat('x', makeDocx(['a'], [['b']]))).toBe('docx');
  });
});
