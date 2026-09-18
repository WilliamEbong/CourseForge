/**
 * Opens a run context (harness selection, registries, lock) and drives stages from → to.
 */
import { detectDrift, registerArtifact } from '../artifacts/index.js';
import {
  type BackendPreference,
  EXIT,
  type GateMode,
  type HarnessName,
  HarnessNameSchema,
  STAGES,
  type Stage,
  stageIndex,
} from '../core/enums.js';
import { acquireLock } from '../core/fsx.js';
import { repoRoot } from '../core/paths.js';
import { createHarness, probeAll } from '../harness/factory.js';
import type { AgentHarness, HarnessProbe } from '../harness/types.js';
import { selectBackend } from '../routing/backend.js';
import { loadRegistries } from '../routing/registries.js';
import type { RunOutcome } from './api.js';
import { makeRunId, type RunContext, systemClock } from './context.js';
import { runStage, type StageResult } from './run-stage.js';
import { loadManifest, loadState, logDecisions, logEvent, requireCourse, saveState, transitionStage } from './store.js';
import { stageRange } from './transitions.js';

export interface OpenOptions {
  courseId: string;
  backend?: BackendPreference;
  harness?: HarnessName;
  gate?: GateMode;
  progress?: (msg: string) => void;
  now?: () => string;
}

/** Harness used when no backend is available: every task fails with a clear, classified error. */
class UnavailableHarness implements AgentHarness {
  readonly name = 'claude' as const;
  constructor(private readonly reason: string) {}
  async probe(): Promise<HarnessProbe> {
    return { name: 'claude', available: false, version: null, authenticated: false, flags: [], detail: this.reason };
  }
  async run() {
    return {
      ok: false,
      output: null,
      failure: {
        class: 'unavailable' as const,
        message: `No agent backend available: ${this.reason}. Install/authenticate Claude Code or Codex, or use --harness fake for offline demos.`,
        retryable: false,
      },
      backend: 'claude' as const,
      backendVersion: null,
      model: null,
      usage: null,
      durationMs: 0,
      toolsUsed: null,
      promptHash: '',
      rawLogPath: null,
    };
  }
}

export async function openContext(opts: OpenOptions): Promise<RunContext> {
  const dir = requireCourse(opts.courseId);
  const manifest = loadManifest(dir);
  const state = loadState(dir);
  const registries = loadRegistries();
  const now = opts.now ?? systemClock();
  const runId = makeRunId(now());
  const envHarness = process.env.COURSEFORGE_HARNESS ? HarnessNameSchema.parse(process.env.COURSEFORGE_HARNESS) : undefined;
  const forced = opts.harness ?? envHarness;
  const pref = opts.backend ?? manifest.pipeline.agent_backend;
  const probes: Partial<Record<'claude' | 'codex', HarnessProbe>> = forced === 'fake' ? {} : await probeAll();
  const sel = selectBackend(pref, probes, registries.fallbacks, forced, manifest.pipeline.backend_fallback);
  const harness: AgentHarness =
    sel.selected === 'none' ? new UnavailableHarness(sel.reason ?? 'no backend selected') : createHarness(sel.selected);
  logDecisions(dir, [
    {
      ts: now(),
      runId,
      planId: null,
      stage: null,
      kind: 'backend',
      subject: 'run',
      input: `${pref}${forced ? ` (forced ${forced})` : ''}`,
      selected: sel.selected,
      rule: sel.rule,
      fallback: sel.rule.includes('FALLBACK'),
      reason: sel.reason ?? null,
    },
  ]);
  return {
    courseId: opts.courseId,
    dir,
    repo: repoRoot(),
    manifest,
    state,
    registries,
    harness,
    harnessName: sel.selected === 'none' ? 'claude' : sel.selected,
    probes,
    runId,
    backendPref: pref,
    cliGate: opts.gate,
    now,
    stage: null,
    progress: opts.progress ?? (() => {}),
  };
}

