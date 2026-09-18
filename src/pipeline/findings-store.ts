/**
 * Persistence of review findings. Each stage keeps per-cycle raw reviewer outputs plus one `findings.json`
 * holding the current consolidated set (the release gate reads these).
 */
import { join } from 'node:path';
import { z } from 'zod';
import { STAGES, type Stage } from '../core/enums.js';
import { exists, readJson, writeAtomic, writeJson } from '../core/fsx.js';
import { findingsDir, STAGE_DIRS } from '../core/paths.js';
import { type Finding, FindingSchema, type FindingSet, type RepairPlan } from '../core/schemas/index.js';
import type { RunContext } from './context.js';

export function stageFindingsPath(stage: Stage): string {
  if (stage === 'COURSE_QA') return 'review/findings/findings.json';
  if (stage === 'RELEASE') return 'review/release/findings.json';
  return `${STAGE_DIRS[stage]}/review/${stage.toLowerCase()}/findings.json`;
}

export function cycleDir(stage: Stage, cycle: number): string {
  return findingsDir(stage, cycle);
}

export function saveReviewerOutput(ctx: RunContext, stage: Stage, cycle: number, reviewer: string, set: FindingSet): void {
  writeJson(join(ctx.dir, cycleDir(stage, cycle), `${reviewer}.json`), set);
}

export function saveCycle(
  ctx: RunContext,
  stage: Stage,
  cycle: number,
  findings: Finding[],
  plan: RepairPlan | null,
  consolidatedMd: string,
): void {
  const dir = join(ctx.dir, cycleDir(stage, cycle));
  writeJson(join(dir, 'findings.json'), findings);
  if (plan) writeJson(join(dir, 'repair-plan.json'), plan);
  writeAtomic(join(dir, 'consolidated-review.md'), consolidatedMd);
  writeJson(join(ctx.dir, stageFindingsPath(stage)), findings);
  if (stage === 'COURSE_QA') {
    if (plan) writeJson(join(ctx.dir, 'review/repair-plan.json'), plan);
    writeAtomic(join(ctx.dir, 'review/consolidated-review.md'), consolidatedMd);
  }
}

export function loadStageFindings(ctx: Pick<RunContext, 'dir'>, stage: Stage): Finding[] {
  const p = join(ctx.dir, stageFindingsPath(stage));
  return exists(p) ? readJson(p, z.array(FindingSchema)) : [];
}

export function saveStageFindings(ctx: Pick<RunContext, 'dir'>, stage: Stage, findings: Finding[]): void {
  writeJson(join(ctx.dir, stageFindingsPath(stage)), findings);
}

export function allStageFindings(ctx: Pick<RunContext, 'dir'>): Finding[] {
  return STAGES.flatMap((s) => loadStageFindings(ctx, s));
}
