/**
 * The generic stage loop (spec 02):
 *   plan (saved before any agent work) → validate inputs → generate | compile → validators + review panel
 *   → deterministic pre-adjudication → optional AI adjudication → repair plan → scoped repair → re-review
 *   (bounded cycles) → human gate → lock canonical artifacts.
 */
import { join } from 'node:path';
import { latest, listArtifacts, loadRegistry, registerArtifact, setApproval } from '../artifacts/index.js';
import { STAGE_CODES, STAGES, type Stage, stageIndex } from '../core/enums.js';
import { CfError, errorMessage } from '../core/errors.js';
import { exists, readText, relPath, removePath, writeAtomic, writeJson } from '../core/fsx.js';
import { hashFile } from '../core/hash.js';
import { COURSE_FILES, STAGE_DIRS } from '../core/paths.js';
import type {
  AdjudicationAgent,
  ExecutionPlan,
  Finding,
  FindingSet,
  GateState,
  HtmlRepairResult,
  RepairPlan,
  RepairResult,
  TaskSpec,
} from '../core/schemas/index.js';
import { effectiveRiskTier } from '../core/schemas/index.js';
import {
  applyAdjudication,
  applyHtmlEdits,
  buildRepairPlan,
  consolidatedReviewMarkdown,
  normaliseFindings,
  preAdjudicate,
  runPool,
  validatorFindings,
} from '../review/index.js';
import { resolveExecutionPlan } from '../routing/plan.js';
import { auditBefore, auditViolations, runAgentTask } from './agent.js';
import type { RunContext } from './context.js';
import { loadStageFindings, saveCycle, saveReviewerOutput, saveStageFindings } from './findings-store.js';
import { applyReplacements, targetObjects } from './repair-target.js';
import { needsStructuralRebuild } from './stages/delivery.js';
import { canonicalStoryboard, HANDLERS, has, lockedIds, type Produced, type StageHandler } from './stages/index.js';
import { invalidateStages, logDecisions, logEvent, patchStage, saveState, transitionStage } from './store.js';
import { IN_FLIGHT } from './transitions.js';

export type StageResult = 'locked' | 'waiting' | 'failed' | 'blocked';

function save(ctx: RunContext): void {
  saveState(ctx.dir, ctx.state, ctx.now());
}

function step(ctx: RunContext, stage: Stage, name: string, status: string, detail?: Record<string, unknown>): void {
  logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage, event: 'step', step: name, status, detail: detail ?? null });
  const st = ctx.state.stages[stage];
  if (status === 'done' && !st.completedSteps.includes(name)) st.completedSteps.push(name);
  save(ctx);
}

/* --------------------------------------------------------------------- inputs */

function resolveInputs(ctx: RunContext, stage: Stage) {
  const def = ctx.registries.stages.stages[stage];
  const reg = loadRegistry(ctx.dir);
  const rec = (path: string) =>
    listArtifacts(reg)
      .filter((a) => a.path === path)
      .at(-1) ?? null;
  const inputs: { artifactId: string | null; path: string; hash: string | null; required: boolean }[] = [];
  const missing: string[] = [];
  for (const req of def?.inputs.required ?? []) {
    const alts = Array.isArray(req) ? req : [req];
    const found = alts.find((a) => has(ctx, a));
    if (!found) {
      missing.push(alts.join(' | '));
      continue;
    }
    inputs.push({ artifactId: rec(found)?.artifactId ?? null, path: found, hash: hashFile(join(ctx.dir, found)), required: true });
  }
  for (const opt of def?.inputs.optional ?? [])
    if (has(ctx, opt))
      inputs.push({ artifactId: rec(opt)?.artifactId ?? null, path: opt, hash: hashFile(join(ctx.dir, opt)), required: false });
  return { inputs, missing };
}

function planVisuals(ctx: RunContext) {
  try {
    return canonicalStoryboard(ctx).visuals.map((v) => ({
      id: v.id,
      archetype: v.archetype,
      interaction: v.interaction,
      rendererOverride: v.rendererOverride,
    }));
  } catch {
    return [];
  }
}

