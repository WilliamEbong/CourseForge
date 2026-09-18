import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyLocks } from '../../../src/artifacts/locks.js';
import {
  addConflict,
  addLockedIds,
  detectDrift,
  getArtifact,
  latest,
  listArtifacts,
  loadRegistry,
  registerArtifact,
  removeLockedIds,
  restoreVersion,
  setApproval,
  setLocked,
  setReviewStatus,
} from '../../../src/artifacts/registry.js';
import { hashFile } from '../../../src/core/hash.js';
import { ArtifactRegistrySchema } from '../../../src/core/schemas/index.js';

const course = () => mkdtempSync(join(tmpdir(), 'cf-art-'));
const put = (dir: string, rel: string, text: string) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
};
const reg = (dir: string, over: Partial<Parameters<typeof registerArtifact>[1]> = {}) =>
  registerArtifact(dir, {
    stage: 'STORYBOARD',
    path: 'storyboard/storyboard.json',
    logicalKey: 'storyboard',
    producer: { kind: 'fake', runId: 'RUN-1' },
    event: 'generated',
    now: '2026-09-18T00:00:00.000Z',
    ...over,
  });

describe('artifact versions @C8 @F3', () => {
  it('missing artifacts.json loads as an empty registry', () => {
    expect(loadRegistry(course())).toEqual({ schemaVersion: 1, nextSeq: 1, artifacts: {} });
  });

  it('registers v1 with hash, bytes, provenance and a snapshot', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', '{"a":1}\r\n');
    const a = reg(dir);
    expect(a).toMatchObject({ artifactId: 'ART-0001', version: 1, label: 'storyboard-v1-generated', supersededBy: null, bytes: 9 });
    expect(a.hash).toBe(hashFile(join(dir, 'storyboard/storyboard.json')));
    expect(a.producer).toEqual({ kind: 'fake', backendVersion: null, taskId: null, runId: 'RUN-1' });
    expect(readFileSync(join(dir, a.snapshotPath as string), 'utf8')).toBe('{"a":1}\r\n');
    expect(ArtifactRegistrySchema.safeParse(JSON.parse(readFileSync(join(dir, 'artifacts.json'), 'utf8'))).success).toBe(true);
  });

  it('same hash (incl. CRLF-only change) returns the existing record without a new version', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', '{"a":1}\n');
    const a = reg(dir);
    put(dir, 'storyboard/storyboard.json', '{"a":1}\r\n');
    expect(reg(dir, { event: 'repaired' })).toEqual(a);
    expect(listArtifacts(loadRegistry(dir))).toHaveLength(1);
  });

  it('a changed file creates v2 and supersedes v1', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', '{"a":1}');
    const v1 = reg(dir);
    put(dir, 'storyboard/storyboard.json', '{"a":2}');
    const v2 = reg(dir, { event: 'human-edited', producer: { kind: 'human' }, parents: [v1.artifactId] });
    expect(v2).toMatchObject({
      artifactId: 'ART-0002',
      version: 2,
      label: 'storyboard-v2-human-edited',
      humanModified: true,
      parents: ['ART-0001'],
    });
    const r = loadRegistry(dir);
    expect(getArtifact(r, 'ART-0001').supersededBy).toBe('ART-0002');
    expect(latest(r, 'storyboard')?.artifactId).toBe('ART-0002');
    expect(listArtifacts(r, 'storyboard').map((x) => x.version)).toEqual([1, 2]);
  });

  it('restore copies a snapshot forward as a new version; history is kept', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', 'v1');
    reg(dir);
    put(dir, 'storyboard/storyboard.json', 'v2');
    reg(dir, { event: 'repaired' });
    const v3 = restoreVersion(dir, 'storyboard-v1-generated', '2026-09-18T01:00:00.000Z');
    expect(v3).toMatchObject({ version: 3, label: 'storyboard-v3-restored', parents: ['ART-0001'] });
    expect(readFileSync(join(dir, 'storyboard/storyboard.json'), 'utf8')).toBe('v1');
    expect(listArtifacts(loadRegistry(dir))).toHaveLength(3);
    expect(existsSync(join(dir, 'versions/storyboard-v2-repaired/storyboard/storyboard.json'))).toBe(true);
    expect(() => restoreVersion(dir, 'nope-v9-x')).toThrow(/No snapshot/);
  });

  it('approval, lock, review status and conflicts persist', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', '{}');
    const a = reg(dir);
    setApproval(dir, a.artifactId, 'approved');
    setLocked(dir, a.artifactId, true);
    setReviewStatus(dir, a.artifactId, 'passed');
    addConflict(dir, a.artifactId, { kind: 'lock_conflict', detail: 'F-1 targets locked M1-B01', findingId: 'F-1' });
    expect(getArtifact(loadRegistry(dir), a.artifactId)).toMatchObject({
      approval: 'approved',
      locked: true,
      reviewStatus: 'passed',
      conflicts: [{ kind: 'lock_conflict', detail: 'F-1 targets locked M1-B01', findingId: 'F-1' }],
    });
    expect(() => setLocked(dir, 'ART-9999', true)).toThrow(/Unknown artifact/);
  });
});

