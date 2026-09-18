/**
 * Deterministic text metrics for native builders. Widths are em fractions per character class for a
 * generic sans-serif, deliberately slightly generous so wrapped labels do not clip in wider fonts.
 */

const NARROW = new Set([...'iljtfrI!|.,:;\'"`()[]{} ']);
const WIDE = new Set([...'mwMW@%']);

function charEm(ch: string, bold: boolean): number {
  let em: number;
  if (NARROW.has(ch)) em = ch === ' ' ? 0.28 : 0.3;
  else if (WIDE.has(ch)) em = 0.9;
  else if (/[0-9]/.test(ch)) em = 0.58;
  else if (/[A-Z]/.test(ch)) em = 0.68;
  else if (/[a-z]/.test(ch)) em = 0.54;
  else if (ch.charCodeAt(0) > 0x2e80)
    em = 1; // CJK and other full-width scripts
  else em = 0.6;
  return bold ? em * 1.06 : em;
}

export function textWidth(text: string, fontSize: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += charEm(ch, bold);
  return w * fontSize;
}

/** Greedy word wrap; words longer than the line are hard-broken with a hyphen. */
export function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const fits = (s: string) => textWidth(s, fontSize, bold) <= maxWidth;
  for (let word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    while (!fits(word)) {
      let cut = word.length - 1;
      while (cut > 1 && !fits(`${word.slice(0, cut)}-`)) cut--;
      lines.push(`${word.slice(0, cut)}-`);
      word = word.slice(cut);
    }
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function maxLineWidth(lines: string[], fontSize: number, bold = false): number {
  return Math.max(0, ...lines.map((l) => textWidth(l, fontSize, bold)));
}
