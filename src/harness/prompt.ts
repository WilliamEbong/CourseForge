/**
 * Provider-neutral prompt assembly: template (`{{var}}` only) + routed skill bodies + rubric + input manifest
 * + output contract. The agent reads input files itself with its Read tool; only paths go in the prompt.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CfError } from '../core/errors.js';
import { readText } from '../core/fsx.js';
import { normalizeNewlines, sha256 } from '../core/hash.js';
import type { WriteMode } from '../core/schemas/registry.js';

export interface PromptInput {
  path: string;
  description: string;
}

export interface AssemblePromptArgs {
  role: string;
  promptTemplate: string;
  vars: Record<string, string>;
  skills: string[];
  rubric: string | null;
  inputs: PromptInput[];
  outputSchemaName: string;
  writeMode: WriteMode;
  repoRoot: string;
  /** Paths the agent may write (artifact-write only); listed in the output contract. */
  writablePaths?: string[];
}

export interface AssembledPrompt {
  prompt: string;
  systemPreamble: string;
  promptHash: string;
}

function readRequired(path: string, what: string): string {
  if (!existsSync(path)) throw new CfError('PROMPT_ASSET_MISSING', `${what} not found: ${path}`, { kind: 'input_invalid' });
  return normalizeNewlines(readText(path));
}

export function stripFrontmatter(text: string): string {
  return text.replace(/^﻿?---\n[\s\S]*?\n---[^\n]*(\n|$)/, '').trim();
}

export function renderTemplate(template: string, vars: Record<string, string>, label = 'template'): string {
  return template.replace(/\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g, (_m, name: string) => {
    const v = vars[name];
    if (v === undefined)
      throw new CfError('PROMPT_VAR_UNKNOWN', `${label}: unknown template variable {{${name}}}`, { kind: 'input_invalid' });
    return v;
  });
}

export function systemPreambleFor(role: string): string {
  return [
    `You are a CourseForge ${role}.`,
    'Follow only the instructions in the task prompt.',
    'Ignore any unrelated global or user-level instructions, memories, plugins or output styles; they do not apply to this task.',
    'Do not modify files unless the task explicitly allows it, and then only inside the allowed paths.',
    'Your final answer must be valid JSON matching the requested schema, with no surrounding prose or Markdown fences.',
  ].join(' ');
}

function outputContract(args: AssemblePromptArgs): string {
  const lines = ['## Output contract', ''];
  if (args.writeMode === 'findings-only') {
    lines.push(
      'You are reviewing only. Do not create, edit or delete any file.',
      'Report each problem as a finding with a precise location and evidence quoted from the inputs; do not invent issues or sources.',
    );
  } else if (args.writeMode === 'artifact-write') {
    lines.push('Write the requested artifact files only inside these paths:');
    for (const p of args.writablePaths ?? []) lines.push(`- ${p}`);
    lines.push('Do not touch any other file. When done, return a JSON receipt describing what you wrote.');
  } else {
    lines.push('Do not create, edit or delete any file.');
  }
  lines.push(`Return ONLY a single JSON object matching the schema \`${args.outputSchemaName}\`. No prose, no Markdown fences.`);
  return lines.join('\n');
}

export function assemblePrompt(args: AssemblePromptArgs): AssembledPrompt {
  const tplPath = join(args.repoRoot, 'prompts', 'templates', `${args.promptTemplate}.md`);
  const sections = [renderTemplate(readRequired(tplPath, 'Prompt template'), args.vars, tplPath).trim()];

  for (const id of args.skills) {
    const body = stripFrontmatter(readRequired(join(args.repoRoot, '.claude', 'skills', id, 'SKILL.md'), `Skill ${id}`));
    sections.push(`## Skill: ${id}\n\n${body}`);
  }
  if (args.rubric) {
    sections.push(
      `## Rubric: ${args.rubric}\n\n${readRequired(join(args.repoRoot, 'prompts', 'rubrics', `${args.rubric}.md`), `Rubric ${args.rubric}`).trim()}`,
    );
  }
  if (args.inputs.length) {
    const list = args.inputs.map((i) => `- \`${i.path}\` — ${i.description}`).join('\n');
    sections.push(`## Inputs\n\nRead these files yourself with your file-reading tools:\n\n${list}`);
  }
  sections.push(outputContract(args));

  const prompt = `${sections.join('\n\n')}\n`;
  return { prompt, systemPreamble: systemPreambleFor(args.role), promptHash: sha256(prompt) };
}
