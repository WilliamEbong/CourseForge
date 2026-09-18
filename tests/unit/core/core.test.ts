import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXIT, STAGES, stageIndex } from '../../../src/core/enums.js';
import { CfError } from '../../../src/core/errors.js';
import { acquireLock, diffTrees, hashTree, readJson, writeJson } from '../../../src/core/fsx.js';
import { canonicalJson, hashBytes, normalizeNewlines, sha256 } from '../../../src/core/hash.js';
import { isValidId, nextSequentialId, slugify, splitCitationToken } from '../../../src/core/ids.js';
import { matchesPattern } from '../../../src/core/paths.js';
import { runProcess } from '../../../src/core/proc.js';
import { CourseManifestSchema, SCHEMAS } from '../../../src/core/schemas/index.js';
import { toWireSchema, wireViolations } from '../../../src/core/wire-schema.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'cf-core-'));

describe('enums', () => {
  it('orders the 11 canonical stages', () => {
    expect(STAGES).toHaveLength(11);
    expect(stageIndex('CONCEPT')).toBe(0);
    expect(stageIndex('RELEASE')).toBe(10);
  });
});

describe('hashing @F3', () => {
  it('hashes CRLF and LF text identically', () => {
    expect(hashBytes(Buffer.from('a\r\nb\r\n'), 'x.md')).toBe(hashBytes(Buffer.from('a\nb\n'), 'x.md'));
    expect(normalizeNewlines('a\rb')).toBe('a\nb');
  });
  it('does not normalise binary files', () => {
    expect(hashBytes(Buffer.from('a\r\n'), 'x.png')).not.toBe(hashBytes(Buffer.from('a\n'), 'x.png'));
  });
  it('canonical JSON sorts keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } })).toBe('{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}');
    expect(sha256('x')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('ids', () => {
  it('accepts imported mnemonic IDs', () => {
    for (const id of ['AB-OHS-4', 'LO4', 'T3-07', 'GA-15', 'V-07', 'HPR-5.12', 'CCOHS-SDS']) expect(isValidId(id)).toBe(true);
    expect(isValidId('has space')).toBe(false);
  });
  it('splits citation locators', () => {
    expect(splitCitationToken('AB-OHS-4 s.21')).toEqual({ sourceId: 'AB-OHS-4', locator: 's.21' });
    expect(splitCitationToken('CCOHS-SDS')).toEqual({ sourceId: 'CCOHS-SDS', locator: null });
  });
  it('mints sequential IDs', () => {
    expect(nextSequentialId('CLM', ['CLM-0001', 'CLM-0009', 'X-1'])).toBe('CLM-0010');
    expect(slugify('Laboratory Chemical Risk & CAPA!')).toBe('laboratory-chemical-risk-capa');
  });
});

describe('fsx', () => {
  it('writes and reads JSON atomically', () => {
    const d = tmp();
    writeJson(join(d, 'a/b.json'), { x: 1 });
    expect(readJson(join(d, 'a/b.json'))).toEqual({ x: 1 });
    expect(readFileSync(join(d, 'a/b.json'), 'utf8').endsWith('\n')).toBe(true);
  });
  it('diffs file trees for write audits', () => {
    const d = tmp();
    writeFileSync(join(d, 'a.txt'), '1');
    writeFileSync(join(d, 'b.txt'), '1');
    const before = hashTree(d);
    writeFileSync(join(d, 'a.txt'), '2');
    writeFileSync(join(d, 'c.txt'), '3');
    expect(diffTrees(before, hashTree(d))).toEqual({ added: ['c.txt'], removed: [], changed: ['a.txt'] });
  });
  it('course lock is exclusive and steals locks from dead processes', () => {
    const d = tmp();
    const release = acquireLock(d, 'test');
    expect(() => acquireLock(d, 'test2')).toThrowError(CfError);
    try {
      acquireLock(d, 'x');
    } catch (e) {
      expect((e as CfError).exitCode).toBe(EXIT.COURSE_LOCKED);
    }
    release();
    writeFileSync(join(d, '.lock'), JSON.stringify({ pid: 999999, host: hostname(), startedAt: '', cmd: 'dead' }));
    let stolen = false;
    const r2 = acquireLock(d, 'y', () => {
      stolen = true;
    });
    expect(stolen).toBe(true);
    r2();
  });
});

describe('paths', () => {
  it('matches writable path patterns', () => {
    expect(matchesPattern('storyboard/storyboard.json', 'storyboard/**')).toBe(true);
    expect(matchesPattern('storyboard', 'storyboard/**')).toBe(true);
    expect(matchesPattern('design/x.json', 'storyboard/**')).toBe(false);
    expect(matchesPattern('review/findings/c0/a.json', 'review/findings/*/a.json')).toBe(true);
  });
});

describe('schemas', () => {
  it('course.yaml accepts legacy gate vocabulary and lowercase stage keys', () => {
    const m = CourseManifestSchema.parse({
      course: { id: 'demo', title: 'Demo' },
      human_review: { research: 'optional', instructional_design: 'required', STORYBOARD: 'hybrid' },
    });
    expect(m.human_review).toEqual({ RESEARCH_DOSSIER: 'auto', INSTRUCTIONAL_DESIGN: 'human', STORYBOARD: 'hybrid' });
    expect(m.pipeline.agent_backend).toBe('auto');
  });
  it('every agent-facing schema converts to a strict wire schema', () => {
    for (const [name, entry] of Object.entries(SCHEMAS)) {
      if (!entry.agent) continue;
      const wire = toWireSchema(entry.schema);
      expect(wireViolations(wire), name).toEqual([]);
    }
  });
});

describe('proc', () => {
  it('runs a process without a shell and captures output', async () => {
    const res = await runProcess([process.execPath, '-e', 'process.stdin.on("data",d=>process.stdout.write(String(d).toUpperCase()))'], {
      stdin: 'hi',
    });
    expect(res.code).toBe(0);
    expect(res.stdout).toBe('HI');
  });
  it('reports spawn errors and timeouts', async () => {
    const missing = await runProcess(['definitely-not-a-real-binary-xyz']);
    expect(missing.spawnError ?? missing.code).toBeTruthy();
    const slow = await runProcess([process.execPath, '-e', 'setTimeout(()=>{},10000)'], { timeoutMs: 300 });
    expect(slow.timedOut).toBe(true);
  });
});
