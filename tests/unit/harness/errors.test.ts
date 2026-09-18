import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HARNESS_FAILURES } from '../../../src/core/enums.js';
import { ClaudeHarness, parseClaudeOutput } from '../../../src/harness/claude.js';
import { CodexHarness, parseCodexOutput } from '../../../src/harness/codex.js';
import { classifyStatus, classifyText } from '../../../src/harness/shared.js';
import { RETRYABLE_FAILURES } from '../../../src/harness/types.js';
import { makeRequest, proc, raw, scriptedRunner, tmp } from './helpers.js';

describe('failure taxonomy @B5', () => {
  it.each([
    ['claude/not-logged-in.json', 'authentication_failed', false],
    ['claude/api-error-429.json', 'rate_limit', true],
    ['claude/api-error-529.json', 'overloaded', true],
    ['claude/billing.json', 'billing_error', false],
    ['claude/model-not-found.json', 'model_not_found', false],
    ['claude/max-turns.json', 'unknown', false],
    ['claude/rate-limit-retry.stream.jsonl', 'rate_limit', true],
  ] as const)('claude %s → %s (retryable %s)', (file, cls, retryable) => {
    const r = parseClaudeOutput(raw(file), '', 1, false);
    expect(r.ok).toBe(false);
    expect(r.failure).toMatchObject({ class: cls, retryable });
  });

  it.each([
    ['codex/error-event.jsonl', 'rate_limit'],
    ['codex/unauthorized.jsonl', 'authentication_failed'],
    ['codex/usage-limit.jsonl', 'rate_limit'],
  ] as const)('codex %s → %s', (file, cls) => {
    expect(parseCodexOutput(raw(file), '', 1, false, null).failure?.class).toBe(cls);
  });

  it('codex non-zero exit with auth stderr and no events', () => {
    expect(parseCodexOutput('', raw('codex/not-logged-in.stderr.txt'), 1, false, null).failure?.class).toBe('authentication_failed');
  });

  it.each([
    [true, 1, 'timeout'],
    [false, 143, 'timeout'],
  ])('timedOut=%s exit=%s → %s (both backends)', (timedOut, code, cls) => {
    expect(parseClaudeOutput('', '', code, timedOut).failure?.class).toBe(cls);
    expect(parseCodexOutput('', '', code, timedOut, null).failure?.class).toBe(cls);
  });

  it('spawn error → unavailable (not retryable)', () => {
    const r = parseClaudeOutput('', '', null, false, 'spawn claude ENOENT');
    expect(r.failure).toMatchObject({ class: 'unavailable', retryable: false });
  });

  it('HTTP status table', () => {
    expect([401, 402, 404, 400, 429, 529, 500, 503, 200].map(classifyStatus)).toEqual([
      'authentication_failed',
      'billing_error',
      'model_not_found',
      'invalid_request',
      'rate_limit',
      'overloaded',
      'server_error',
      'server_error',
      null,
    ]);
  });

  it('text table', () => {
    expect(classifyText('Prompt is too long: max_tokens exceeded')).toBe('max_output_tokens');
    expect(classifyText('invalid_request_error: messages.0 bad')).toBe('invalid_request');
    expect(classifyText('Internal server error')).toBe('server_error');
    expect(classifyText('all good')).toBeNull();
  });

  it('retryable flags follow RETRYABLE_FAILURES for every class', () => {
    for (const cls of HARNESS_FAILURES) {
      expect(RETRYABLE_FAILURES.has(cls)).toBe(['rate_limit', 'overloaded', 'server_error', 'timeout', 'process_error'].includes(cls));
    }
  });
});

describe('raw logs @B5', () => {
  it('claude writes <taskId>.stdout/.stderr (sanitised) and sets rawLogPath', async () => {
    const dir = tmp();
    const { runner } = scriptedRunner((args) =>
      args[0] === '--version' ? proc({ stdout: '2.1.258' }) : proc({ stdout: raw('claude/api-error-429.json'), stderr: 'E!' }),
    );
    const res = await new ClaudeHarness({ runner, command: ['claude'] }).run(
      makeRequest({ cwd: dir, taskId: 'T/../1 x', logDir: join(dir, 'logs', 'tasks') }),
    );
    expect(res.failure?.class).toBe('rate_limit');
    expect(res.rawLogPath).toBe(join(dir, 'logs', 'tasks', 'T_.._1_x.stdout'));
    expect(readFileSync(res.rawLogPath ?? '', 'utf8')).toBe(raw('claude/api-error-429.json'));
    expect(readFileSync(join(dir, 'logs', 'tasks', 'T_.._1_x.stderr'), 'utf8')).toBe('E!');
    expect(res.backendVersion).toBe('2.1.258');
    expect(res.promptHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('codex logs raw output and reports missing -o', async () => {
    const dir = tmp();
    const { runner } = scriptedRunner((args) =>
      args[0] === '--version' ? proc({ stdout: 'codex-cli 0.144.6' }) : proc({ stdout: raw('codex/success.jsonl') }),
    );
    const res = await new CodexHarness({ runner, command: ['codex'] }).run(
      makeRequest({ cwd: dir, logDir: join(dir, 'logs'), outputSchemaPath: join(dir, 's.json') }),
    );
    expect(res.failure?.class).toBe('process_error');
    expect(existsSync(join(dir, 'logs', 'TASK-1.stdout'))).toBe(true);
  });

  it('unavailable backend short-circuits without spawning the task', async () => {
    const { runner, calls } = scriptedRunner(() => proc({ code: null, spawnError: 'ENOENT' }));
    const res = await new ClaudeHarness({ runner, command: ['claude'] }).run(makeRequest({ logDir: tmp() }));
    expect(res.failure?.class).toBe('unavailable');
    expect(calls).toHaveLength(1);
  });
});