function courseRelRoot(ctx: RunContext): string {
  return relPath(ctx.repo, ctx.dir) || '.';
}

/* ----------------------------------------------------------------- registration */

function register(ctx: RunContext, plan: ExecutionPlan, produced: Produced[], defaultEvent: Produced['event'], agent: boolean): string[] {
  const ids: string[] = [];
  const parents = plan.inputs.map((i) => i.artifactId).filter((x): x is string => !!x);
  for (const pr of produced) {
    if (!exists(join(ctx.dir, pr.path))) continue;
    const kind = agent ? (ctx.harnessName === 'fake' ? 'fake' : ctx.harnessName) : 'courseforge';
    const rec = registerArtifact(ctx.dir, {
      stage: pr.stage,
      path: pr.path,
      logicalKey: pr.logicalKey,
      producer: {
        kind,
        backendVersion: agent ? (ctx.probes[ctx.harnessName as 'claude' | 'codex']?.version ?? null) : null,
        runId: ctx.runId,
        taskId: plan.planId,
      },
      parents,
      event: pr.event ?? defaultEvent ?? 'generated',
      now: ctx.now(),
    });
    ctx.state.canonicalArtifacts[pr.logicalKey] = rec.artifactId;
    ids.push(rec.artifactId);
  }
  save(ctx);
  return ids;
}

/* ------------------------------------------------------------------ audit/rollback */

async function audited<T>(ctx: RunContext, stage: Stage, label: string, fn: () => Promise<T>): Promise<T> {
  const before = auditBefore(ctx);
  const out = await fn();
  const violations = auditViolations(ctx, before, []);
  if (violations.length) {
    const reg = loadRegistry(ctx.dir);
    for (const v of violations) {
      const rec = listArtifacts(reg)
        .filter((a) => a.path === v)
        .at(-1);
      if (rec?.snapshotPath && exists(join(ctx.dir, rec.snapshotPath)))
        writeAtomic(join(ctx.dir, v), readText(join(ctx.dir, rec.snapshotPath)));
      else if (!before.tree.has(v)) removePath(join(ctx.dir, v));
    }
    logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage, event: 'audit.violation', step: label, detail: { paths: violations } });
    throw new CfError(
      'WRITE_VIOLATION',
      `Agent work during ${label} modified files it was not allowed to touch: ${violations.join(', ')} (rolled back)`,
      {
        kind: 'write_violation',
        detail: { paths: violations },
      },
    );
  }
  return out;
}

/* ---------------------------------------------------------------------- gates */

function openGate(
  ctx: RunContext,
  stage: Stage,
  plan: ExecutionPlan | null,
  reason: GateState['reason'],
  reportPath: string | null,
): StageResult {
  const st = ctx.state.stages[stage];
  st.gate = {
    mode: plan?.humanGate.mode ?? 'human',
    status: 'pending',
    reason,
    openedAt: ctx.now(),
    decidedAt: null,
    decidedBy: null,
    reportPath,
    instructions: null,
    comments: st.gate?.comments ?? [],
    findingDecisions: st.gate?.findingDecisions ?? {},
  };
  if (st.status !== 'WAITING_FOR_HUMAN') transitionStage(ctx.dir, ctx.state, stage, 'wait-human', ctx.now(), ctx.runId);
  logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage, event: 'gate.opened', status: reason, detail: { reportPath } });
  save(ctx);
  ctx.progress(`${stage}: waiting for human review (${reason})${reportPath ? ` — see ${reportPath}` : ''}`);
  return stage === 'RELEASE' && reason === 'validator_failed' ? 'blocked' : 'waiting';
}

