import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CfError } from '../../../src/core/errors.js';
import { walkFiles } from '../../../src/core/fsx.js';
import { sha256 } from '../../../src/core/hash.js';
import { StoryboardSchema } from '../../../src/core/schemas/content.js';
import { CourseModelSchema } from '../../../src/core/schemas/model.js';
import { IntakeReportSchema } from '../../../src/core/schemas/reports.js';
import { CONCEPT_REQUEST, ingestFile } from '../../../src/ingestion/index.js';

const FIX = join(import.meta.dirname, '../../fixtures/ingest');
const EXAMPLES = join(import.meta.dirname, '../../../examples/chemical-risk');
const NOW = new Date('2026-09-18T12:00:00Z');
const temps: string[] = [];

function tempCourse(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cf-ingest-'));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    // originals are read-only; Windows refuses to delete them until the flag is cleared
    for (const rel of walkFiles(dir)) chmodSync(join(dir, rel), 0o644);
    rmSync(dir, { recursive: true, force: true });
  }
});

const rawHash = (path: string) => sha256(readFileSync(path));

describe('ingestFile', () => {
  it('@F2 @K1 preserves the original byte-identically, never touches the source, writes a valid intake report', async () => {
    const src = join(EXAMPLES, '06_interactive_course.html');
    const before = { hash: rawHash(src), mtime: statSync(src).mtimeMs };
    const courseDir = tempCourse();
    const { report, produced } = await ingestFile({
      filePath: src,
      courseDir,
      courseId: 'chem',
      declaredStage: 'COURSE_BUILD',
      mode: 'improve',
      now: NOW,
    });

    expect({ hash: rawHash(src), mtime: statSync(src).mtimeMs }).toEqual(before);
    const original = report.originals[0];
    expect(original?.path).toMatch(/^input\/originals\/[0-9a-f]{12}-06_interactive_course\.html$/);
    const copy = join(courseDir, original?.path ?? '');
    expect(rawHash(copy)).toBe(before.hash);
    expect(readFileSync(copy).equals(readFileSync(src))).toBe(true);
    expect(statSync(copy).mode & 0o222).toBe(0); // read-only

    const onDisk = IntakeReportSchema.parse(JSON.parse(readFileSync(join(courseDir, 'input/intake-report.json'), 'utf8')));
    expect(onDisk).toEqual(report);
    expect(report).toMatchObject({
      courseId: 'chem',
      createdAt: NOW.toISOString(),
      declaredStage: 'COURSE_BUILD',
      acceptedStage: 'COURSE_BUILD',
      mode: 'improve',
      lossy: false,
      inferred: { stage: 'COURSE_BUILD', confidence: 'high', method: 'heuristic' },
      nextLegalTargets: ['COURSE_QA', 'RELEASE'],
    });
    expect(report.counts).toMatchObject({
      screens: 133,
      interactions: 39,
      references: 38,
      glossary: 29,
      acronyms: 9,
      visuals: 20,
      modules: 11,
    });
    expect(produced.map((p) => [p.logicalKey, p.path, p.stage])).toEqual([
      ['buildHtml', 'build/index.html', 'COURSE_BUILD'],
      ['courseModel', 'model/course.json', 'COURSE_MODEL'],
      ['storyboardJson', 'storyboard/storyboard.json', 'STORYBOARD'],
      ['storyboardMd', 'storyboard/storyboard.md', 'STORYBOARD'],
    ]);
    for (const p of produced) expect(existsSync(join(courseDir, p.path))).toBe(true);
    expect(readFileSync(join(courseDir, 'build/index.html')).equals(readFileSync(src))).toBe(true);
    const model = CourseModelSchema.parse(JSON.parse(readFileSync(join(courseDir, 'model/course.json'), 'utf8')));
    expect(model.sourceArtifacts[0]?.path).toBe(original?.path);
    expect(report.producedArtifacts).toEqual(produced.map((p) => p.path));
    // pipeline-owned files are untouched
    expect(existsSync(join(courseDir, 'state.json'))).toBe(false);
    expect(existsSync(join(courseDir, 'artifacts.json'))).toBe(false);
  });

  it('@F2 @C3 editorial storyboard import lands in storyboard-edited.* and re-ingest is idempotent', async () => {
    const src = join(EXAMPLES, '05_storyboard_humanized.md');
    const courseDir = tempCourse();
    const first = await ingestFile({ filePath: src, courseDir, courseId: 'chem', now: NOW });
    expect(first.report.acceptedStage).toBe('EDITORIAL');
    expect(first.report.declaredStage).toBeNull();
    expect(first.produced.map((p) => p.path)).toEqual(['storyboard/storyboard-edited.json', 'storyboard/storyboard-edited.md']);
    StoryboardSchema.parse(JSON.parse(readFileSync(join(courseDir, 'storyboard/storyboard-edited.json'), 'utf8')));
    expect(first.report.contractGaps.find((g) => g.requirement === 'interactions with answer keys')?.status).toBe('met');
    expect(first.report.idsFound.items).toBe(39);
    const again = await ingestFile({ filePath: src, courseDir, courseId: 'chem', now: NOW });
    expect(again.report).toEqual(first.report);
  });

  it('@C3 research dossier, design, brief and concept imports produce their canonical files', async () => {
    const cases: [string, string, string[]][] = [
      [
        join(EXAMPLES, '02_research_dossier_expanded.md'),
        'RESEARCH_DOSSIER',
        ['research/research-dossier.json', 'research/research-dossier.md', 'research/sources.jsonl', 'research/claims.jsonl'],
      ],
      [
        join(EXAMPLES, '03_instructional_design_blueprint.md'),
        'INSTRUCTIONAL_DESIGN',
        ['design/instructional-design.json', 'design/instructional-design.md'],
      ],
      [join(EXAMPLES, '00_research_brief.md'), 'RESEARCH_BRIEF', ['research/research-brief.json', 'research/research-brief.md']],
      [join(FIX, 'concept.txt'), 'CONCEPT', [CONCEPT_REQUEST]],
    ];
    for (const [file, stage, paths] of cases) {
      const courseDir = tempCourse();
      const { report, produced } = await ingestFile({ filePath: file, courseDir, courseId: 'c', now: NOW });
      expect({ file, stage: report.acceptedStage }).toEqual({ file, stage });
      expect(produced.map((p) => p.path)).toEqual(paths);
    }
    const courseDir = tempCourse();
    await ingestFile({ filePath: join(EXAMPLES, '02_research_dossier_expanded.md'), courseDir, courseId: 'c', now: NOW });
    const claims = readFileSync(join(courseDir, 'research/claims.jsonl'), 'utf8').trim().split('\n');
    expect(JSON.parse(claims[0] ?? '{}').id).toBe('CLM-0001');
  });

  it('@F2 declared stage is validated: a mismatch is recorded, not silently accepted', async () => {
    const courseDir = tempCourse();
    const { report } = await ingestFile({
      filePath: join(FIX, 'mini-storyboard.md'),
      courseDir,
      courseId: 'c',
      declaredStage: 'RESEARCH_DOSSIER',
      now: NOW,
    });
    expect(report.acceptedStage).toBe('RESEARCH_DOSSIER');
    expect(report.inferred.stage).toBe('STORYBOARD');
    expect(report.warnings.some((w) => /differs from inferred STORYBOARD/.test(w))).toBe(true);
    expect(report.contractGaps.some((g) => g.status !== 'met')).toBe(true);
  });

  it('@F2 unsupported formats fail before anything is written', async () => {
    const courseDir = tempCourse();
    const pptx = join(courseDir, 'deck.pptx');
    writeFileSync(pptx, 'PK');
    const err = await ingestFile({ filePath: pptx, courseDir: join(courseDir, 'course'), courseId: 'c', now: NOW }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(CfError);
    expect((err as CfError).code).toBe('UNSUPPORTED_FORMAT');
    expect(existsSync(join(courseDir, 'course'))).toBe(false);
  });
});
