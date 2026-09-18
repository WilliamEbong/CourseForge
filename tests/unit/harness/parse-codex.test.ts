import { describe, expect, it } from 'vitest';
import { parseCodexOutput } from '../../../src/harness/codex.js';
import { raw } from './helpers.js';

describe('codex output parsing @B3', () => {
  it('real JSONL success (live capture, 0.144.6) + -o file; stderr noise ignored', () => {
    const r = parseCodexOutput(raw('codex/success.jsonl'), raw('codex/success.stderr.txt'), 0, false, raw('codex/success.last.json'));
    expect(r).toMatchObject({ ok: true, failure: null, output: { ok: true } });
    expect(r.usage).toEqual({ inputTokens: 14559, outputTokens: 70, costUsd: null });
    expect(r.toolsUsed).toEqual([]);
  });

  it('noise line, tool items, multiple turns, fenced -o content', () => {
    const r = parseCodexOutput(raw('codex/tools-and-fenced.jsonl'), '', 0, false, raw('codex/tools-and-fenced.last.txt'));
    expect(r).toMatchObject({ ok: true, output: { ok: true, note: 'fenced' } });
    expect(r.toolsUsed).toEqual(['command_execution', 'file_change']);
    expect(r.usage).toEqual({ inputTokens: 1200, outputTokens: 55, costUsd: null });
  });

  it('missing -o file is a hard failure even on exit 0', () => {
    const r = parseCodexOutput(raw('codex/success.jsonl'), '', 0, false, null);
    expect(r.ok).toBe(false);
    expect(r.failure?.class).toBe('process_error');
    expect(r.failure?.message).toMatch(/-o/);
  });

  it('non-JSON -o content is passed through for the pipeline schema check', () => {
    expect(parseCodexOutput(raw('codex/success.jsonl'), '', 0, false, 'sorry, no json')).toMatchObject({
      ok: true,
      output: 'sorry, no json',
    });
  });

  it('turn.failed wins over an -o file', () => {
    const r = parseCodexOutput(raw('codex/error-event.jsonl'), '', 1, false, '{"ok":true,"note":""}');
    expect(r.ok).toBe(false);
    expect(r.failure?.class).toBe('rate_limit');
  });

  it('truncated JSONL line is skipped', () => {
    const text = `${raw('codex/success.jsonl')}{"type":"item.comple`;
    expect(parseCodexOutput(text, '', 0, false, raw('codex/success.last.json')).ok).toBe(true);
  });
});
