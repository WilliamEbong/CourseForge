/**
 * Existing-HTML improvement on the reference example (spec 09 / acceptance group K), fully offline:
 * ingest without touching the original → browser-run (crawl) → review findings + repair plan →
 * rebuild through CourseForge components → contract QA → regression report → release.
 */
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { listArtifacts, loadRegistry } from '../../../src/artifacts/index.js';
import { hashFile } from '../../../src/core/hash.js';
import { courseDir, repoRoot } from '../../../src/core/paths.js';
import { FunctionalReportSchema, IntakeReportSchema, ReleaseManifestSchema, RepairPlanSchema } from '../../../src/core/schemas/index.js';
import { pipelineApi as api } from '../../../src/pipeline/impl.js';
import { loadState } from '../../../src/pipeline/store.js';
import { useFakeEnv } from '../pipeline/helpers.js';

const EXAMPLE = join(repoRoot(), 'examples/chemical-risk/06_interactive_course.html');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('existing HTML improvement (reference example)', () => {
  let dir = '';
  let exampleHash = '';
  let copyPath = '';

  beforeAll(async () => {
    useFakeEnv();
    exampleHash = hashFile(EXAMPLE);
    copyPath = join(mkdtempSync(join(tmpdir(), 'cf-src-')), '06_interactive_course.html');
    copyFileSync(EXAMPLE, copyPath);
    await api.ingest({ file: copyPath, courseId: 'chem-improve', stage: 'COURSE_BUILD', mode: 'improve' });
    dir = courseDir('chem-improve');
    await api.run({ courseId: 'chem-improve', to: 'RELEASE', gate: 'auto' });
  }, 1_200_000);

  it('@K1 @F2 ingests without overwriting the original and preserves its bytes', () => {
    expect(hashFile(EXAMPLE)).toBe(exampleHash);
    expect(hashFile(copyPath)).toBe(exampleHash);
    const intake = IntakeReportSchema.parse(read(join(dir, 'input/intake-report.json')));
    expect(intake.originals).toHaveLength(1);
    expect(hashFile(join(dir, intake.originals[0]?.path ?? ''))).toBe(exampleHash);
  });

  it('@K3 @F4 reconstructs the course structure into an intake report', () => {
    const intake = IntakeReportSchema.parse(read(join(dir, 'input/intake-report.json')));
    expect(intake.acceptedStage).toBe('COURSE_BUILD');
    expect(intake.counts).toMatchObject({
      screens: 133,
      interactions: 39,
      references: 38,
      glossary: 29,
      acronyms: 9,
      visuals: 20,
      modules: 11,
    });
  });

  it('@K2 @K4 @K5 browser-runs the original and produces review findings and a repair plan', () => {
    const baseline = read(join(dir, 'review/qa-baseline.json'));
    const before = FunctionalReportSchema.parse(baseline.functional);
    expect(before.mode).toBe('crawl');
    expect(before.crawl?.states ?? 0).toBeGreaterThan(10);
    expect(existsSync(join(dir, 'review/findings/c0/findings.json'))).toBe(true);
    const plan = RepairPlanSchema.parse(read(join(dir, 'review/findings/c0/repair-plan.json')));
    expect(plan.stage).toBe('COURSE_QA');
    expect(existsSync(join(dir, 'review/findings/c0/consolidated-review.md'))).toBe(true);
  });

  it('@K6 generates an improved copy through CourseForge components and keeps the imported version', () => {
    const html = readFileSync(join(dir, 'build/index.html'), 'utf8');
    expect(html).toContain('id="cf-data"');
    expect((html.match(/<svg[\s>]/g) ?? []).length).toBeGreaterThan(20); // real inline SVG diagrams (the original had none)
    const versions = listArtifacts(loadRegistry(dir), 'build');
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(versions.some((v) => v.label.includes('imported'))).toBe(true);
    expect(versions.some((v) => v.label.includes('qa-repaired'))).toBe(true);
  });

  it('@K7 reruns regression tests after the improvement and releases', () => {
    const regression = read(join(dir, 'review/regression-report.json'));
    expect(['improved', 'unchanged']).toContain(regression.verdict);
    const after = FunctionalReportSchema.parse(read(join(dir, 'review/functional-tests.json')));
    expect(after.mode).toBe('contract');
    expect(after.summary.pass).toBe(true);
    const state = loadState(dir);
    expect(state.stages.RELEASE.status).toBe('LOCKED');
    const manifest = ReleaseManifestSchema.parse(read(join(dir, 'release/release-manifest.json')));
    expect(manifest.decision.decision).toBe('pass');
    expect(existsSync(join(dir, 'release/course.html'))).toBe(true);
  });
});