function lockStage(ctx: RunContext, stage: Stage, byHuman: boolean): StageResult {
  const st = ctx.state.stages[stage];
  if (st.status !== 'APPROVED')
    transitionStage(ctx.dir, ctx.state, stage, st.status === 'WAITING_FOR_HUMAN' ? 'human-approve' : 'approve', ctx.now(), ctx.runId);
  const def = ctx.registries.stages.stages[stage];
  const reg = loadRegistry(ctx.dir);
  for (const key of Object.keys(def?.artifacts ?? {})) {
    const rec = latest(reg, key);
    if (!rec) continue;
    setApproval(ctx.dir, rec.artifactId, 'approved');
    const canonical = byHuman
      ? registerArtifact(ctx.dir, {
          stage,
          path: rec.path,
          logicalKey: key,
          producer: { kind: 'human' },
          parents: [rec.artifactId],
          event: 'human-approved',
          milestone: true,
          now: ctx.now(),
        })
      : rec;
    if (byHuman) setApproval(ctx.dir, canonical.artifactId, 'approved');
    ctx.state.canonicalArtifacts[key] = canonical.artifactId;
  }
  transitionStage(ctx.dir, ctx.state, stage, 'lock', ctx.now(), ctx.runId);
  ctx.state.currentStage = stage;
  logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage, event: 'stage.locked' });
  save(ctx);
  ctx.progress(`${stage}: locked`);
  return 'locked';
}

/**
 * One-shot review: the author is asked once, before release. A stage whose findings could not be fixed is locked
 * with them still open instead of pausing; the release gate reports them (and blocks on the serious ones).
 */
function carryToRelease(ctx: RunContext, stage: Stage): boolean {
  return ctx.manifest.pipeline.review_level === 'one_shot' && stage !== 'RELEASE';
}

/** After a stage produces new canonical content, previously locked downstream stages are no longer current. */
function invalidateDownstream(ctx: RunContext, stage: Stage): void {
  invalidateStages(ctx.dir, ctx.state, STAGES.slice(stageIndex(stage) + 1), stage, ctx.now(), ctx.runId);
  save(ctx);
}

/* ---------------------------------------------------------------- generation */

async function generate(
  ctx: RunContext,
  stage: Stage,
  plan: ExecutionPlan,
  handler: StageHandler,
  instructions: string | null,
): Promise<Produced[]> {
  const gen = plan.generator;
  if (!gen || !handler.merge) throw new CfError('NO_GENERATOR', `Stage ${stage} has no generator`, { kind: 'internal' });
  const locks = [...lockedIds(ctx, Object.keys(ctx.registries.stages.stages[stage]?.artifacts ?? {})[0] ?? '')];
  const subjects = handler.subjects
    ? handler.subjects(ctx)
    : [{ key: null as string | null, title: '', extra: handler.generatorExtra?.(ctx) ?? {} }];
  if (!subjects.length) throw new CfError('NO_SUBJECTS', `Stage ${stage} has nothing to generate (empty plan)`, { kind: 'input_invalid' });
  const outputs = await audited(ctx, stage, 'generate', async () => {
    const settled = await runPool(
      subjects.map(
        (s) => () =>
          runAgentTask(ctx, gen, {
            subject: s.key,
            subjectTitle: s.title,
            cycle: 0,
            extra: s.extra,
            instructions: instructions ?? undefined,
            locks,
          }).then((r) => ({ subject: s.key, output: r.output })),
      ),
      ctx.registries.fallbacks.concurrency.fanOut,
    );
    const failed = settled.find((r) => r.status === 'rejected');
    if (failed && failed.status === 'rejected') throw failed.reason;
    return settled.map((r) => (r as PromiseFulfilledResult<{ subject: string | null; output: unknown }>).value);
  });
  return handler.merge(ctx, outputs);
}

/* ------------------------------------------------------------------- review */

interface ReviewOutcome {
  findings: Finding[];
  plan: RepairPlan | null;
  lockConflicts: number;
}

