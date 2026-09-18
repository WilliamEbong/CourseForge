/**
 * @A7 The setup smoke fixture (spec 06): build a course → render diagrams → launch Chromium → exercise
 * interactions → axe → screenshot → verify artifacts. `courseforge setup` prints READY only if this passes.
 */
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSmoke } from '../../../src/pipeline/smoke.js';

describe('setup smoke fixture @A7', () => {
  it('@A7 builds, renders, drives and audits the smoke course', async () => {
    const out = mkdtempSync(join(tmpdir(), 'cf-smoke-'));
    const res = await runSmoke(out);
    expect(res.steps.map((s) => s.name)).toEqual(['fixture', 'diagrams', 'build', 'browser', 'axe', 'screenshot']);
    for (const s of res.steps) expect(s.ok, `${s.name}: ${s.detail}`).toBe(true);
    expect(existsSync(join(out, 'index.html'))).toBe(true);
  }, 300_000);
});
