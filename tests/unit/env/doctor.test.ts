/** @A6 Doctor aggregation, repair flow and redaction. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EnvironmentManifestSchema } from '../../../src/core/schemas/reports.js';
import type { DoctorCheckDef } from '../../../src/environment/checks.js';
import { overallStatus, redactEnvironment, runDoctor } from '../../../src/environment/doctor.js';
import { finalLine, formatDoctor } from '../../../src/environment/format.js';
import { fakeProbe } from '../../fixtures/env/fake-probe.js';

const tmp = mkdtempSync(join(tmpdir(), 'cf-doctor-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const def = (id: string, outcome: Awaited<ReturnType<DoctorCheckDef['run']>>, repair?: DoctorCheckDef['repair']): DoctorCheckDef => ({
  id,
  title: id,
  run: async () => outcome,
  ...(repair ? { repair } : {}),
});
const PASS = { status: 'pass', classification: 'ready', message: 'ok', repair: null } as const;
const WARN = { status: 'warn', classification: 'advisory', message: 'meh', repair: null } as const;
const FIX = { status: 'fail', classification: 'repairable', message: 'broken', repair: 'fix it' } as const;
const MANUAL = { status: 'fail', classification: 'manual', message: 'human', repair: 'do it' } as const;

describe('doctor @A6', () => {
  it('aggregates status: manual failure > repairable failure > ready; warnings never block', async () => {
    const probe = fakeProbe();
    const run = (checks: DoctorCheckDef[]) => runDoctor({ probe, checks, write: false }).then((m) => m.status);
    expect(await run([def('a', PASS), def('b', WARN)])).toBe('ready');
    expect(await run([def('a', PASS), def('b', FIX)])).toBe('repairable');
    expect(await run([def('a', MANUAL), def('b', FIX)])).toBe('failed');
    expect(overallStatus([])).toBe('ready');
  });

  it('full catalogue on a healthy fake machine produces a schema-valid ready manifest', async () => {
    const m = await runDoctor({ probe: fakeProbe(), write: false });
    expect(() => EnvironmentManifestSchema.parse(m)).not.toThrow();
    expect(m.status).toBe('ready');
    expect(m.checks.filter((c) => c.status === 'fail')).toEqual([]);
    expect(m.packages.zod).toBe('1.0.0');
  });

  it('repair runs only for failed repairable checks, then rechecks and marks repaired', async () => {
    let fixed = false;
    const repaired: string[] = [];
    const checks = [
      {
        id: 'x.fixable',
        title: 'fixable',
        run: async () => (fixed ? PASS : FIX),
        repair: async () => {
          repaired.push('x');
          fixed = true;
          return 'done';
        },
      },
      def('x.advisory', WARN, async () => {
        repaired.push('advisory');
        return 'no';
      }),
      def('x.ok', PASS, async () => {
        repaired.push('ok');
        return 'no';
      }),
    ];
    const m = await runDoctor({ probe: fakeProbe(), checks, repair: true, write: false });
    expect(repaired).toEqual(['x']);
    expect(m.status).toBe('ready');
    expect(m.checks.find((c) => c.id === 'x.fixable')?.repaired).toBe(true);
  });

  it('a failing repair is reported and status stays repairable', async () => {
    const checks = [
      def('y', FIX, async () => {
        throw new Error('EPERM');
      }),
    ];
    const m = await runDoctor({ probe: fakeProbe(), checks, repair: true, write: false });
    expect(m.status).toBe('repairable');
    expect(m.checks[0]?.message).toContain('repair failed: EPERM');
  });

  it('--only filters by id or prefix, and the manifest is written under .courseforge/', async () => {
    const probe = { ...fakeProbe(), repoRoot: tmp };
    const m = await runDoctor({ probe, only: ['os.', 'node.version'] });
    expect(m.checks.map((c) => c.id).sort()).toEqual(['node.version', 'os.disk', 'os.platform', 'os.ram']);
    const written = JSON.parse(readFileSync(join(tmp, '.courseforge', 'environment.json'), 'utf8'));
    expect(EnvironmentManifestSchema.parse(written).checks).toHaveLength(4);
  });

  it('redaction strips repo and home paths in either slash style', async () => {
    const m = await runDoctor({
      probe: fakeProbe(),
      checks: [def('p', { ...WARN, message: 'C:\\Users\\ada\\repo\\x and C:/Users/ada/.claude' })],
      write: false,
    });
    const out = redactEnvironment(m, { home: 'C:\\Users\\ada', repo: 'C:\\Users\\ada\\repo' });
    expect(out.checks[0]?.message).toBe('<repo>\\x and ~/.claude');
    expect(JSON.stringify(out)).not.toMatch(/Users[\\/]+ada/);
  });

  it('text output ends with the status line and lists next steps', async () => {
    const m = await runDoctor({ probe: fakeProbe(), checks: [def('deps.x', FIX)], write: false });
    const text = formatDoctor(m);
    expect(text.trimEnd().split('\n').at(-1)).toBe(finalLine('repairable'));
    expect(text).toContain('1. deps.x: fix it');
    expect(text).not.toContain('\u001b[');
    expect(finalLine('failed')).toBe('ACTION REQUIRED');
  });
});
