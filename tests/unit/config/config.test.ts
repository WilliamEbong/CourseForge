import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGES, VISUAL_ARCHETYPES } from '../../../src/core/enums.js';
import { CfError } from '../../../src/core/errors.js';
import { configDir } from '../../../src/core/paths.js';
import type { RoutingConfig, StagesConfig } from '../../../src/core/schemas/index.js';
import { loadRegistries, lucideIconsDir, validateConfig } from '../../../src/routing/registries.js';

function tempConfig(mutate: (dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'cf-config-'));
  cpSync(configDir(), dir, { recursive: true });
  mutate(dir);
  return dir;
}
function editJson<T>(dir: string, file: string, fn: (j: T) => void) {
  const p = join(dir, file);
  const j = JSON.parse(readFileSync(p, 'utf8')) as T;
  fn(j);
  writeFileSync(p, JSON.stringify(j));
}
function errorOf(dir: string): string {
  try {
    loadRegistries(dir);
  } catch (err) {
    expect(err).toBeInstanceOf(CfError);
    return (err as Error).message;
  }
  throw new Error('expected loadRegistries to throw');
}

describe('config registries @A4', () => {
  it('all shipped config files validate and cross-reference', () => {
    const r = loadRegistries();
    expect(Object.keys(r.stages.stages).sort()).toEqual([...STAGES].sort());
    expect(Object.keys(r.hashes).sort()).toEqual(
      [
        'fallbacks.json',
        'guidance.json',
        'review-policy.json',
        'reviewers.json',
        'routing.json',
        'skills.json',
        'stages.json',
        'tools.json',
      ].sort(),
    );
    expect(validateConfig()).toEqual({ ok: true, errors: [] });
  });

  it('every archetype has a visual route and every stage a stage route', () => {
    const r = loadRegistries();
    for (const a of VISUAL_ARCHETYPES) expect(r.routing.visualRoutes.some((v) => v.when.archetype === a)).toBe(true);
    for (const s of STAGES) expect(r.routing.stageRoutes[s].rule).toBe(`STG-${s}-001`);
  });

  it('every icon maps to an existing lucide-static file', () => {
    const r = loadRegistries();
    expect(Object.keys(r.routing.icons).length).toBeGreaterThanOrEqual(40);
    for (const file of Object.values(r.routing.icons)) expect(existsSync(join(lucideIconsDir(), `${file}.svg`)), file).toBe(true);
  });

  it('learner-perspective reviewers are registered but disabled', () => {
    const r = loadRegistries();
    for (const id of ['learner-novice', 'learner-practitioner', 'learner-keyboard', 'learner-mobile', 'learner-returning']) {
      expect(r.reviewers.reviewers[id]?.enabled).toBe(false);
    }
  });

  it('rejects a corrupted file, naming the file and the failing path', () => {
    const dir = tempConfig((d) =>
      editJson<{ schemaRetries: unknown }>(d, 'fallbacks.json', (j) => {
        j.schemaRetries = 'many';
      }),
    );
    const msg = errorOf(dir);
    expect(msg).toContain('fallbacks.json');
    expect(msg).toContain('schemaRetries');
  });

  it('rejects unparseable JSON', () => {
    const dir = tempConfig((d) => writeFileSync(join(d, 'tools.json'), '{ nope'));
    expect(errorOf(dir)).toContain('tools.json');
  });

  it('rejects an unknown archetype in a visual route', () => {
    const dir = tempConfig((d) =>
      editJson<{ visualRoutes: { when: { archetype: string } }[] }>(d, 'routing.json', (j) => {
        (j.visualRoutes[0] as { when: { archetype: string } }).when.archetype = 'SPIRAL';
      }),
    );
    expect(errorOf(dir)).toMatch(/routing\.json[\s\S]*visualRoutes\.0\.when\.archetype/);
  });

  it('rejects an unknown reviewer, skill, tool and output schema reference', () => {
    const dir = tempConfig((d) =>
      editJson<StagesConfig>(d, 'stages.json', (j) => {
        j.stages.STORYBOARD.reviewers.push('ghost-reviewer');
        j.stages.STORYBOARD.generator?.skills.push('ghost-skill');
        j.stages.STORYBOARD.generator?.tools.push('ghost-tool');
        if (j.stages.CONCEPT.generator) j.stages.CONCEPT.generator.outputSchema = 'ghost-schema';
      }),
    );
    const { ok, errors } = validateConfig(dir);
    expect(ok).toBe(false);
    const all = errors.join('\n');
    expect(all).toContain('unknown reviewer "ghost-reviewer"');
    expect(all).toContain('unknown skill "ghost-skill"');
    expect(all).toContain('unknown tool "ghost-tool"');
    expect(all).toContain('unknown output schema "ghost-schema"');
  });

  it('rejects a missing archetype route and a missing icon file', () => {
    const dir = tempConfig((d) =>
      editJson<RoutingConfig>(d, 'routing.json', (j) => {
        j.visualRoutes = j.visualRoutes.filter((v) => v.when.archetype !== 'FUNNEL');
        j.icons.warning = 'no-such-icon-xyz';
      }),
    );
    const all = validateConfig(dir).errors.join('\n');
    expect(all).toContain('no route for archetype FUNNEL');
    expect(all).toContain('lucide icon "no-such-icon-xyz" does not exist');
  });
});
