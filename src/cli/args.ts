/** Argument parsing helpers: node:util parseArgs wrapper, stage aliases, enum flags. All errors are usage errors (exit 2). */
import { type ParseArgsConfig, parseArgs } from 'node:util';
import type { z } from 'zod';
import { STAGES, type Stage } from '../core/enums.js';
import { usageError } from '../core/errors.js';

export type OptionSpec = NonNullable<ParseArgsConfig['options']>;
export type Values = Record<string, string | boolean | undefined>;

export interface Parsed {
  values: Values;
  positionals: string[];
}

export function parseCommand(args: string[], options: OptionSpec, maxPositionals: number, command: string): Parsed {
  let res: { values: Record<string, unknown>; positionals: string[] };
  try {
    res = parseArgs({ args, options, strict: true, allowPositionals: true });
  } catch (err) {
    throw usageError(`${command}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.positionals.length > maxPositionals) {
    throw usageError(`${command}: unexpected argument "${res.positionals[maxPositionals]}"`);
  }
  return { values: res.values as Values, positionals: res.positionals };
}

const STAGE_ALIASES: Record<string, Stage> = {
  concept: 'CONCEPT',
  brief: 'RESEARCH_BRIEF',
  research: 'RESEARCH_DOSSIER',
  dossier: 'RESEARCH_DOSSIER',
  design: 'INSTRUCTIONAL_DESIGN',
  storyboard: 'STORYBOARD',
  editorial: 'EDITORIAL',
  visual: 'VISUAL_DIRECTION',
  model: 'COURSE_MODEL',
  build: 'COURSE_BUILD',
  qa: 'COURSE_QA',
  release: 'RELEASE',
};

/** Canonical stage names (any case, `-`/space for `_`) or the short aliases above. */
export function resolveStage(input: string): Stage {
  const norm = input
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_');
  const canonical = STAGES.find((s) => s === norm);
  const stage = canonical ?? STAGE_ALIASES[input.trim().toLowerCase()];
  if (!stage) {
    throw usageError(`unknown stage "${input}". Use one of: ${STAGES.join(', ')} (or ${Object.keys(STAGE_ALIASES).join(', ')})`);
  }
  return stage;
}

export function str(values: Values, name: string): string | undefined {
  const v = values[name];
  return typeof v === 'string' ? v : undefined;
}

export function required(values: Values, name: string, command: string): string {
  const v = str(values, name);
  if (!v) throw usageError(`${command}: --${name} is required`);
  return v;
}

export function optStage(values: Values, name: string): Stage | undefined {
  const v = str(values, name);
  return v === undefined ? undefined : resolveStage(v);
}

export function optEnum<T>(schema: z.ZodType<T>, values: Values, name: string): T | undefined {
  const v = str(values, name);
  if (v === undefined) return undefined;
  const res = schema.safeParse(v);
  if (!res.success) throw usageError(`invalid --${name} "${v}"`);
  return res.data;
}

export function optInt(values: Values, name: string): number | undefined {
  const v = str(values, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw usageError(`--${name} must be a non-negative integer`);
  return n;
}

export function optList(values: Values, name: string): string[] | undefined {
  const v = str(values, name);
  return v === undefined
    ? undefined
    : v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

export const flag = (values: Values, name: string): boolean => values[name] === true;
