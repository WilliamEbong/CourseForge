/**
 * @B7 Optional live smoke (COURSEFORGE_LIVE=1). One tiny structured task per available, authenticated backend;
 * asserts plain schema-valid JSON (no global style/plugin contamination) and raw logs on disk.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHarness, probeAll } from '../../../src/harness/factory.js';
import { makeRequest, SCHEMA, tmp } from './helpers.js';

describe.skipIf(!process.env.COURSEFORGE_LIVE)('live smoke @B7', () => {
  for (const name of ['claude', 'codex'] as const) {
    it(`${name}: tiny structured task returns clean JSON`, async () => {
      const probe = (await probeAll())[name];
      if (!probe.available || probe.authenticated === false) return;
      const dir = tmp('cf-live-');
      const res = await createHarness(name).run(
        makeRequest({
          taskId: `live-${name}`,
          cwd: dir,
          logDir: join(dir, 'logs'),
          outputSchemaPath: join(dir, 'schema.json'),
          writeMode: 'structured',
          prompt: 'Return JSON with ok=true and note="pong". Do not use any tools.',
          systemPreamble: 'You are a CourseForge smoke-test agent. Output must be valid JSON matching the schema.',
          outputSchema: SCHEMA,
          maxTurns: 2,
          timeoutSec: 240,
        }),
      );
      expect(res.failure).toBeNull();
      expect(res.output).toEqual({ ok: true, note: 'pong' });
      expect(res.rawLogPath).toBeTruthy();
    }, 300_000);
  }
});
