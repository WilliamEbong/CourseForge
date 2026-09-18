import { describe, expect, it } from 'vitest';
import { buildClaudeArgv, ClaudeHarness, toRulePath } from '../../../src/harness/claude.js';
import { buildCodexArgv, CodexHarness, codexLastMessagePath } from '../../../src/harness/codex.js';
import { scanFlags } from '../../../src/harness/shared.js';
import { makeRequest, proc, raw, SCHEMA, scriptedRunner, tmp } from './helpers.js';

const claudeFlags = { flags: scanFlags(raw('claude/help.txt')) };
const codexFlags = { flags: scanFlags(raw('codex/exec-help.txt')) };
const schemaJson = JSON.stringify(SCHEMA);

const reviewer = makeRequest();
const generator = makeRequest({ role: 'brief-author', writeMode: 'structured', subject: null, maxTurns: 1 });
const writer = makeRequest({
  role: 'dossier-author',
  writeMode: 'artifact-write',
  agentTools: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebSearch', 'WebFetch'],
  writablePaths: ['/repo/courses/demo/research', '/scratch/out'],
  readOnlyPaths: ['/repo/courses/demo/input', '/refs'],
  network: true,
});

describe('claude argv @B2', () => {
  it('reviewer (findings-only): read-only tools, dontAsk, inline schema, isolation flags', () => {
    expect(buildClaudeArgv(reviewer, claudeFlags)).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--safe-mode',
      '--setting-sources',
      'project',
      '--strict-mcp-config',
      '--permission-mode',
      'dontAsk',
      '--tools',
      'Read,Grep,Glob',
      '--json-schema',
      schemaJson,
      '--append-system-prompt',
      'You are a CourseForge research-reviewer.',
      '--max-turns',
      '4',
      '--no-session-persistence',
    ]);
  });

  it('structured generator: write tools stripped, max-turns clamped to 2 (structured output uses a turn)', () => {
    const argv = buildClaudeArgv({ ...generator, agentTools: ['Read', 'Write', 'Edit', 'WebFetch'] }, claudeFlags);
    expect(argv[argv.indexOf('--tools') + 1]).toBe('Read');
    expect(argv[argv.indexOf('--max-turns') + 1]).toBe('2');
    expect(argv).not.toContain('--settings');
  });

  it('artifact-write: Edit allow rules only for writable paths, network tools allowed, --add-dir outside cwd', () => {
    const argv = buildClaudeArgv(writer, claudeFlags);
    expect(argv[argv.indexOf('--tools') + 1]).toBe('Read,Grep,Glob,Write,Edit,WebSearch,WebFetch');
    expect(JSON.parse(argv[argv.indexOf('--settings') + 1] ?? '')).toEqual({
      permissions: {
        allow: [
          'Edit(//repo/courses/demo/research)',
          'Edit(//repo/courses/demo/research/**)',
          'Edit(//scratch/out)',
          'Edit(//scratch/out/**)',
          'WebSearch',
          'WebFetch',
        ],
      },
    });
    const i = argv.indexOf('--add-dir');
    expect(argv.slice(i, i + 3)).toEqual(['--add-dir', '/refs', '/scratch/out']);
    expect(argv).toContain('dontAsk');
    expect(argv).not.toContain('bypassPermissions');
  });

  it('network off: web tools removed and no allow rules', () => {
    const argv = buildClaudeArgv({ ...writer, network: false }, claudeFlags);
    expect(argv[argv.indexOf('--tools') + 1]).toBe('Read,Grep,Glob,Write,Edit');
    expect(argv[argv.indexOf('--settings') + 1]).not.toMatch(/Web/);
  });

  it('flag gating: flags absent from --help are not used (older CLI)', () => {
    const old = { flags: claudeFlags.flags.filter((f) => !['--safe-mode', '--json-schema', '--no-session-persistence'].includes(f)) };
    const argv = buildClaudeArgv(reviewer, old);
    expect(argv).not.toContain('--safe-mode');
    expect(argv).not.toContain('--json-schema');
    expect(argv).not.toContain('--no-session-persistence');
    expect(argv).toContain('--setting-sources');
    expect(argv).toContain('--max-turns'); // hidden flag allowlisted
  });

  it('converts Windows paths to // rule anchors', () => {
    expect(toRulePath('C:\\Users\\a\\courses\\x\\')).toBe('//c/Users/a/courses/x');
    expect(toRulePath('/home/a/x')).toBe('//home/a/x');
  });

  it('run(): prompt goes to stdin, never argv; cwd and timeout passed through', async () => {
    const dir = tmp();
    const { runner, calls } = scriptedRunner((args) =>
      args[0] === '--version' ? proc({ stdout: '2.1.258' }) : proc({ stdout: raw('claude/success-structured.stream.jsonl') }),
    );
    const req = makeRequest({ cwd: dir, logDir: `${dir}/logs`, prompt: 'SECRET PROMPT TEXT' });
    const res = await new ClaudeHarness({ runner, command: ['claude'] }).run(req);
    expect(res.ok).toBe(true);
    const run = calls.at(-1);
    expect(run?.opts).toMatchObject({ cwd: dir, stdin: 'SECRET PROMPT TEXT', timeoutMs: 60_000 });
    expect(run?.argv.join(' ')).not.toContain('SECRET PROMPT TEXT');
  });
});

