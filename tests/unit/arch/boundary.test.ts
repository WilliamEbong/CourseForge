/**
 * @B6 Architecture boundaries: provider-specific invocation stays inside src/harness/, and only
 * src/core/proc.ts may spawn processes. Also guards against global-config writes (@A5).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkFiles } from '../../../src/core/fsx.js';
import { repoRoot } from '../../../src/core/paths.js';

const root = repoRoot();
const sourceFiles = [
  ...walkFiles(join(root, 'src')).map((f) => `src/${f}`),
  ...walkFiles(join(root, 'components')).map((f) => `components/${f}`),
].filter((f) => f.endsWith('.ts'));

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('architecture boundaries @B6 @A5', () => {
  it('has source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(5);
  });

  it('only src/core/proc.ts imports child_process or cross-spawn', () => {
    const offenders = sourceFiles.filter(
      (f) =>
        f !== 'src/core/proc.ts' &&
        /from\s+['"](node:)?child_process['"]|from\s+['"]cross-spawn['"]|require\(['"](node:)?child_process/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('no module outside src/harness names the claude/codex executables', () => {
    const pattern = /['"`](claude|codex)(\.exe|\.cmd|\.js)?['"`]\s*[,\]]/;
    const offenders = sourceFiles.filter((f) => {
      if (f.startsWith('src/harness/') || f.startsWith('src/environment/')) return false;
      return pattern.test(read(f)) && /runProcess|probeVersion|spawn/.test(read(f));
    });
    expect(offenders).toEqual([]);
  });

  it('pipeline, review, routing and renderer never import a concrete adapter', () => {
    const shared = sourceFiles.filter((f) => /^src\/(pipeline|review|routing|renderer|graphics|artifacts|ingestion|release|qa)\//.test(f));
    const offenders = shared.filter((f) => /from\s+['"][./]*\/?harness\/(claude|codex)(\.js)?['"]/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('never writes to user-global agent or npm configuration', () => {
    const offenders = sourceFiles.filter(
      (f) =>
        /(\.claude[\\/]settings|\.codex[\\/]config|npm\s+(i|install)\s+-g|npm config set)/.test(read(f)) &&
        /write|append|mkdir|install|config set/.test(read(f)),
    );
    // environment/doctor may *read* global paths for conflict warnings; writes are forbidden everywhere
    const writers = offenders.filter((f) => /writeFile|writeAtomic|appendFile|config set|install -g/.test(read(f)));
    expect(writers).toEqual([]);
  });
});
