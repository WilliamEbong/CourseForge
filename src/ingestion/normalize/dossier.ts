/** Research dossier Markdown (first-pass `S1…` or expanded mnemonic-ID format) → dossier + sources + claims. */
import type { ClaimCategory } from '../../core/enums.js';
import { formatSeq } from '../../core/ids.js';
import type { ClaimRecord, ResearchDossier, SourceRecord } from '../../core/schemas/content.js';
import type { NormalizedDocument } from '../types.js';
import { parseCitationTokens, stripMd } from '../util.js';
import { toSourceRecord } from './common.js';

export interface DossierImport {
  dossier: ResearchDossier;
  sources: SourceRecord[];
  claims: ClaimRecord[];
  warnings: string[];
}

export const sectionIdFor = (n: number): string => `RS-${String(n).padStart(2, '0')}`;

// ponytail: keyword map from the free-text Type/Status column; the claim-category classifier refines it later.
export function claimCategoryFor(type: string): ClaimCategory {
  const t = type.toLowerCase();
  if (/status|current|edition|version/.test(t)) return 'version-currentness';
  if (/\blaw\b|regulation|statut|act\b|code\b/.test(t)) return 'law-regulation';
  if (/statistic|rate|prevalence/.test(t)) return 'statistic';
  if (/peer|study|review|scientific|technical|evidence/.test(t)) return 'scientific-technical';
  if (/defin|terminolog/.test(t)) return 'definition';
  if (/synthesis|scenario|good practice|case/.test(t)) return 'scenario-synthesis';
  return 'guidance-recommendation';
}

/** `S11–S12` → `S11; S12`; commas before an ID start a new token (`S4, S5`), others stay in locators (`ss.398, 400`). */
export function splitSourceCell(cell: string): string[] {
  return stripMd(cell)
    .split(/;|,\s*(?=[A-Z])/)
    .flatMap((tok) => {
      const m = /^\s*([A-Z]+)(\d+)\s*[–-]\s*\1?(\d+)\s*$/.exec(tok);
      if (!m) return [tok];
      const out: string[] = [];
      for (let n = Number(m[2]); n <= Number(m[3]); n++) out.push(`${m[1]}${n}`);
      return out;
    });
}

export function dossierFromMarkdown(doc: NormalizedDocument): DossierImport {
  const warnings: string[] = [];
  const lines = doc.text.split('\n');

  // Top-level numbered sections: the shallowest heading level carrying `N. Title`.
  const numbered = doc.headings.filter((h) => /^\d+\.\s+\S/.test(h.text));
  const level = Math.min(...numbered.map((h) => h.level));
  const tops = numbered.filter((h) => h.level === level);
  const sectionBody = (i: number) => {
    const h = tops[i];
    if (!h) return '';
    const next = doc.headings.find((x) => x.line > h.line && x.level <= level);
    return lines.slice(h.line, next ? next.line - 1 : lines.length).join('\n');
  };

  const sources = parseBibliography(doc, lines, warnings);
  const known = new Set(sources.map((s) => s.id));

  const claims: ClaimRecord[] = [];
  const matrix = doc.tables.find((t) => /^claim/i.test(stripMd(t.header[0] ?? '')) && t.header.some((h) => /source/i.test(h)));
  const matrixLine = matrix?.line ?? -1;
  if (matrix) {
    const typeCol = matrix.header.findIndex((h) => /type|status/i.test(h));
    const srcCol = matrix.header.findIndex((h) => /source/i.test(h));
    for (const r of matrix.rows) {
      const text = stripMd(r[0] ?? '');
      if (!text) continue;
      const cited = parseCitationTokens(splitSourceCell(r[srcCol] ?? ''));
      for (const c of cited.citations)
        if (!known.has(c.sourceId)) warnings.push(`Claim "${text.slice(0, 50)}…" cites unknown source ${c.sourceId}`);
      const type = stripMd(r[typeCol] ?? '');
      claims.push({
        id: formatSeq('CLM', claims.length + 1),
        text,
        category: claimCategoryFor(type),
        citations: cited.citations,
        sectionId: null,
        jurisdiction: cited.citations.some((c) => /^AB-/.test(c.sourceId)) || /alberta/i.test(text) ? 'Alberta, Canada' : null,
        confidence: 'medium',
        qualifications:
          [type ? `Imported evidence type: ${type}` : '', cited.internal.length ? `Internal notes: ${cited.internal.join('; ')}` : '']
            .filter(Boolean)
            .join('. ') || null,
      });
    }
  } else warnings.push('No claim-to-source table found; no claims imported');

  const sections = tops.map((h, i) => {
    const n = Number(/^(\d+)/.exec(h.text)?.[1] ?? i + 1);
    const markdown = sectionBody(i);
    const next = tops[i + 1];
    const holdsMatrix = matrixLine > h.line && (!next || matrixLine < next.line);
    return {
      sectionId: sectionIdFor(n),
      title: stripMd(h.text.replace(/^\d+\.\s+/, '')),
      markdown,
      claimIds: holdsMatrix ? claims.map((c) => c.id) : [],
      sourceIds: [...known].filter((id) => new RegExp(`[\\[;\\s]${id.replace(/[.]/g, '\\.')}(?=[\\]; ,])`).test(markdown)),
    };
  });
  if (!sections.length) warnings.push('No numbered sections found');
  if (!sources.length) warnings.push('No bibliography entries found');

  const title = stripMd(doc.headings[0]?.text ?? doc.title);
  return {
    dossier: {
      schemaVersion: '1',
      title,
      version: Number(
        /version\s+(\d+)/i.exec(
          doc.headings
            .slice(0, 3)
            .map((h) => h.text)
            .join(' '),
        )?.[1] ?? 1,
      ),
      sections,
    },
    sources,
    claims,
    warnings,
  };
}