async function reviewCycle(
  ctx: RunContext,
  stage: Stage,
  plan: ExecutionPlan,
  handler: StageHandler,
  cycle: number,
  reviewers: TaskSpec[],
  carried: Finding[],
  extra: Finding[],
  canRepair: boolean,
): Promise<ReviewOutcome> {
  const primaryKey = Object.keys(ctx.registries.stages.stages[stage]?.artifacts ?? {})[0] ?? '';
  const repairSpec = handler.repair?.(ctx) ?? null;
  const lockKey = repairSpec?.logicalKey ?? primaryKey;
  const locked = lockedIds(ctx, lockKey);
  const issues = await handler.validate(ctx, plan.validators);
  const reviews = await audited(ctx, stage, `review#${cycle}`, async () => {
    const settled = await runPool(
      reviewers.map(
        (r) => () =>
          runAgentTask<FindingSet>(ctx, r, {
            subject: r.subject,
            cycle,
            locks: [...locked],
            extra: {
              stage,
              cycle,
              previouslyActioned: carried.length ? undefined : null,
              knownValidatorIssues: issues.slice(0, 40).map((i) => `${i.location}: ${i.problem}`),
            },
          }).then((res) => ({
            reviewer: r.subject ?? r.role,
            artifactId: ctx.state.canonicalArtifacts[primaryKey] ?? null,
            set: res.output,
          })),
      ),
      plan.reviewConcurrency,
    );
    const failed = settled.find((s) => s.status === 'rejected');
    if (failed && failed.status === 'rejected') throw failed.reason;
    return settled.map((s) => (s as PromiseFulfilledResult<{ reviewer: string; artifactId: string | null; set: FindingSet }>).value);
  });
  for (const r of reviews) saveReviewerOutput(ctx, stage, cycle, r.reviewer, r.set);
  const rFindings = normaliseFindings({ stage, cycle, reviews });
  const vFindings = validatorFindings({ stage, cycle, issues });
  const all = [...rFindings, ...carried, ...vFindings, ...extra];
  const gate = ctx.state.stages[stage].gate;
  const pre = preAdjudicate(all, {
    lockedIds: locked,
    humanDecisions: gate?.findingDecisions ?? {},
    repairSeverities: plan.repairSeverities,
  });
  let agent: AdjudicationAgent | null = null;
  if (pre.needsAI && plan.adjudicator && pre.actionable.length) {
    agent = (
      await audited(ctx, stage, `adjudicate#${cycle}`, () =>
        runAgentTask<AdjudicationAgent>(ctx, plan.adjudicator as TaskSpec, {
          subject: 'adjudicator',
          cycle,
          locks: [...locked],
          extra: { actionable: pre.actionable, contradictions: pre.contradictions, lockConflicts: pre.lockConflicts },
        }),
      )
    ).output;
  }
  const adj = applyAdjudication(pre, agent);
  const target = repairSpec ? 'model' : stage === 'COURSE_QA' && has(ctx, COURSE_FILES.buildHtml) ? 'html-direct' : 'tooling-defect';
  const repairPlan = canRepair
    ? buildRepairPlan({
        stage,
        cycle,
        artifactId: ctx.state.canonicalArtifacts[lockKey] ?? null,
        target,
        findings: adj.findings,
        lockConflicts: pre.lockConflicts,
        repairSeverities: plan.repairSeverities,
        instructions: adj.instructions,
      })
    : null;
  const md = consolidatedReviewMarkdown({
    stage,
    cycle,
    courseTitle: ctx.manifest.course.title,
    findings: adj.findings,
    plan: repairPlan,
    summaries: reviews.map((r) => ({ reviewer: r.reviewer, summary: r.set.summary })),
  });
  saveCycle(ctx, stage, cycle, adj.findings, repairPlan, md);
  return { findings: adj.findings, plan: repairPlan, lockConflicts: pre.lockConflicts.length };
}

