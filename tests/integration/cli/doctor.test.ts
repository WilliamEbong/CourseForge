/** @A6 Real `courseforge doctor` on this machine: JSON matches the manifest schema; text ends in a status line. */
import { describe, expect, it } from 'vitest';
import { main } from '../../../src/cli/main.js';
import { EnvironmentManifestSchema } from '../../../src/core/schemas/reports.js';

const capture = () => {
  const out = { stdout: '', stderr: '' };
  return {
    out,
    io: { stdout: { write: (s: string) => (out.stdout += s) }, stderr: { write: (s: string) => (out.stderr += s) } },
  };
};

describe('courseforge doctor @A6', () => {
  it('--json prints a schema-valid environment manifest and exits 0 only when ready', async () => {
    const { io, out } = capture();
    const code = await main(['doctor', '--json'], io);
    const manifest = EnvironmentManifestSchema.parse(JSON.parse(out.stdout));
    expect(manifest.checks.length).toBeGreaterThan(15);
    expect(code).toBe(manifest.status === 'ready' ? 0 : 3);
    expect(out.stdout).not.toMatch(/"email"/);
  });

  it('text mode ends with READY, REPAIRABLE or ACTION REQUIRED', async () => {
    const { io, out } = capture();
    await main(['doctor', '--only', 'os.,node.'], io);
    expect(out.stdout.trimEnd().split('\n').at(-1)).toMatch(/^(READY|REPAIRABLE — run: courseforge doctor --repair|ACTION REQUIRED)$/);
  });
});
