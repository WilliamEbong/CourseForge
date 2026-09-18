import type { BackendName, HarnessName } from '../core/enums.js';
import { ClaudeHarness } from './claude.js';
import { CodexHarness } from './codex.js';
import { FakeHarness, type FakeHarnessOptions } from './fake.js';
import { maybeRecord } from './record.js';
import type { Runner } from './shared.js';
import type { AgentHarness, HarnessProbe } from './types.js';

export interface CreateHarnessOptions {
  runner?: Runner;
  fake?: FakeHarnessOptions;
}

export function createHarness(name: HarnessName, opts: CreateHarnessOptions = {}): AgentHarness {
  if (name === 'fake') return new FakeHarness(opts.fake);
  const runnerOpt = opts.runner ? { runner: opts.runner } : {};
  return maybeRecord(name === 'claude' ? new ClaudeHarness(runnerOpt) : new CodexHarness(runnerOpt));
}

let cached: Promise<Record<BackendName, HarnessProbe>> | null = null;

/** Probes both real backends in parallel; cached for the process lifetime (`refresh` forces a re-probe). */
export function probeAll(refresh = false): Promise<Record<BackendName, HarnessProbe>> {
  if (!cached || refresh) {
    cached = Promise.all([new ClaudeHarness().probe(), new CodexHarness().probe()]).then(([claude, codex]) => ({ claude, codex }));
  }
  return cached;
}