describe('drift detection @C8', () => {
  it('reports latest records whose file changed or disappeared, ignoring superseded ones', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', 'a');
    reg(dir);
    put(dir, 'storyboard/storyboard.json', 'b');
    const v2 = reg(dir);
    put(dir, 'research/sources.jsonl', '{"id":"S1"}\n');
    const src = reg(dir, { stage: 'RESEARCH_DOSSIER', path: 'research/sources.jsonl', logicalKey: 'sources' });
    expect(detectDrift(dir)).toEqual([]);

    put(dir, 'storyboard/storyboard.json', 'human edit');
    rmSync(join(dir, 'research/sources.jsonl'));
    const drift = detectDrift(dir);
    expect(drift.map((d) => d.record.artifactId)).toEqual([v2.artifactId, src.artifactId]);
    expect(drift[0]?.currentHash).toBe(hashFile(join(dir, 'storyboard/storyboard.json')));
    expect(drift[1]?.currentHash).toBeNull();
  });
});

describe('locks @C8 @E5', () => {
  const sb = {
    modules: [
      {
        id: 'M1',
        blocks: [
          { id: 'M1-B01', body: 'Keep me' },
          { id: 'M1-B02', body: 'Edit me' },
        ],
      },
    ],
  };

  it('JSON section locks survive edits elsewhere and flag edits inside', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', JSON.stringify(sb));
    const a = reg(dir);
    addLockedIds(dir, a.artifactId, ['M1-B01']);
    const locked = getArtifact(loadRegistry(dir), a.artifactId);
    expect(locked.lockedIds).toHaveLength(1);

    const edited = structuredClone(sb);
    (edited.modules[0]?.blocks[1] as { body: string }).body = 'changed';
    put(dir, 'storyboard/storyboard.json', JSON.stringify(edited, null, 2)); // formatting change is not a violation
    expect(verifyLocks(dir, locked)).toEqual([]);

    (edited.modules[0]?.blocks[0] as { body: string }).body = 'tampered';
    put(dir, 'storyboard/storyboard.json', JSON.stringify(edited));
    expect(verifyLocks(dir, locked)).toEqual([
      { id: 'M1-B01', expected: locked.lockedIds[0]?.hash, actual: expect.stringMatching(/^sha256:/) },
    ]);

    removeLockedIds(dir, a.artifactId, ['M1-B01']);
    expect(getArtifact(loadRegistry(dir), a.artifactId).lockedIds).toEqual([]);
    expect(() => addLockedIds(dir, a.artifactId, ['NOPE'])).toThrow(/IDs not found/);
  });

  it('whole-artifact lock compares the file hash', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', '{}');
    const a = setLocked(dir, reg(dir).artifactId, true);
    expect(verifyLocks(dir, a)).toEqual([]);
    put(dir, 'storyboard/storyboard.json', '{"x":1}');
    expect(verifyLocks(dir, a)).toHaveLength(1);
    rmSync(join(dir, 'storyboard/storyboard.json'));
    expect(verifyLocks(dir, a)[0]?.actual).toBeNull();
  });

  it('Markdown region locks via cf:id markers', () => {
    const dir = course();
    const md = [
      '# Dossier',
      '<!-- cf:id RS-01 -->',
      '## Section one',
      'Text one.',
      '### Sub',
      'Sub text.',
      '<!-- cf:id RS-02 -->',
      '## Section two',
      'Text two.',
    ].join('\n');
    put(dir, 'research/research-dossier.md', md);
    const a = reg(dir, { stage: 'RESEARCH_DOSSIER', path: 'research/research-dossier.md', logicalKey: 'dossier-md' });
    const locked = addLockedIds(dir, a.artifactId, ['RS-01']);
    put(dir, 'research/research-dossier.md', md.replace('Text two.', 'Text two, revised.'));
    expect(verifyLocks(dir, locked)).toEqual([]);
    put(dir, 'research/research-dossier.md', md.replace('Sub text.', 'Sub text, tampered.'));
    expect(verifyLocks(dir, locked).map((v) => v.id)).toEqual(['RS-01']);
  });
});

describe('containment @F1', () => {
  it('all writes stay inside the course directory', () => {
    const dir = course();
    put(dir, 'storyboard/storyboard.json', '{}');
    const a = reg(dir);
    expect(resolve(dir, a.snapshotPath as string).startsWith(resolve(dir))).toBe(true);
  });
});
