/**
 * Component contract and the three string helpers every component uses: `esc` (HTML escaping),
 * `md` (safe Markdown-lite → HTML; raw HTML is always escaped) and `blockAttrs` (the data-cf-* DOM contract).
 */
import { Marked, type Tokens } from 'marked';
import type { GlossaryEntry } from '../../../src/core/schemas/content.js';
import type { Screen } from '../../../src/core/schemas/model.js';

export interface CfComponent<P> {
  name: string;
  render(props: P): string;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]!);
}

/** Attribute string from a record; `false`/`null`/`undefined` omit, `true` renders a bare attribute. */
export function attrs(record: Record<string, string | number | boolean | null | undefined>): string {
  return Object.entries(record)
    .filter(([, v]) => v !== false && v !== null && v !== undefined)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v as string | number)}"`))
    .join('');
}

/** Closed icon vocabulary (Lucide names). The renderer inlines only the icons actually referenced. */
export const ICONS = [
  'menu',
  'x',
  'book-open',
  'library',
  'chevron-left',
  'chevron-right',
  'check',
  'circle-check',
  'circle-x',
  'circle-alert',
  'triangle-alert',
  'info',
  'rotate-ccw',
  'scale',
  'file-text',
  'clipboard-check',
  'lightbulb',
  'flask-conical',
  'list-ordered',
  'git-compare',
  'award',
  'search',
  'external-link',
  'arrow-up',
  'arrow-down',
  'layers',
  'sun-moon',
  'graduation-cap',
  'target',
  'bookmark',
  'quote',
] as const;
export type IconName = (typeof ICONS)[number];

/** Reference to a sprite symbol; the renderer (or Storybook) provides `#cf-i-<name>`. */
export function icon(name: IconName, cls = ''): string {
  return `<svg class="cf-icon${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="#cf-i-${name}"></use></svg>`;
}

/** Builds the hidden sprite from full Lucide SVG strings. */
export function iconSprite(names: readonly string[], svgFor: (name: string) => string): string {
  if (names.length === 0) return '';
  const symbols = [...names]
    .sort()
    .map((n) => {
      const inner = svgFor(n)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^[\s\S]*?<svg[^>]*>/, '')
        .replace(/<\/svg>\s*$/, '')
        .replace(/\s*\n\s*/g, '');
      return `<symbol id="cf-i-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`;
    })
    .join('');
  return `<svg class="cf-sprite" aria-hidden="true" focusable="false" hidden><defs>${symbols}</defs></svg>`;
}

/** data-cf-* attributes shared by every screen-level block. */
export function blockAttrs(screen: Pick<Screen, 'id' | 'moduleId' | 'kind' | 'loIds' | 'claimIds' | 'citations' | 'visualId'>): string {
  const sources = [...new Set(screen.citations.map((c) => c.sourceId))];
  return attrs({
    'data-cf-block': screen.id,
    'data-cf-module': screen.moduleId,
    'data-cf-kind': screen.kind,
    'data-cf-lo': screen.loIds.join(' '),
    'data-cf-claim': screen.claimIds.join(' '),
    'data-cf-source': sources.join(' '),
    'data-cf-visual': screen.visualId ?? '',
  });
}

export interface MdOptions {
  /** Glossary entries to auto-link (first occurrence per `linked` set). */
  glossary?: readonly GlossaryEntry[];
  /** Term ids already linked in this scope; mutated. */
  linked?: Set<string>;
  /** Render inline (no wrapping <p>). */
  inline?: boolean;
}

const SAFE_URL = /^(https?:|mailto:|#)/i;

function linkTerms(escaped: string, opts: MdOptions): string {
  if (!opts.glossary?.length || !opts.linked) return escaped;
  let out = escaped;
  for (const g of opts.glossary) {
    if (opts.linked.has(g.id)) continue;
    const term = esc(g.term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\w&;])(${term})(?![\\w])`, 'i');
    if (re.test(out)) {
      opts.linked.add(g.id);
      out = out.replace(
        re,
        (_m, pre: string, word: string) =>
          `${pre}<button type="button" class="cf-term" data-cf-term-link="${esc(g.id)}" aria-haspopup="dialog">${word}<span class="cf-sr-only"> (glossary)</span></button>`,
      );
    }
  }
  return out;
}

function makeMarked(opts: MdOptions): Marked {
  let inLink = 0; // >0 while rendering link text or tables (no glossary buttons there)
  return new Marked({
    gfm: true,
    breaks: true,
    async: false,
    renderer: {
      html(token: Tokens.HTML | Tokens.Tag) {
        return esc(token.text);
      },
      text(token: Tokens.Text | Tokens.Escape) {
        if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
        const escaped = esc(token.text);
        return inLink ? escaped : linkTerms(escaped, opts);
      },
      link({ href, title, tokens }: Tokens.Link) {
        inLink++;
        const text = this.parser.parseInline(tokens);
        inLink--;
        if (!SAFE_URL.test(href)) return text;
        const external = /^https?:/i.test(href);
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}${
          external ? '<span class="cf-sr-only"> (opens in new tab)</span>' : ''
        }</a>`;
      },
      image({ text }: Tokens.Image) {
        return esc(text);
      },
      table(token: Tokens.Table) {
        inLink++;
        const cell = (c: Tokens.TableCell, tag: 'th' | 'td') =>
          `<${tag}${tag === 'th' ? ' scope="col"' : ''}${c.align ? ` class="cf-align-${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        const head = `<tr>${token.header.map((c) => cell(c, 'th')).join('')}</tr>`;
        const body = token.rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('');
        inLink--;
        const label = token.header
          .map((c) => c.text.trim())
          .filter(Boolean)
          .join(', ');
        return `<div class="cf-table-wrap" tabindex="0" role="region" aria-label="${esc(label ? `Table: ${label}` : 'Table')}"><table class="cf-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
      },
      heading({ tokens, depth }: Tokens.Heading) {
        // Authored headings sit below the screen <h1>.
        const level = Math.min(6, Math.max(2, depth + 1));
        return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>`;
      },
    },
  });
}

/** Safe Markdown-lite → HTML. Raw HTML in the source is escaped, links are limited to http(s)/mailto/#. */
export function md(text: string, opts: MdOptions = {}): string {
  const marked = makeMarked(opts);
  const html = opts.inline ? marked.parseInline(text ?? '') : marked.parse(text ?? '');
  return (html as string).trim();
}
