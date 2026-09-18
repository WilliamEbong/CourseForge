/**
 * Recording wrapper (`COURSEFORGE_RECORD=<dir>`): runs a real harness and writes each call's result as a
 * fake-harness fixture envelope, after scrubbing personal paths and secrets. If a secret-looking pattern
 * survives scrubbing, the fixture is NOT written.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeAtomic } from '../core/fsx.js';
import { sanitizeName } from './shared.js';
import type { AgentHarness, AgentTaskRequest, AgentTaskResult, HarnessProbe } from './types.js';

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /bearer\s+[A-Za-z0-9._~+/-]{16,}=*/i,
  /AKIA[0-9A-Z]{16}/,
  /xox[abpr]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Scrubs home paths (raw, JSON-escaped and forward-slash forms), emails and known token shapes. */
export function scrubText(text: string, home = homedir()): string {
  let out = text;
  const forms = new Set([home, home.replace(/\\/g, '\\\\'), home.replace(/\\/g, '/')]);
  for (const f of [...forms].sort((a, b) => b.length - a.length)) out = out.replace(new RegExp(escapeRe(f), 'gi'), '<HOME>');
  return out
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<EMAIL>')
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, '<SECRET>')
    .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, '<SECRET>')
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]{16,}=*/gi, '$1<SECRET>');
}

export function findSecret(text: string): string | null {
  const hit = SECRET_PATTERNS.find((re) => re.test(text));
  return hit ? hit.source : null;
}

export function recordPath(dir: string, req: Pick<AgentTaskRequest, 'promptTemplate' | 'subject' | 'cycle'>): string {
  return join(dir, sanitizeName(req.promptTemplate), `${sanitizeName(req.subject ?? 'default')}.c${req.cycle}.json`);
}

export class RecordingHarness implements AgentHarness {
  readonly name: AgentHarness['name'];
  /** Fixtures refused because a secret survived scrubbing (path → pattern). */
  readonly refused: { path: string; pattern: string }[] = [];

  constructor(
    private readonly inner: AgentHarness,
    private readonly dir: string,
  ) {
    this.name = inner.name;
  }

  probe(): Promise<HarnessProbe> {
    return this.inner.probe();
  }

  async run(req: AgentTaskRequest): Promise<AgentTaskResult> {
    const res = await this.inner.run(req);
    const envelope = res.failure
      ? { output: res.output, failure: { class: res.failure.class, message: res.failure.message } }
      : { output: res.output };
    const text = scrubText(`${JSON.stringify(envelope, null, 2)}\n`);
    const path = recordPath(this.dir, req);
    const secret = findSecret(text);
    if (secret) {
      this.refused.push({ path, pattern: secret });
      process.emitWarning(`CourseForge recorder refused to write ${path}: secret-like pattern ${secret} survived scrubbing`);
    } else {
      writeAtomic(path, text);
    }
    return res;
  }
}

/** Wraps `harness` when COURSEFORGE_RECORD names a directory; fake harnesses are never recorded. */
export function maybeRecord(harness: AgentHarness, dir = process.env.COURSEFORGE_RECORD): AgentHarness {
  return dir && harness.name !== 'fake' ? new RecordingHarness(harness, dir) : harness;
}
