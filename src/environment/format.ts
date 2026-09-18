/** Human-readable doctor report: grouped check table, numbered next steps, one final status line. */
import type { DoctorCheck, EnvironmentManifest } from '../core/schemas/reports.js';

export const FINAL_LINE = {
  ready: 'READY',
  repairable: 'REPAIRABLE — run: courseforge doctor --repair',
  failed: 'ACTION REQUIRED',
} as const;

export function finalLine(status: EnvironmentManifest['status']): string {
  return status === 'ready' ? FINAL_LINE.ready : status === 'repairable' ? FINAL_LINE.repairable : FINAL_LINE.failed;
}

/** Colours only for interactive terminals that have not opted out (NO_COLOR). */
export function useColor(stream: { isTTY?: boolean }, env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(stream.isTTY) && !env.NO_COLOR;
}

const ESC = String.fromCharCode(27);
const SYMBOL: Record<DoctorCheck['status'], string> = { pass: '✓', warn: '!', fail: '✗', skip: '-' };
const COLOR: Record<DoctorCheck['status'], string> = { pass: '32', warn: '33', fail: '31', skip: '90' };

const GROUPS: [string, string][] = [
  ['os', 'System'],
  ['node', 'Toolchain'],
  ['npm', 'Toolchain'],
  ['git', 'Toolchain'],
  ['path', 'Location'],
  ['fs', 'Location'],
  ['deps', 'Dependencies'],
  ['pw', 'Dependencies'],
  ['build', 'Project'],
  ['config', 'Project'],
  ['schemas', 'Project'],
  ['project', 'Project'],
  ['claude', 'Agent backends'],
  ['codex', 'Agent backends'],
];
const groupOf = (id: string) => GROUPS.find(([p]) => id.split('.')[0] === p)?.[1] ?? 'Other';

/** `final: false` omits the READY/REPAIRABLE line (setup prints its own after the smoke run). */
export function formatDoctor(m: EnvironmentManifest, opts: { color?: boolean; final?: boolean } = {}): string {
  const paint = (code: string, s: string) => (opts.color ? `${ESC}[${code}m${s}${ESC}[0m` : s);
  const lines: string[] = [`CourseForge doctor — ${m.platform} ${m.architecture}, Node ${m.node.version}`];
  const order = [...new Set(GROUPS.map(([, g]) => g)), 'Other'];
  for (const group of order) {
    const items = m.checks.filter((c) => groupOf(c.id) === group);
    if (!items.length) continue;
    lines.push('', group);
    for (const c of items) {
      const tag = c.repaired ? ' [repaired]' : '';
      lines.push(`  ${paint(COLOR[c.status], SYMBOL[c.status])} ${c.title}: ${c.message}${tag}`);
    }
  }
  const steps = m.checks
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.repair)
    .sort((a, b) => Number(b.status === 'fail') - Number(a.status === 'fail'))
    .map((c) => `${c.title}: ${c.repair}${c.classification === 'repairable' ? ' (automatic with --repair)' : ''}`);
  if (steps.length) {
    lines.push('', 'Next steps');
    steps.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s}`);
    });
  }
  const color = m.status === 'ready' ? '32' : m.status === 'repairable' ? '33' : '31';
  if (opts.final !== false) lines.push('', paint(color, finalLine(m.status)));
  return `${lines.join('\n')}\n`;
}
