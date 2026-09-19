/** SCORM 1.2 packaging: zip layout at the archive root, a well-formed manifest, and refusal for non-LMS builds. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { scormManifest, scormPackage } from '../../../src/pipeline/scorm.js';
import { zipEntries } from '../../../src/pipeline/zip.js';
import { renderCourse } from '../../../src/renderer/index.js';
import { loadSmoke } from './smoke.js';

/** Reads a zip written by zipEntries via its central directory (names + inflated contents). */
function unzip(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(at)).toBe(0x02014b50);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    const dataAt = local + 30 + buf.readUInt16LE(local + 26);
    out.set(name, inflateRawSync(buf.subarray(dataAt, dataAt + size)).toString('utf8'));
    at += 46 + nameLen;
  }
  return out;
}

const { model, visuals } = loadSmoke();
const dir = mkdtempSync(join(tmpdir(), 'cf-scorm-'));
const info = { courseId: model.courseId, title: 'Safety & "data" <sheets>', version: '1.0.0', passingPercent: 80 };

describe('SCORM 1.2 package', () => {
  it('zipEntries round-trips names and contents', () => {
    const now = new Date('2026-09-18T12:00:00');
    const files = unzip(
      zipEntries([
        { name: 'a.txt', data: Buffer.from('hello'), mtime: now },
        { name: 'dir/ü.txt', data: Buffer.from('wörld'), mtime: now },
      ]),
    );
    expect([...files]).toEqual([
      ['a.txt', 'hello'],
      ['dir/ü.txt', 'wörld'],
    ]);
  });

  it('the manifest is well-formed, escapes the title and carries the pass mark', () => {
    const xml = scormManifest(info);
    const $ = cheerio.load(xml, { xml: true });
    expect($('manifest').attr('identifier')).toBe(`courseforge-${model.courseId}`);
    expect($('schemaversion').text()).toBe('1.2');
    expect($('organization > title').text()).toBe(info.title);
    expect($('adlcp\\:masteryscore').text()).toBe('80');
    expect($('resource').attr('href')).toBe('index.html');
    expect($('resource').attr('adlcp:scormtype')).toBe('sco');
    expect(scormManifest({ ...info, passingPercent: null })).not.toContain('masteryscore');
  });

  it('packages an LMS build as index.html + imsmanifest.xml at the zip root', async () => {
    const { html } = await renderCourse(model, {
      visuals,
      mode: 'release',
      tracking: { destination: 'lms', endpoint: null, identity: 'name', id_label: null },
    });
    const file = join(dir, 'lms.html');
    writeFileSync(file, html);
    const files = unzip(scormPackage({ ...info, htmlPath: file, now: new Date() }));
    expect([...files.keys()]).toEqual(['imsmanifest.xml', 'index.html']);
    expect(files.get('index.html')).toBe(html);
  });

  it('refuses a course that was not built to report to an LMS', async () => {
    const { html } = await renderCourse(model, { visuals, mode: 'release' });
    const file = join(dir, 'plain.html');
    writeFileSync(file, html);
    expect(() => scormPackage({ ...info, htmlPath: file, now: new Date() })).toThrow(/not built to report to a training system/);
    expect(() => scormPackage({ ...info, htmlPath: join(dir, 'missing.html'), now: new Date() })).toThrow(/No built course/);
  });
});
