import { marked, type Token, type Tokens } from 'marked';
import type { SourceFormat } from '../../core/enums.js';
import { normalizeNewlines } from '../../core/hash.js';
import type { DocHeading, DocTable, IngestAdapter, NormalizedDocument } from '../types.js';
import { scanIds, scanLinks } from '../util.js';

const countNl = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
};

/** Markdown (also used for txt and extracted PDF text): headings + GFM tables via the marked lexer. */
export function parseMarkdownText(source: string, name: string, format: SourceFormat): NormalizedDocument {
  const text = normalizeNewlines(source).replace(/^﻿/, '');
  const headings: DocHeading[] = [];
  const tables: DocTable[] = [];
  let line = 1;
  for (const tok of marked.lexer(text) as Token[]) {
    if (tok.type === 'heading') {
      const h = tok as Tokens.Heading;
      headings.push({ level: h.depth, text: h.text.replace(/\*\*/g, '').trim(), line });
    } else if (tok.type === 'table') {
      const t = tok as Tokens.Table;
      tables.push({ header: t.header.map((c) => c.text.trim()), rows: t.rows.map((r) => r.map((c) => c.text.trim())), line });
    }
    line += countNl(tok.raw);
  }
  const title =
    headings.find((h) => h.level === 1)?.text ??
    text
      .split('\n')
      .find((l) => l.trim())
      ?.trim() ??
    name;
  return {
    format,
    name,
    title,
    text,
    headings,
    tables,
    ids: scanIds(text),
    links: scanLinks(text),
    json: null,
    html: null,
    rawHtml: null,
    warnings: [],
    lossy: false,
  };
}

export const markdownAdapter: IngestAdapter = {
  formats: ['md', 'txt'],
  parse: async (bytes, name) => parseMarkdownText(bytes.toString('utf8'), name, /\.txt$/i.test(name) ? 'txt' : 'md'),
};
