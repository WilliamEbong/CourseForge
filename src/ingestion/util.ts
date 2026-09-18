/** Small pure text helpers shared by adapters and normalisers. */
import { load } from 'cheerio';
import type { AnyNode, Element, Text } from 'domhandler';
import { splitCitationToken } from '../core/ids.js';
import type { Citation } from '../core/schemas/content.js';
import type { NormalizedDocument } from './types.js';

/** Storyboard/LO/source-like tokens: `S1-01`, `GA-15`, `V-07`, `LO4`, `AB-OHS-4`, `HPR-5.12`, `CLM-0001`. */
const ID_SCAN = /\b(?:LO\d+|[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+(?:\.\d+)?)\b/g;

/** Plus mnemonic source IDs inside bracket citations (`[CCOHS-SDS; AB-OHS-4 s.21]`). */
export function scanIds(text: string): { id: string; line: number }[] {
  const seen = new Map<string, number>();
  const see = (id: string, line: number) => {
    if (!seen.has(id)) seen.set(id, line);
  };
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(ID_SCAN)) see(m[0], i + 1);
    for (const g of line.matchAll(/\[([^\]]+)\]/g))
      for (const c of parseCitationTokens((g[1] ?? '').split(';')).citations) if (/[-\d]/.test(c.sourceId)) see(c.sourceId, i + 1);
  });
  return [...seen].map(([id, line]) => ({ id, line }));
}

export function scanLinks(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`)\]|]+/g)) out.add(m[0].replace(/[.,;:]+$/, ''));
  return [...out];
}

export const brToNewline = (s: string): string => s.replace(/<br\s*\/?>/gi, '\n').trim();

export const stripMd = (s: string): string =>
  s
    .replace(/\*\*|__/g, '')
    .replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2')
    .replace(/`/g, '')
    .trim();

/** `LO1, LO3` / `LO1–LO6` / `Enrichment / LO4` → `['LO1','LO3']`, `['LO1',…,'LO6']`, `['LO4']`. */
export function expandLoRefs(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/LO\s?(\d+)(?:\s*[–—-]\s*(?:LO\s?)?(\d+))?/g)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = a; n <= Math.max(a, b); n++) if (!out.includes(`LO${n}`)) out.push(`LO${n}`);
  }
  return out;
}

const ID_TOKEN = /^[A-Z][A-Z0-9]*(?:[-_.][A-Z0-9]+)*$/;

/**
 * Splits citation tokens into external citations (`AB-OHS-4 s.21` → sourceId + locator) and internal notes
 * (`source dossier §8`, `Sources named in block`) that must never become dangling external references.
 */
export function parseCitationTokens(tokens: string[]): { citations: Citation[]; internal: string[] } {
  const citations: Citation[] = [];
  const internal: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim().replace(/\.$/, '');
    if (!t || /^(none|n\/a|—|-)$/i.test(t)) continue;
    let c = splitCitationToken(t);
    const paren = /^([A-Z][A-Z0-9_.-]*?)(\([^)]+\))$/.exec(c.sourceId); // `AB-OHS-ACT-33(5)` → id + `(5)`
    if (paren?.[1] && paren[2]) c = { sourceId: paren[1], locator: [paren[2], c.locator].filter(Boolean).join(' ') };
    if (ID_TOKEN.test(c.sourceId)) {
      if (!citations.some((x) => x.sourceId === c.sourceId && x.locator === c.locator)) citations.push(c);
    } else if (!internal.includes(t)) internal.push(t);
  }
  return { citations, internal };
}

/** `[AB-OHS-2; CCOHS-SDS; source dossier §8]` (one or more bracket groups, or bare text). */
export function parseCitationCell(cell: string): { citations: Citation[]; internal: string[] } {
  const groups = [...cell.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1] ?? '');
  return parseCitationTokens((groups.length ? groups : [cell]).flatMap((g) => g.split(/;|<br\s*\/?>/i)));
}

export const uniq = <T>(xs: Iterable<T>): T[] => [...new Set(xs)];

/* ------------------------------------------------------------------ HTML → Markdown-lite */

/** Converts a fragment of trusted-or-not HTML to Markdown-lite text; scripts/styles dropped, entities decoded. */
export function htmlToMarkdownLite(html: string): string {
  if (!/[<&]/.test(html)) return html.trim();
  const $ = load(html, null, false);
  return render($.root().contents().toArray())
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function render(nodes: AnyNode[]): string {
  let out = '';
  for (const node of nodes) {
    const type = String(node.type);
    if (type === 'text') out += (node as Text).data.replace(/\s+/g, ' ');
    else if (type === 'tag') out += renderEl(node as Element);
  }
  return out;
}

function renderEl(el: Element): string {
  const inner = () => render(el.children);
  switch (el.name) {
    case 'script':
    case 'style':
    case 'noscript':
    case 'template':
      return '';
    case 'br':
      return '\n';
    case 'strong':
    case 'b':
      return `**${inner().trim()}**`;
    case 'em':
    case 'i':
      return `*${inner().trim()}*`;
    case 'ul':
    case 'ol': {
      const items = el.children.filter((c): c is Element => String(c.type) === 'tag' && (c as Element).name === 'li');
      return `\n\n${items.map((li, i) => `${el.name === 'ol' ? `${i + 1}.` : '-'} ${render(li.children).trim()}`).join('\n')}\n\n`;
    }
    case 'a': {
      const href = el.attribs.href ?? '';
      return /^https?:/i.test(href) ? `[${inner().trim()}](${href})` : inner();
    }
    case 'p':
    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'blockquote':
    case 'table':
    case 'tr':
      return `\n\n${inner().trim()}\n\n`;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `\n\n**${inner().trim()}**\n\n`;
    case 'td':
    case 'th':
      return ` ${inner().trim()} |`;
    default:
      return inner();
  }
}

/* ------------------------------------------------------------------ Markdown section access */

/** Body lines under the first heading matching `re`, up to the next heading of the same or higher level. */
export function sectionText(doc: NormalizedDocument, re: RegExp): string | null {
  const hs = doc.headings;
  const i = hs.findIndex((h) => re.test(h.text));
  if (i === -1) return null;
  const h = hs[i];
  if (!h) return null;
  const end = hs.slice(i + 1).find((x) => x.level <= h.level);
  const lines = doc.text.split('\n');
  return lines.slice(h.line, end ? end.line - 1 : lines.length).join('\n');
}

export function listItems(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (m?.[1]) out.push(stripMd(m[1]));
  }
  return out;
}

/** Plain paragraphs (no headings, tables, lists, rules, fences). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(#|\||[-*+] |\d+[.)] |---|```|>)/.test(p))
    .map((p) => stripMd(p.replace(/\s*\n\s*/g, ' ')));
}