async function repair(
  ctx: RunContext,
  stage: Stage,
  plan: ExecutionPlan,
  handler: StageHandler,
  repairPlan: RepairPlan,
  cycle: number,
): Promise<{ applied: string[]; produced: Produced[] }> {
  const spec = handler.repair?.(ctx) ?? null;
  if (!plan.repairer) return { applied: [], produced: [] };
  if (repairPlan.target === 'html-direct') {
    const htmlPath = join(ctx.dir, COURSE_FILES.buildHtml);
    const html = readText(htmlPath);
    const task: TaskSpec = { ...plan.repairer, promptTemplate: 'repair-html', outputSchema: 'html-repair-result' };
    const { output } = await audited(ctx, stage, `repair#${cycle}`, () =>
      runAgentTask<HtmlRepairResult>(ctx, task, { subject: 'repairer', cycle, extra: { actions: repairPlan.actions } }),
    );
    const res = applyHtmlEdits(html, output, repairPlan);
    writeAtomic(htmlPath, res.html);
    writeJson(join(ctx.dir, `review/findings/c${cycle}/repair-applied.json`), res);
    return {
      applied: res.applied,
      produced: [{ logicalKey: 'build', path: COURSE_FILES.buildHtml, stage: 'COURSE_BUILD', event: 'qa-repaired' }],
    };
  }
  if (!spec) return { applied: [], produced: [] };
  const doc = spec.load ? spec.load(ctx) : JSON.parse(readText(join(ctx.dir, spec.path)));
  const locked = lockedIds(ctx, spec.logicalKey);
  const { output } = await audited(ctx, stage, `repair#${cycle}`, () =>
    runAgentTask<RepairResult>(ctx, plan.repairer as TaskSpec, {
      subject: 'repairer',
      cycle,
      locks: [...locked],
      extra: {
        actions: repairPlan.actions,
        targets: targetObjects(doc, repairPlan, !!spec.rootSchema && locked.size === 0),
        wholeDocumentReplacementAllowed: !!spec.rootSchema && locked.size === 0,
      },
    }),
  );
  const res = applyReplacements(doc, output, repairPlan, { schemas: spec.schemas, rootSchema: spec.rootSchema, locked });
  writeJson(join(ctx.dir, `${stageDirFor(stage)}/repair-applied-c${cycle}.json`), { applied: res.applied, rejected: res.rejected });
  if (!res.applied.length) return { applied: [], produced: [] };
  let produced: Produced[];
  if (spec.save) produced = spec.save(ctx, res.doc);
  else {
    writeJson(join(ctx.dir, spec.path), res.doc);
    produced = [{ logicalKey: spec.logicalKey, path: spec.path, stage }];
  }
  const after = handler.afterRepair ? await handler.afterRepair(ctx, plan, cycle) : [];
  return { applied: res.applied, produced: [...produced.map((p) => ({ ...p, event: 'repaired' as const })), ...after] };
}

function stageDirFor(stage: Stage): string {
  if (stage === 'COURSE_QA') return 'review/findings';
  if (stage === 'RELEASE') return 'review/release';
  return `${STAGE_DIRS[stage]}/review/${stage.toLowerCase()}`;
}

/* ------------------------------------------------------------------ the loop */

export interface StageRunOptions {
  startStage: Stage;
  targetStage: Stage;
  force?: boolean;
}

