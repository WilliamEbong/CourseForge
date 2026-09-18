import { describe, expect, it } from 'vitest';
import { parseClaudeOutput } from '../../../src/harness/claude.js';
import { raw } from './helpers.js';

const parse = (file: string, code = 0) => parseClaudeOutput(raw(`claude/${file}`), '', code, false);

describe('claude output parsing @B3', () => {
  it('real stream-json success (live capture, 2.1.258): structured_output, usage, model', () => {
    const r = parse('success-structured.stream.jsonl');
    expect(r.ok).toBe(true);
    expect(r.failure).toBeNull();
    expect(r.output).toMatchObject({ ok: true });
    expect(typeof (r.output as { note: unknown }).note).toBe('string');
    expect(r.model).toBe('claude-opus-5[1m]');
    expect(r.usage?.outputTokens).toBeGreaterThan(0);
    expect(r.usage?.costUsd).toBeGreaterThan(0);
    expect(r.toolsUsed).toEqual([]); // StructuredOutput is not reported as an agent tool
  });

  it('real artifact-write capture: allowed write succeeded, out-of-scope write denied, tools reported', () => {
    const r = parse('artifact-write-partial-deny.stream.jsonl');
    expect(r.ok).toBe(true);
    expect(r.toolsUsed).toEqual(['Write']);
    expect(r.output).toMatchObject({ ok: false });
  });

  it('noise lines before JSON + fenced result text → parsed JSON, cache tokens summed', () => {
    const r = parse('noise-then-fenced.txt');
    expect(r).toMatchObject({ ok: true, output: { ok: true, note: 'fenced' }, model: 'claude-sonnet-5' });
    expect(r.usage).toEqual({ inputTokens: 150, outputTokens: 20, costUsd: 0.002 });
  });

  it('non-JSON result text is passed through for the pipeline schema check', () => {
    expect(parse('plain-text-result.json')).toMatchObject({ ok: true, output: 'I could not produce JSON.' });
  });

  it('truncated stream (no complete result event) → process_error, tools still collected', () => {
    const r = parse('truncated.stream.jsonl', 1);
    expect(r.ok).toBe(false);
    expect(r.failure?.class).toBe('process_error');
    expect(r.toolsUsed).toEqual(['Read']);
    expect(r.model).toBe('claude-opus-5');
  });

  it('stderr interleaved with stdout does not break parsing', () => {
    const r = parseClaudeOutput(raw('claude/success-structured.stream.jsonl'), 'warning: something on stderr\n', 0, false);
    expect(r.ok).toBe(true);
  });

  it('empty stdout with plain stderr → process_error', () => {
    const r = parseClaudeOutput('', 'segfault', 139, false);
    expect(r.failure?.class).toBe('process_error');
  });

  it('never trusts the exit code alone: is_error with exit 0 still fails', () => {
    expect(parse('not-logged-in.json', 0).ok).toBe(false);
  });
});
