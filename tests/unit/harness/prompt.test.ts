import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../../src/core/hash.js';
import { type AssemblePromptArgs, assemblePrompt, stripFrontmatter } from '../../../src/harness/prompt.js';
import { tmp } from './helpers.js';

function repo(): string {
  const root = tmp('cf-prompt-');
  const put = (rel: string, text: string) => {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  put('prompts/templates/review.md', '# Review {{ stage }}\r\n\r\nCourse: {{courseTitle}}.\r\n');
  put('.claude/skills/fact-check/SKILL.md', '---\nname: fact-check\ndisable-model-invocation: true\n---\nCheck every claim.\n');
  put('prompts/rubrics/accuracy.md', 'Score accuracy 1-5.\n');
  return root;
}

const args = (root: string, over: Partial<AssemblePromptArgs> = {}): AssemblePromptArgs => ({
  role: 'accuracy-reviewer',
  promptTemplate: 'review',
  vars: { stage: 'RESEARCH_BRIEF', courseTitle: 'Chemical risk' },
  skills: ['fact-check'],
  rubric: 'accuracy',
  inputs: [{ path: 'research/research-brief.md', description: 'the brief under review' }],
  outputSchemaName: 'ReviewFindings',
  writeMode: 'findings-only',
  repoRoot: root,
  ...over,
});

describe('prompt assembly', () => {
  it('renders template vars, strips skill frontmatter, adds rubric, inputs and output contract', () => {
    const { prompt, systemPreamble, promptHash } = assemblePrompt(args(repo()));
    expect(prompt).toContain('# Review RESEARCH_BRIEF');
    expect(prompt).toContain('Course: Chemical risk.');
    expect(prompt).not.toContain('\r');
    expect(prompt).toContain('## Skill: fact-check\n\nCheck every claim.');
    expect(prompt).not.toContain('disable-model-invocation');
    expect(prompt).toContain('## Rubric: accuracy\n\nScore accuracy 1-5.');
    expect(prompt).toContain('## Inputs');
    expect(prompt).toContain('- `research/research-brief.md` — the brief under review');
    expect(prompt).toContain('## Output contract');
    expect(prompt).toContain('Do not create, edit or delete any file.');
    expect(prompt).toContain('schema `ReviewFindings`');
    expect(systemPreamble).toMatch(/^You are a CourseForge accuracy-reviewer\./);
    expect(systemPreamble).toMatch(/output styles/);
    expect(promptHash).toBe(sha256(prompt));
  });

  it('is deterministic', () => {
    const root = repo();
    expect(assemblePrompt(args(root)).promptHash).toBe(assemblePrompt(args(root)).promptHash);
  });

  it('artifact-write contract lists writable paths', () => {
    const { prompt } = assemblePrompt(
      args(repo(), { writeMode: 'artifact-write', writablePaths: ['courses/demo/research'], rubric: null, skills: [] }),
    );
    expect(prompt).toContain('- courses/demo/research');
    expect(prompt).toContain('JSON receipt');
    expect(prompt).not.toContain('## Rubric');
  });

  it('unknown template variable is an error', () => {
    expect(() => assemblePrompt(args(repo(), { vars: { stage: 'X' } }))).toThrow(/unknown template variable \{\{courseTitle\}\}/);
  });

  it('missing skill, rubric or template is an error', () => {
    const root = repo();
    expect(() => assemblePrompt(args(root, { skills: ['nope'] }))).toThrow(/Skill nope not found/);
    expect(() => assemblePrompt(args(root, { rubric: 'nope' }))).toThrow(/Rubric nope not found/);
    expect(() => assemblePrompt(args(root, { promptTemplate: 'nope' }))).toThrow(/Prompt template not found/);
  });

  it('stripFrontmatter leaves bodies without frontmatter untouched', () => {
    expect(stripFrontmatter('Body\n---\nnot frontmatter\n---\n')).toBe('Body\n---\nnot frontmatter\n---');
  });
});