export async function runStage(ctx: RunContext, stage: Stage, opts: StageRunOptions): Promise<StageResult> {
  ctx.stage = stage;
  const handler = HANDLERS[stage];
  const st = ctx.state.stages[stage];
  const def = ctx.registries.stages.stages[stage];
  if (!def) throw new CfError('NO_STAGE_DEF', `Stage ${stage} missing from config/stages.json`, { exitCode: 2 });

  let extraFindings: Finding[] = [];
  let resumeCycle: number | null = null;
  let instructions: string | null = null;

  if (st.status === 'LOCKED' && !opts.force) return 'locked';
  // Crash recovery: a stage left in-flight by an interrupted run restarts; completed generation is reused.
  let recoveredSteps: string[] = [];
  if (IN_FLIGHT.has(st.status)) {
    recoveredSteps = [...st.completedSteps];
    logEvent(ctx.dir, {
      ts: ctx.now(),
      runId: ctx.runId,
      stage,
      event: 'stage.recovered',
      status: st.status,
      detail: { completedSteps: recoveredSteps },
    });
    transitionStage(ctx.dir, ctx.state, stage, 'fail', ctx.now(), ctx.runId);
  }
  if (st.status === 'WAITING_FOR_HUMAN') {
    const g = st.gate;
    if (!g || g.status === 'pending') return stage === 'RELEASE' && g?.reason === 'validator_failed' ? 'blocked' : 'waiting';
    if (g.status === 'approved') return lockStage(ctx, stage, true);
    // rejected
    if (g.instructions?.trim()) {
      instructions = g.instructions;
      extraFindings = [
        {
          findingId: `${STAGE_CODES[stage]}-H${st.cyclesUsed}-001`,
          stage,
          reviewer: 'human',
          source: 'human',
          cycle: st.cyclesUsed,
          artifactId: null,
          severity: 'major',
          category: 'other',
          location: 'global',
          problem: `Human reviewer requested changes: ${g.instructions}`,
          evidence: [],
          recommendedAction: g.instructions,
          confidence: 'high',
          status: 'accepted',
          mergedFrom: [],
          checkId: null,
        },
      ];
    }
    resumeCycle = st.cyclesUsed;
  }

  const fresh = resumeCycle === null;
  if (fresh) {
    const intake = st.status === 'INGESTED' ? st.mode : 'generate';
    transitionStage(ctx.dir, ctx.state, stage, 'start', ctx.now(), ctx.runId);
    patchStage(ctx.state, stage, {
      mode: recoveredSteps.length ? st.mode : intake,
      cyclesUsed: 0,
      completedSteps: [],
      failure: null,
      gate: null,
      stale: null,
    });
  } else {
    transitionStage(ctx.dir, ctx.state, stage, 'human-rereview', ctx.now(), ctx.runId);
    st.gate = st.gate ? { ...st.gate, status: 'pending' } : null;
  }
  save(ctx);
  ctx.progress(`${stage}: starting (${st.mode})`);

  try {
    /* ---- plan (persisted before any agent work) */
    const { inputs, missing } = resolveInputs(ctx, stage);
    const generating = st.mode === 'generate' || st.mode === 'rebuild';
    if (fresh && generating && missing.length)
      throw new CfError('INPUT_MISSING', `${stage} is missing required inputs: ${missing.join(', ')}`, {
        kind: 'input_invalid',
        exitCode: 11,
      });
    let fanOutKeys: string[] = [];
    if (fresh && generating && handler.subjects && def.generator) fanOutKeys = handler.subjects(ctx).map((s) => s.key);
    const revision =
      (ctx.state.stages[stage].planId?.startsWith(`PLAN-${ctx.runId}-`)
        ? Number(ctx.state.stages[stage].planId?.split('-r').pop()) || 0
        : 0) + 1;
    const plan = resolveExecutionPlan({
      courseId: ctx.courseId,
      runId: ctx.runId,
      stage,
      revision,
      supersedes: st.planId,
      now: ctx.now(),
      mode: st.mode,
      startStage: opts.startStage,
      targetStage: opts.targetStage,
      fromStatus: st.status,
      registries: ctx.registries,
      manifest: ctx.manifest,
      riskTier: effectiveRiskTier(ctx.manifest),
      probes: ctx.probes,
      forcedHarness: ctx.harnessName === 'fake' ? 'fake' : undefined,
      overrides: { backend: ctx.backendPref, ...(ctx.cliGate ? { gate: ctx.cliGate } : {}) },
      inputs,
      fanOutKeys,
      visuals: planVisuals(ctx),
      courseRelRoot: courseRelRoot(ctx),
    });
    writeJson(join(ctx.dir, COURSE_FILES.executionPlans, `${plan.planId}.json`), plan);
    logDecisions(ctx.dir, plan.decisions);
    st.planId = plan.planId;
    step(ctx, stage, 'plan', 'done', { planId: plan.planId });

    /* ---- generate / compile */
    let producedNew = false;
    if (fresh) {
      const compileAlways = stage === 'COURSE_QA' || stage === 'RELEASE';
      const reuse = recoveredSteps.includes('generate') && def.outputs.every((o) => has(ctx, o));
      if (reuse) {
        ctx.progress(`${stage}: reusing outputs generated before the interruption`);
        transitionStage(ctx.dir, ctx.state, stage, 'inputs-valid-review', ctx.now(), ctx.runId);
      } else if (plan.generator && generating) {
        transitionStage(ctx.dir, ctx.state, stage, 'inputs-valid-generate', ctx.now(), ctx.runId);
        ctx.progress(`${stage}: generating${fanOutKeys.length ? ` (${fanOutKeys.length} units)` : ''}`);
        const produced = await generate(ctx, stage, plan, handler, instructions);
        register(ctx, plan, produced, 'generated', true);
        producedNew = true;
        transitionStage(ctx.dir, ctx.state, stage, 'generated', ctx.now(), ctx.runId);
      } else if (handler.compile && (generating || compileAlways)) {
        transitionStage(ctx.dir, ctx.state, stage, 'inputs-valid-generate', ctx.now(), ctx.runId);
        ctx.progress(`${stage}: compiling`);
        const produced = await handler.compile(ctx, plan, 0);
        register(ctx, plan, produced, stage === 'COURSE_BUILD' ? 'build' : 'generated', false);
        producedNew = produced.length > 0;
        transitionStage(ctx.dir, ctx.state, stage, 'generated', ctx.now(), ctx.runId);
      } else {
        transitionStage(ctx.dir, ctx.state, stage, 'inputs-valid-review', ctx.now(), ctx.runId);
      }
      step(ctx, stage, 'generate', 'done');
    }

    /* ---- review / repair loop */
    const intake = st.mode === 'generate' ? { review: true, repair: true } : ctx.registries.policy.intakeModes[st.mode];
    const canRepair = !!plan.repairer && (intake?.repair ?? false) && plan.humanGate.mode !== 'human';
    const maxCycles = plan.maxRepairCycles + (instructions ? 1 : 0);
    let cycle = resumeCycle ?? 0;
    let reviewers = intake?.review ? plan.reviewers : [];
    let carried: Finding[] =
      resumeCycle !== null ? loadStageFindings(ctx, stage).filter((f) => f.status === 'open' || f.status === 'deferred') : [];
    let outcome: ReviewOutcome = { findings: [], plan: null, lockConflicts: 0 };
    for (;;) {
      ctx.progress(`${stage}: review cycle ${cycle}${reviewers.length ? ` (${reviewers.length} reviewers)` : ' (validators)'}`);
      outcome = await reviewCycle(ctx, stage, plan, handler, cycle, reviewers, carried, extraFindings, canRepair || !!instructions);
      extraFindings = [];
      step(ctx, stage, `review#${cycle}`, 'done', { findings: outcome.findings.length, actions: outcome.plan?.actions.length ?? 0 });
      if (outcome.lockConflicts > 0) return openGate(ctx, stage, plan, 'lock_conflict', null);
      const actions = outcome.plan?.actions ?? [];
      const structural = stage === 'COURSE_QA' && cycle === (resumeCycle ?? 0) && needsStructuralRebuild(ctx);
      if (structural) {
        // Imported HTML: the reviewed original is rebuilt through CourseForge components (with any approved
        // content repairs applied to the reconstructed storyboard first), then fully re-reviewed.
        transitionStage(ctx.dir, ctx.state, stage, 'repair', ctx.now(), ctx.runId);
        ctx.progress(`${stage}: rebuilding the imported course through CourseForge components`);
        const produced: Produced[] = [];
        let rebuilt = false;
        if (actions.length && canRepair) {
          const rep = await repair(ctx, stage, plan, handler, outcome.plan as RepairPlan, cycle);
          produced.push(...rep.produced);
          rebuilt = rep.applied.length > 0;
        }
        if (!rebuilt) produced.push(...((await handler.afterRepair?.(ctx, plan, cycle)) ?? []));
        register(ctx, plan, produced, 'qa-repaired', false);
        producedNew = true;
        step(ctx, stage, `rebuild#${cycle}`, 'done');
        transitionStage(ctx.dir, ctx.state, stage, 'repaired', ctx.now(), ctx.runId);
        reviewers = plan.reviewers;
        carried = [];
        cycle++;
        st.cyclesUsed = cycle;
        save(ctx);
        continue;
      }
      if (!actions.length || !(canRepair || instructions)) break;
      if (cycle >= maxCycles) {
        if (carryToRelease(ctx, stage)) break;
        if (plan.onCapReached === 'human') return openGate(ctx, stage, plan, 'cycle_cap', null);
        throw new CfError('CYCLE_CAP', `${stage}: ${actions.length} actionable findings remain after ${cycle} repair cycles`, {
          kind: 'cycle_cap',
          exitCode: 11,
        });
      }
      transitionStage(ctx.dir, ctx.state, stage, 'repair', ctx.now(), ctx.runId);
      ctx.progress(`${stage}: repairing ${actions.length} target(s)`);
      const rep = await repair(ctx, stage, plan, handler, outcome.plan as RepairPlan, cycle);
      if (rep.produced.length) {
        register(ctx, plan, rep.produced, 'repaired', true);
        producedNew = true;
      }
      step(ctx, stage, `repair#${cycle}`, 'done', { applied: rep.applied });
      transitionStage(ctx.dir, ctx.state, stage, 'repaired', ctx.now(), ctx.runId);
      // Rerun reviewers whose findings were actioned plus those mapped to the touched categories.
      const actioned = new Set(actions.flatMap((a) => a.findingIds));
      const touched = new Set(actions.map((a) => a.category));
      const rerun = new Set<string>();
      for (const f of outcome.findings) if (actioned.has(f.findingId) && f.source === 'reviewer') rerun.add(f.reviewer);
      for (const c of touched) for (const r of plan.rerunMap[c] ?? []) rerun.add(r);
      reviewers = plan.reviewers.filter((r) => rerun.has(r.subject ?? ''));
      carried = outcome.findings
        .filter((f) => f.source === 'reviewer' && !rerun.has(f.reviewer) && !actioned.has(f.findingId))
        .map((f) => ({ ...f, cycle: cycle + 1 }));
      if (!rep.applied.length) {
        // Nothing could be applied: stop looping and let the gate decide.
        break;
      }
      cycle++;
      st.cyclesUsed = cycle;
      save(ctx);
    }

    if (producedNew) invalidateDownstream(ctx, stage);

    /* ---- gate */
    const blocking = outcome.findings.filter(
      (f) =>
        ctx.registries.policy.releaseBlockingSeverities.includes(f.severity) &&
        (f.status === 'open' || f.status === 'accepted' || f.status === 'deferred'),
    );
    saveStageFindings(ctx, stage, outcome.findings);
    const gateMode = plan.humanGate.mode;
    if (gateMode === 'auto') {
      if (!blocking.length) return lockStage(ctx, stage, false);
      if (carryToRelease(ctx, stage)) {
        ctx.progress(`${stage}: ${blocking.length} unresolved finding(s) carried to the release sign-off`);
        return lockStage(ctx, stage, false);
      }
      if (plan.onCapReached === 'human' || stage === 'RELEASE') return openGate(ctx, stage, plan, 'validator_failed', null);
      throw new CfError('BLOCKING_FINDINGS', `${stage}: ${blocking.length} blocking finding(s) remain`, {
        kind: 'validator_failed',
        exitCode: 11,
      });
    }
    return openGate(
      ctx,
      stage,
      plan,
      plan.humanGate.source === 'risk-floor' ? 'high_stakes' : blocking.length ? 'validator_failed' : 'policy',
      null,
    );
  } catch (err) {
    const kind = err instanceof CfError && err.kind ? err.kind : 'internal';
    const cur = ctx.state.stages[stage].status;
    if (cur !== 'FAILED' && cur !== 'LOCKED' && cur !== 'WAITING_FOR_HUMAN') {
      try {
        transitionStage(ctx.dir, ctx.state, stage, 'fail', ctx.now(), ctx.runId);
      } catch {
        ctx.state.stages[stage].status = 'FAILED';
      }
    }
    ctx.state.stages[stage].failure = { kind, message: errorMessage(err).slice(0, 2000), at: ctx.now() };
    save(ctx);
    logEvent(ctx.dir, {
      ts: ctx.now(),
      runId: ctx.runId,
      stage,
      event: 'stage.failed',
      status: kind,
      detail: { message: errorMessage(err).slice(0, 2000) },
    });
    ctx.progress(`${stage}: FAILED (${kind}) — ${errorMessage(err)}`);
    if (process.env.COURSEFORGE_DEBUG) console.error(err);
    return 'failed';
  }
}
