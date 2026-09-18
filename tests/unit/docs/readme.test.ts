/** Public repository quality: README structure, setup documentation, and the offline demo fixture set. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../src/core/paths.js';

const root = repoRoot();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const headings = (md: string) => md.split('\n').filter((l) => /^#{2,3} /.test(l));

describe('README', () => {
  const readme = read('README.md');

  it('@L1 has install, quick start, architecture, example, troubleshooting and limitations sections', () => {
    const hs = headings(readme).join('\n');
    for (const section of ['Install', 'Quick start', 'Architecture', 'Example', 'Troubleshooting', 'Limitations']) {
      expect(hs, `missing "## ${section}" section`).toMatch(new RegExp(`^#{2,3} .*${section}`, 'mi'));
    }
  });

  it('@L2 documents both setup scripts, and the setup scripts exist', () => {
    expect(readme).toContain('setup.ps1');
    expect(readme).toContain('setup.sh');
    for (const f of ['setup.ps1', 'setup.sh']) expect(existsSync(join(root, f)), f).toBe(true);
    const install = read('docs/user-guide/installation.md');
    expect(install).toContain('setup.ps1');
    expect(install).toContain('setup.sh');
  });

  it('@L2 documents every CLI command from src/cli/help.ts', async () => {
    const { COMMAND_HELP } = await import('../../../src/cli/help.js');
    const cli = read('docs/user-guide/cli.md');
    for (const cmd of Object.keys(COMMAND_HELP)) expect(cli, `docs/user-guide/cli.md lacks "${cmd}"`).toContain(`\`${cmd}\``);
  });
});

describe('sample fixture', () => {
  it('@L7 the offline demo in the README has fixtures for every agent task the pipeline routes', () => {
    const readme = read('README.md');
    expect(readme).toContain('tests/fixtures/harness/demo');
    const demo = join(root, 'tests', 'fixtures', 'harness', 'demo');
    const stages = JSON.parse(read('config/stages.json')) as {
      stages: Record<
        string,
        { generator: { promptTemplate: string } | null; reviewers: string[]; repairer?: { promptTemplate: string } | null }
      >;
    };
    const templates = new Set<string>(['adjudicate']);
    for (const def of Object.values(stages.stages)) {
      if (def.generator) templates.add(def.generator.promptTemplate);
      if (def.reviewers.length) templates.add('review');
      if (def.repairer && def.reviewers.length) templates.add(def.repairer.promptTemplate);
    }
    for (const t of templates) expect(existsSync(join(demo, t)), `no demo fixtures for prompt template "${t}"`).toBe(true);
  });
});
