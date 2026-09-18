/** Documentation coherence: every relative Markdown link in the public docs resolves to an existing file. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkFiles } from '../../../src/core/fsx.js';
import { repoRoot } from '../../../src/core/paths.js';

const root = repoRoot();

function docFiles(): string[] {
  const docs = walkFiles(join(root, 'docs'), ['bootstrap/'])
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`);
  return ['README.md', 'CLAUDE.md', 'AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD-PARTY.md', ...docs].filter((f) =>
    existsSync(join(root, f)),
  );
}

/** Relative link targets outside code blocks/spans: inline `[x](target)` and reference `[x]: target`. */
function relativeLinks(md: string): string[] {
  const text = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const targets: string[] = [];
  for (const m of text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) targets.push(m[1] as string);
  for (const m of text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)) targets.push(m[1] as string);
  return targets.filter((t) => !/^[a-z][a-z0-9+.-]*:/i.test(t) && !t.startsWith('#') && !t.startsWith('//'));
}

describe('documentation links', () => {
  it('extracts only relative links outside code', () => {
    const md = '[a](docs/x.md) [b](https://e.com) [c](#top) `[d](no.md)`\n```\n[e](no2.md)\n```\n[f]: ./y.md#s\n';
    expect(relativeLinks(md)).toEqual(['docs/x.md', './y.md#s']);
  });

  const files = docFiles();
  it('found the public documentation', () => {
    expect(files).toContain('README.md');
    expect(files.some((f) => f.startsWith('docs/architecture/'))).toBe(true);
  });

  for (const file of files) {
    it(`@L6 relative links in ${file} resolve to existing files`, () => {
      const md = readFileSync(join(root, file), 'utf8');
      const broken: string[] = [];
      for (const link of relativeLinks(md)) {
        const path = decodeURIComponent(link.replace(/[#?].*$/, ''));
        if (!path) continue;
        const abs = resolve(dirname(join(root, file)), path);
        if (!existsSync(abs) || !statSync(abs).isFile()) broken.push(link);
      }
      expect(broken, `${file} has broken links`).toEqual([]);
    });
  }
});