/** Human edits made directly to canonical files become new `human-edited` versions and re-enter validation. */
export function handleDrift(ctx: RunContext): Stage | null {
  let earliest: Stage | null = null;
  for (const { record, currentHash } of detectDrift(ctx.dir)) {
    if (!currentHash) {
      logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage: record.stage, event: 'artifact.missing', detail: { path: record.path } });
      continue;
    }
    registerArtifact(ctx.dir, {
      stage: record.stage,
      path: record.path,
      logicalKey: record.logicalKey,
      producer: { kind: 'human' },
      parents: [record.artifactId],
      event: 'human-edited',
      humanModified: true,
      now: ctx.now(),
    });
    logEvent(ctx.dir, {
      ts: ctx.now(),
      runId: ctx.runId,
      stage: record.stage,
      event: 'artifact.human_edit',
      detail: { path: record.path },
    });
    const st = ctx.state.stages[record.stage];
    if (st.status === 'LOCKED' || st.status === 'FAILED' || st.status === 'SUPERSEDED') {
      transitionStage(ctx.dir, ctx.state, record.stage, 'ingest', ctx.now(), ctx.runId);
      st.mode = 'preserve';
    }
    if (!earliest || stageIndex(record.stage) < stageIndex(earliest)) earliest = record.stage;
  }
  if (earliest) saveState(ctx.dir, ctx.state, ctx.now());
  return earliest;
}

/** First stage that still needs work, given what has been imported/locked so far. */
export function defaultFromStage(ctx: Pick<RunContext, 'state' | 'manifest'>): Stage {
  const touched = STAGES.filter((s) => ctx.state.stages[s].status !== 'NOT_STARTED');
  if (!touched.length) return ctx.manifest.pipeline.start_stage;
  const pending = touched.find((s) => ctx.state.stages[s].status !== 'LOCKED');
  if (pending) return pending;
  const last = touched[touched.length - 1] as Stage;
  return STAGES[Math.min(stageIndex(last) + 1, STAGES.length - 1)] as Stage;
}

export function outcomeFor(ctx: RunContext, result: StageResult | 'completed', stoppedAt: Stage | null, message: string): RunOutcome {
  const status = result === 'locked' || result === 'completed' ? 'completed' : result;
  const exitCode =
    status === 'completed'
      ? EXIT.OK
      : status === 'waiting'
        ? EXIT.WAITING_FOR_HUMAN
        : status === 'blocked'
          ? EXIT.BLOCKED
          : EXIT.STAGE_FAILED;
  return {
    courseId: ctx.courseId,
    runId: ctx.runId,
    status,
    stoppedAt,
    stages: STAGES.map((s) => ({ stage: s, status: ctx.state.stages[s].status })),
    message,
    exitCode,
  };
}

export async function runRange(ctx: RunContext, from: Stage, to: Stage, opts: { force?: boolean } = {}): Promise<RunOutcome> {
  const release = acquireLock(ctx.dir, `run ${from}->${to}`, (prev) =>
    logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage: null, event: 'lock.stolen', detail: { ...prev } }),
  );
  try {
    const drifted = handleDrift(ctx);
    const start = drifted && stageIndex(drifted) < stageIndex(from) ? drifted : from;
    const stages = stageRange(start, to);
    ctx.state.activeRunId = ctx.runId;
    ctx.state.targetStage = to;
    saveState(ctx.dir, ctx.state, ctx.now());
    logEvent(ctx.dir, {
      ts: ctx.now(),
      runId: ctx.runId,
      stage: null,
      event: 'run.start',
      detail: { from: start, to, harness: ctx.harnessName },
    });
    ctx.progress(`run ${ctx.runId}: ${start} → ${to} (backend: ${ctx.harnessName})`);
    for (const stage of stages) {
      const result = await runStage(ctx, stage, { startStage: start, targetStage: to, force: opts.force && stage === start });
      if (result !== 'locked') {
        const st = ctx.state.stages[stage];
        const msg =
          result === 'waiting'
            ? `${stage} is waiting for human review (${st.gate?.reason ?? 'policy'}). Review, then: courseforge gate approve --course ${ctx.courseId} --stage ${stage.toLowerCase()} && courseforge continue --course ${ctx.courseId}`
            : result === 'blocked'
              ? `Release blocked: see ${ctx.courseId}/release/release-decision.json and the QA findings.`
              : `${stage} failed: ${st.failure?.message ?? 'unknown error'}`;
        logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage, event: 'run.end', status: result });
        return outcomeFor(ctx, result, stage, msg);
      }
    }
    logEvent(ctx.dir, { ts: ctx.now(), runId: ctx.runId, stage: to, event: 'run.end', status: 'completed' });
    return outcomeFor(ctx, 'completed', to, `Completed through ${to}.`);
  } finally {
    ctx.state.activeRunId = null;
    saveState(ctx.dir, ctx.state, ctx.now());
    release();
  }
}