describe('codex argv @B2', () => {
  it('reviewer: read-only sandbox, isolation flags, schema file, -o, stdin prompt', () => {
    expect(buildCodexArgv(reviewer, codexFlags)).toEqual([
      'exec',
      '--json',
      '--ignore-user-config',
      '--ignore-rules',
      '--skip-git-repo-check',
      '--ephemeral',
      '-C',
      '/repo',
      '-s',
      'read-only',
      '-c',
      'approval_policy="never"',
      '-c',
      'web_search="disabled"',
      '-c',
      `developer_instructions=${JSON.stringify('You are a CourseForge research-reviewer.')}`,
      '--output-schema',
      '/repo/schemas/review.schema.json',
      '-o',
      codexLastMessagePath(reviewer),
      '-',
    ]);
  });

  it('artifact-write: workspace-write, writable roots outside cwd via --add-dir, network enabled', () => {
    const argv = buildCodexArgv(writer, codexFlags);
    expect(argv.slice(argv.indexOf('-s'), argv.indexOf('-s') + 2)).toEqual(['-s', 'workspace-write']);
    expect(argv).toContain('web_search="live"');
    expect(argv).toContain('sandbox_workspace_write.network_access=true');
    expect(argv.filter((_a, i) => argv[i - 1] === '--add-dir')).toEqual(['/scratch/out']);
    expect(argv.join(' ')).not.toMatch(/danger-full-access|bypass/);
  });

  it('structured generator never gets a writable sandbox or network', () => {
    const argv = buildCodexArgv({ ...generator, network: false }, codexFlags);
    expect(argv).toContain('read-only');
    expect(argv).not.toContain('--add-dir');
    expect(argv).toContain('web_search="disabled"');
  });

  it('flag gating: missing isolation flags are skipped', () => {
    const old = { flags: codexFlags.flags.filter((f) => f !== '--ignore-rules' && f !== '--ephemeral') };
    const argv = buildCodexArgv(reviewer, old);
    expect(argv).not.toContain('--ignore-rules');
    expect(argv).not.toContain('--ephemeral');
    expect(argv).toContain('--ignore-user-config');
  });

  it('run(): writes the wire schema file when missing and sends the prompt on stdin', async () => {
    const dir = tmp();
    const req = makeRequest({ cwd: dir, logDir: `${dir}/logs`, outputSchemaPath: `${dir}/schemas/x.schema.json`, prompt: 'P' });
    const { runner, calls } = scriptedRunner((args) => (args[0] === '--version' ? proc({ stdout: 'codex-cli 0.144.6' }) : proc()));
    await new CodexHarness({ runner, command: ['codex'] }).run(req);
    const { readFileSync } = await import('node:fs');
    expect(JSON.parse(readFileSync(req.outputSchemaPath, 'utf8'))).toEqual(SCHEMA);
    expect(calls.at(-1)?.opts.stdin).toBe('P');
    expect(calls.at(-1)?.argv.at(-1)).toBe('-');
  });
});