/** `**S1. Issuer. “Title.”**` (first pass) or `### ID — Title` + issuer/URL/Accessed lines (expanded). */
function parseBibliography(doc: NormalizedDocument, lines: string[], warnings: string[]): SourceRecord[] {
  const bib = doc.headings.find((h) => /bibliography|source register/i.test(h.text));
  if (!bib) return [];
  const end = doc.headings.find((h) => h.line > bib.line && h.level <= bib.level)?.line ?? lines.length + 1;
  const out: SourceRecord[] = [];
  let hint = '';
  for (let i = bib.line; i < end - 1; i++) {
    const line = lines[i] ?? '';
    const group = /^#{1,6}\s+[A-Z]\.\s+(.+)$/.exec(line);
    if (group?.[1]) {
      hint = group[1];
      continue;
    }
    const expanded = /^#{2,6}\s+([A-Z][A-Za-z0-9._-]*[-\d][A-Za-z0-9._-]*|[A-Z][A-Za-z0-9._-]*(?=\s+[—–-]\s))(?:\s+[—–-]\s+(.+))?$/.exec(
      line,
    );
    const first = /^\*\*([A-Z]+\d+)\.\s+(.+?)\*\*\s*$/.exec(line);
    if (!expanded && !first) continue;
    const body: string[] = [];
    for (let j = i + 1; j < end - 1 && (lines[j] ?? '').trim() && !/^#/.test(lines[j] ?? ''); j++) body.push((lines[j] ?? '').trim());
    const url = body.find((b) => /^https?:\/\//.test(b)) ?? null;
    const accessed = body.find((b) => /^accessed/i.test(b)) ?? null;
    const notes = body.filter((b) => b !== url && b !== accessed);
    let id: string;
    let title: string;
    let issuer: string | null;
    if (expanded) {
      id = expanded[1] ?? '';
      // An issuer / citation line, when present, sits before the URL (`Government of Canada, Justice Laws.`,
      // `Kyung M, Lee S-J. “Title.” Journal. 2023.`).
      const lead = url && body.indexOf(url) > 0 && body[0] !== accessed ? (body[0] ?? null) : null;
      if (lead) notes.shift();
      const quoted = lead ? /[“"](.+?)[.,]?[”"]/.exec(lead) : null;
      issuer = lead ? (quoted ? lead.slice(0, quoted.index) : lead).trim().replace(/\.$/, '') || null : null;
      title = expanded[2] ?? quoted?.[1] ?? lead ?? id;
    } else {
      id = first?.[1] ?? '';
      const raw = first?.[2] ?? '';
      const quoted = /[“"](.+?)[.,]?[”"]/.exec(raw)?.[1];
      issuer = raw.split('. ')[0] ?? null;
      title = quoted ?? raw.slice((issuer ?? '').length + 2).replace(/\.$/, '');
    }
    if (out.some((s) => s.id === id)) {
      warnings.push(`Duplicate bibliography id ${id}`);
      continue;
    }
    const rec = toSourceRecord({ id, issuer, title, date: accessed, url, hint });
    out.push({ ...rec, currentnessNotes: notes.join(' ') || rec.currentnessNotes });
  }
  return out;
}
