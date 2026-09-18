import { extname } from 'node:path';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { EXIT, type SourceFormat } from '../../core/enums.js';
import { CfError } from '../../core/errors.js';
import { normalizeNewlines } from '../../core/hash.js';
import type { IngestAdapter, NormalizedDocument } from '../types.js';
import { scanIds, scanLinks } from '../util.js';
import { htmlAdapter, parseHtmlText } from './html.js';
import { markdownAdapter, parseMarkdownText } from './markdown.js';

export { extractEmbeddedCourse, parseHtmlText, scanBalanced } from './html.js';
export { parseMarkdownText } from './markdown.js';

const EXT: Record<string, SourceFormat> = {
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
  '.html': 'html',
  '.htm': 'html',
  '.json': 'json',
  '.docx': 'docx',
  '.pdf': 'pdf',
};

const unsupported = (name: string, why: string) =>
  new CfError(
    'UNSUPPORTED_FORMAT',
    `Cannot ingest "${name}": ${why}. Supported formats: .md, .markdown, .txt, .html, .htm, .json, .docx, .pdf. ` +
      'Convert the file to one of these (PPTX, images and other binaries are not converted automatically).',
    { exitCode: EXIT.USAGE, kind: 'input_invalid', detail: { name } },
  );

const isZip = (b: Buffer) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;
const isPdf = (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-';

/** Extension first; content sniffing only when there is no extension. Magic bytes must agree for binaries. */
export function detectFormat(name: string, bytes: Buffer): SourceFormat {
  const ext = extname(name).toLowerCase();
  if (ext) {
    const f = EXT[ext];
    if (!f) throw unsupported(name, `extension "${ext}" is not supported`);
    if (f === 'pdf' && !isPdf(bytes)) throw unsupported(name, 'file has a .pdf extension but is not a PDF');
    if (f === 'docx' && !isZip(bytes)) throw unsupported(name, 'file has a .docx extension but is not a DOCX (zip) package');
    return f;
  }
  if (isPdf(bytes)) return 'pdf';
  if (isZip(bytes)) {
    if (bytes.includes('word/document.xml')) return 'docx';
    throw unsupported(name, 'zip-based file that is not a Word document (PPTX/XLSX/zip are not supported)');
  }
  if (bytes.subarray(0, 8000).includes(0)) throw unsupported(name, 'binary content with no recognised format');
  const head = bytes.subarray(0, 2000).toString('utf8').replace(/^﻿/, '').trimStart();
  if (/^(<!doctype html|<html|<head|<body)/i.test(head)) return 'html';
  if (/^[{[]/.test(head)) {
    try {
      JSON.parse(bytes.toString('utf8'));
      return 'json';
    } catch {
      /* fall through to text */
    }
  }
  return 'md';
}

export const jsonAdapter: IngestAdapter = {
  formats: ['json'],
  parse: async (bytes, name) => {
    const text = normalizeNewlines(bytes.toString('utf8')).replace(/^﻿/, '');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new CfError('JSON_INVALID', `Cannot parse JSON file ${name}: ${(err as Error).message}`, {
        exitCode: EXIT.USAGE,
        kind: 'input_invalid',
      });
    }
    const t = json && typeof json === 'object' && 'title' in json ? (json as { title: unknown }).title : null;
    return {
      format: 'json',
      name,
      title: typeof t === 'string' ? t : name,
      text,
      headings: [],
      tables: [],
      ids: scanIds(text),
      links: scanLinks(text),
      json,
      html: null,
      rawHtml: null,
      warnings: [],
      lossy: false,
    } satisfies NormalizedDocument;
  },
};

/** DOCX → HTML (mammoth) → the HTML path, so headings and tables survive. */
export const docxAdapter: IngestAdapter = {
  formats: ['docx'],
  parse: async (bytes, name) => {
    const res = await mammoth.convertToHtml({ buffer: bytes });
    const doc = parseHtmlText(`<html><body>${res.value}</body></html>`, name, 'docx');
    const msgs = res.messages.map((m) => `docx ${m.type}: ${m.message}`);
    return { ...doc, warnings: [...doc.warnings, ...msgs], lossy: msgs.length > 0 };
  },
};

/** PDF → plain text (unpdf). Layout, tables and headings are lost, so the document is marked lossy. */
export const pdfAdapter: IngestAdapter = {
  formats: ['pdf'],
  parse: async (bytes, name) => {
    const { text, totalPages } = await extractText(new Uint8Array(bytes), { mergePages: true });
    const doc = parseMarkdownText(text, name, 'pdf');
    return {
      ...doc,
      warnings: [...doc.warnings, `PDF text extracted from ${totalPages} page(s); layout, tables and headings are not preserved`],
      lossy: true,
    };
  },
};

export const ADAPTERS: IngestAdapter[] = [markdownAdapter, htmlAdapter, jsonAdapter, docxAdapter, pdfAdapter];

export async function parseDocument(bytes: Buffer, name: string): Promise<NormalizedDocument> {
  const format = detectFormat(name, bytes);
  const adapter = ADAPTERS.find((a) => a.formats.includes(format));
  if (!adapter) throw unsupported(name, `no adapter for ${format}`);
  const doc = await adapter.parse(bytes, name);
  return doc.format === format ? doc : { ...doc, format };
}
