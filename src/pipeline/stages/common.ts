/**
 * Shared helpers for stage handlers: reading canonical artifacts, lock sets, produced-artifact records.
 */
import { join } from 'node:path';
import type { z } from 'zod';
import { latest, loadRegistry } from '../../artifacts/index.js';
import type { Stage } from '../../core/enums.js';
import { exists, readJson } from '../../core/fsx.js';
import { readJsonl } from '../../core/log.js';
import { COURSE_FILES } from '../../core/paths.js';
import {
  type ClaimRecord,
  ClaimRecordSchema,
  type ExecutionPlan,
  type SourceRecord,
  SourceRecordSchema,
  type Storyboard,
  StoryboardSchema,
} from '../../core/schemas/index.js';
import type { Issue } from '../checks/content.js';
import type { RunContext } from '../context.js';

export interface Produced {
  logicalKey: string;
  path: string;
  stage: Stage;
  event?: 'generated' | 'imported' | 'repaired' | 'build' | 'qa-repaired' | 'release' | 'reviewed' | 'human-edited';
}

export interface Subject {
  key: string;
  title: string;
  extra: unknown;
  inputs?: { path: string; description: string }[];
}

export interface RepairSpec {
  path: string;
  logicalKey: string;
  schemas: Record<string, z.ZodType>;
  rootSchema?: z.ZodType;
  /** Load the repairable document (defaults to reading `path` as JSON). */
  load?(ctx: RunContext): unknown;
  /** Persist the repaired document and derived files (defaults to writing JSON to `path`). */
  save?(ctx: RunContext, doc: unknown): Produced[];
}

export interface StageHandler {
  /** Fan-out units for per-section / per-module generators. */
  subjects?(ctx: RunContext): Subject[];
  /** `{{extra}}` context for a single (non fan-out) generator task. */
  generatorExtra?(ctx: RunContext): unknown;
  /** Merge validated agent outputs into canonical artifacts. */
  merge?(ctx: RunContext, outputs: { subject: string | null; output: unknown }[]): Produced[];
  /** Deterministic compile (deterministic stages, or QA engine before the review panel). */
  compile?(ctx: RunContext, plan: ExecutionPlan, cycle: number): Promise<Produced[]>;
  /** Deterministic validators → issues. */
  validate(ctx: RunContext, validatorIds: readonly string[]): Promise<Issue[]>;
  /** How repairs are applied (null = stage output is not repairable by replacement). */
  repair?(ctx: RunContext): RepairSpec | null;
  /** Called after a successful repair (e.g. QA rebuild + retest). */
  afterRepair?(ctx: RunContext, plan: ExecutionPlan, cycle: number): Promise<Produced[]>;
}

export function p(ctx: RunContext, rel: string): string {
  return join(ctx.dir, rel);
}

export function has(ctx: RunContext, rel: string): boolean {
  return exists(p(ctx, rel));
}

export function read<T>(ctx: RunContext, rel: string, schema: z.ZodType<T>): T {
  return readJson(p(ctx, rel), schema);
}

export function tryRead<T>(ctx: RunContext, rel: string, schema: z.ZodType<T>): T | null {
  return has(ctx, rel) ? read(ctx, rel, schema) : null;
}

export function sources(ctx: RunContext): SourceRecord[] {
  return readJsonl(p(ctx, COURSE_FILES.sources), SourceRecordSchema);
}

export function claims(ctx: RunContext): ClaimRecord[] {
  return readJsonl(p(ctx, COURSE_FILES.claims), ClaimRecordSchema);
}

/** The storyboard downstream stages consume: the edited version once it exists. */
export function canonicalStoryboardPath(ctx: RunContext): string {
  return has(ctx, COURSE_FILES.storyboardEditedJson) ? COURSE_FILES.storyboardEditedJson : COURSE_FILES.storyboardJson;
}

export function canonicalStoryboard(ctx: RunContext): Storyboard {
  return read(ctx, canonicalStoryboardPath(ctx), StoryboardSchema);
}

export function storyboardKeyFor(path: string): string {
  return path === COURSE_FILES.storyboardEditedJson ? 'storyboard-edited' : 'storyboard';
}

/** Section-level locked IDs recorded on the latest version of an artifact. */
export function lockedIds(ctx: RunContext, logicalKey: string): Set<string> {
  const rec = latest(loadRegistry(ctx.dir), logicalKey);
  return new Set(rec?.lockedIds.map((l) => l.id) ?? []);
}

export function isWholeLocked(ctx: RunContext, logicalKey: string): boolean {
  return latest(loadRegistry(ctx.dir), logicalKey)?.locked ?? false;
}

export function wants(ids: readonly string[], id: string): boolean {
  return ids.includes(id);
}
