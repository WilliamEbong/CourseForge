/**
 * Loads `config/*.json`, validates each file with its zod schema, then cross-checks references between
 * registries. Any problem is fatal: routing never runs on a partially valid configuration.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { BLOCK_KINDS, COMPONENT_TYPES, STAGES, VISUAL_ARCHETYPES } from '../core/enums.js';
import { CfError, configError, errorMessage } from '../core/errors.js';
import { readJson } from '../core/fsx.js';
import { hashFile } from '../core/hash.js';
import { configDir, repoRoot } from '../core/paths.js';
import {
  type FallbacksConfig,
  FallbacksConfigSchema,
  type GuidanceConfig,
  GuidanceConfigSchema,
  isSchemaName,
  LEARNER_IDENTITIES,
  type ReviewersConfig,
  ReviewersConfigSchema,
  type ReviewPolicy,
  ReviewPolicySchema,
  type RoutingConfig,
  RoutingConfigSchema,
  type SkillsConfig,
  SkillsConfigSchema,
  type StagesConfig,
  StagesConfigSchema,
  type ToolsConfig,
  ToolsConfigSchema,
  TRACKING_DESTINATIONS,
} from '../core/schemas/index.js';

export interface Registries {
  stages: StagesConfig;
  tools: ToolsConfig;
  skills: SkillsConfig;
  reviewers: ReviewersConfig;
  routing: RoutingConfig;
  fallbacks: FallbacksConfig;
  policy: ReviewPolicy;
  guidance: GuidanceConfig;
  /** file name → sha256 of the file as loaded (recorded in every execution plan). */
  hashes: Record<string, string>;
}

const FILES = {
  stages: ['stages.json', StagesConfigSchema],
  tools: ['tools.json', ToolsConfigSchema],
  skills: ['skills.json', SkillsConfigSchema],
  reviewers: ['reviewers.json', ReviewersConfigSchema],
  routing: ['routing.json', RoutingConfigSchema],
  fallbacks: ['fallbacks.json', FallbacksConfigSchema],
  policy: ['review-policy.json', ReviewPolicySchema],
  guidance: ['guidance.json', GuidanceConfigSchema],
} as const satisfies Record<string, readonly [string, z.ZodType]>;

export const lucideIconsDir = () => join(repoRoot(), 'node_modules', 'lucide-static', 'icons');

/** Renderer ids that are not tools but always valid in a chain. */
const BUILTIN_RENDERERS = new Set(['text_equivalent']);

/** Cross-reference checks on already schema-valid registries. Returns human-readable problems. */
export function crossCheck(r: Omit<Registries, 'hashes'>, iconsDir: string = lucideIconsDir()): string[] {
  const errs: string[] = [];
  const { tools } = r.tools;
  const { skills } = r.skills;
  const { reviewers } = r.reviewers;

  const checkTools = (where: string, ids: string[]) => {
    for (const t of ids) {
      if (!tools[t]) errs.push(`${where}: unknown tool "${t}" (tools.json)`);
      else if (tools[t].kind !== 'agent-tool') errs.push(`${where}: tool "${t}" is not an agent-tool`);
    }
  };
  const checkSkills = (where: string, ids: string[]) => {
    for (const s of ids) if (!skills[s]) errs.push(`${where}: unknown skill "${s}" (skills.json)`);
  };
  const checkSchema = (where: string, name: string) => {
    if (!isSchemaName(name)) errs.push(`${where}: unknown output schema "${name}" (src/core/schemas SCHEMAS)`);
  };

  for (const stage of STAGES) {
    const def = r.stages.stages[stage];
    const at = `stages.json stages.${stage}`;
    if (!r.routing.stageRoutes[stage]) errs.push(`routing.json stageRoutes: missing route for ${stage}`);
    if (def.kind === 'agent' && !def.generator && def.reviewers.length === 0)
      errs.push(`${at}: agent stage has no generator and no reviewers`);
    if (def.generator) {
      checkTools(`${at}.generator.tools`, def.generator.tools);
      checkSkills(`${at}.generator.skills`, def.generator.skills);
      checkSchema(`${at}.generator.outputSchema`, def.generator.outputSchema);
    }
    if (def.repairer) checkSchema(`${at}.repairer.outputSchema`, def.repairer.outputSchema);
    for (const id of def.reviewers) if (!reviewers[id]) errs.push(`${at}.reviewers: unknown reviewer "${id}" (reviewers.json)`);
    for (const [cat, ids] of Object.entries(def.rerunMap)) {
      for (const id of ids ?? [])
        if (!def.reviewers.includes(id)) errs.push(`${at}.rerunMap.${cat}: "${id}" is not a reviewer of this stage`);
    }
  }

  for (const [id, rev] of Object.entries(reviewers)) {
    checkTools(`reviewers.json reviewers.${id}.tools`, rev.tools);
    checkSkills(`reviewers.json reviewers.${id}.skills`, rev.skills);
    if (rev.tools.some((t) => tools[t]?.capabilities.includes('network')) && !rev.network) {
      errs.push(`reviewers.json reviewers.${id}: network tools require network: true`);
    }
  }

  for (const [i, route] of r.routing.visualRoutes.entries()) {
    for (const rd of [route.primary, ...route.fallbacks]) {
      const t = tools[rd];
      if (BUILTIN_RENDERERS.has(rd)) continue;
      if (!t || (t.kind !== 'renderer' && t.kind !== 'asset'))
        errs.push(`routing.json visualRoutes.${i} (${route.rule}): renderer "${rd}" is not a registered renderer tool`);
    }
  }
  for (const a of VISUAL_ARCHETYPES) {
    const covered = r.routing.visualRoutes.some(
      (v) => (v.when.archetype === null || v.when.archetype === a) && (v.when.interaction === null || v.when.interaction === 'none'),
    );
    if (!covered) errs.push(`routing.json visualRoutes: no route for archetype ${a}`);
  }

  const kinds = new Set<string>(BLOCK_KINDS);
  const comps = new Set<string>(COMPONENT_TYPES);
  for (const [k, c] of Object.entries(r.routing.components)) {
    if (!kinds.has(k)) errs.push(`routing.json components: unknown block kind "${k}"`);
    if (!comps.has(c)) errs.push(`routing.json components.${k}: unknown component type "${c}"`);
  }
  for (const k of BLOCK_KINDS) if (!r.routing.components[k]) errs.push(`routing.json components: no component for block kind "${k}"`);

  // Setup-wizard choices must be codes the code understands (review codes are fixed in src/pipeline/setup.ts).
  const choiceSets: Record<string, readonly string[]> = {
    review: ['recommended', 'every_step', 'custom'],
    tracking: TRACKING_DESTINATIONS,
    identity: LEARNER_IDENTITIES,
  };
  for (const [q, allowed] of Object.entries(choiceSets)) {
    const opts = r.guidance.questions[q as keyof GuidanceConfig['questions']].options;
    if (!opts.length) errs.push(`guidance.json questions.${q}: needs at least one option`);
    for (const o of opts) if (!allowed.includes(o.value)) errs.push(`guidance.json questions.${q}: unknown option "${o.value}"`);
  }

  if (!existsSync(iconsDir)) errs.push(`routing.json icons: lucide-static icons directory not found (${iconsDir})`);
  else {
    for (const [name, file] of Object.entries(r.routing.icons)) {
      if (!existsSync(join(iconsDir, `${file}.svg`))) errs.push(`routing.json icons.${name}: lucide icon "${file}" does not exist`);
    }
  }
  return errs;
}

function loadAll(dir: string): { registries: Registries | null; errors: string[] } {
  const errors: string[] = [];
  const loaded: Partial<Record<keyof typeof FILES, unknown>> = {};
  const hashes: Record<string, string> = {};
  for (const [key, [file, schema]] of Object.entries(FILES) as [keyof typeof FILES, (typeof FILES)[keyof typeof FILES]][]) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      errors.push(`${file}: missing`);
      continue;
    }
    try {
      loaded[key] = readJson(path, schema as z.ZodType);
      hashes[file] = hashFile(path);
    } catch (err) {
      errors.push(err instanceof CfError ? err.message : `${file}: ${errorMessage(err)}`);
    }
  }
  if (errors.length) return { registries: null, errors };
  const registries = { ...(loaded as Omit<Registries, 'hashes'>), hashes };
  errors.push(...crossCheck(registries));
  return { registries: errors.length ? null : registries, errors };
}

/** Loads and validates all registries; throws a `configError` listing every problem. */
export function loadRegistries(dir: string = configDir()): Registries {
  const { registries, errors } = loadAll(dir);
  if (!registries) throw configError(`Invalid configuration in ${dir}:\n  ${errors.join('\n  ')}`, { errors });
  return registries;
}

/** Non-throwing variant for `courseforge validate-config`. */
export function validateConfig(dir: string = configDir()): { ok: boolean; errors: string[] } {
  const { errors } = loadAll(dir);
  return { ok: errors.length === 0, errors };
}
