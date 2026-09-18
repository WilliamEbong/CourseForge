/**
 * `resolveExecutionPlan` — the deterministic router (spec 05). Pure: no filesystem, no clock, no randomness.
 * The same input always yields a deep-equal plan; every routing choice is recorded in `decisions`.
 *
 * Path convention: all TaskSpec / plan paths are repo-relative (`<courseRelRoot>/<course-relative path>`);
 * `plan.inputs` is passed through as given.
 */
import {
  type BackendName,
  type BackendPreference,
  type GateMode,
  type HarnessName,
  type IntakeMode,
  type RiskTier,
  STAGE_CODES,
  type Stage,
  StageSchema,
  VisualArchetypeSchema,
} from '../core/enums.js';
import { RoutingError } from '../core/errors.js';
import type { CourseManifest, ExecutionPlan, RoutingDecision, StageDef, TaskSpec, WriteMode } from '../core/schemas/index.js';
import type { HarnessProbe } from '../harness/types.js';
import { selectBackend } from './backend.js';
import { effectiveGate } from './gates.js';
import type { Registries } from './registries.js';
import { routeVisual, type VisualRouteInput } from './visual.js';

export interface PlanInput {
  courseId: string;
  runId: string;
  stage: Stage;
  revision: number;
  supersedes: string | null;
  /** ISO timestamp supplied by the caller (keeps the router pure). */
  now: string;
  mode: 'generate' | IntakeMode;
  startStage: Stage;
  targetStage: Stage;
  fromStatus: string;
  registries: Registries;
  manifest: CourseManifest;
  riskTier: RiskTier;
  probes: Partial<Record<BackendName, HarnessProbe>>;
  forcedHarness?: HarnessName;
  overrides: { backend?: BackendPreference; gate?: GateMode };
  inputs: { artifactId: string | null; path: string; hash: string | null; required: boolean }[];
  fanOutKeys: string[];
  visuals: VisualRouteInput[];
  /** Repo-relative course folder, e.g. `courses/<id>`. */
  courseRelRoot: string;
}

const READ_ONLY_TOOLS = ['read', 'grep', 'glob'];
const uniq = (xs: string[]) => [...new Set(xs)];

export function planIdFor(runId: string, stage: Stage, revision: number): string {
  return `PLAN-${runId}-${STAGE_CODES[stage]}-r${revision}`;
}

export function resolveExecutionPlan(input: PlanInput): ExecutionPlan {
  const stageParse = StageSchema.safeParse(input.stage);
  if (!stageParse.success) throw new RoutingError(`Unknown stage "${String(input.stage)}"`);
  const stage = stageParse.data;
  const reg = input.registries;
  const def: StageDef | undefined = reg.stages.stages[stage];
  const route = reg.routing.stageRoutes[stage];
  if (!def || !route) throw new RoutingError(`Stage ${stage} is not in the stage registry`);
  const intake = input.mode === 'generate' ? { generate: true, review: true, repair: true } : reg.policy.intakeModes[input.mode];
  if (!intake) throw new RoutingError(`Unknown mode "${input.mode}"`);

  const planId = planIdFor(input.runId, stage, input.revision);
  const root = input.courseRelRoot.replace(/\/+$/, '');
  const expand = (t: string) => t.replaceAll('{course}', root);
  const inCourse = (p: string) => `${root}/${p}`;
  const decisions: RoutingDecision[] = [];
  const decide = (d: Omit<RoutingDecision, 'ts' | 'runId' | 'planId' | 'stage' | 'fallback'> & { fallback?: boolean }) =>
    decisions.push({ ts: input.now, runId: input.runId, planId, stage, fallback: false, ...d });

  const agentToolsFor = (tools: string[]) => {
    const out: string[] = [];
    for (const t of tools) {
      const def = reg.tools.tools[t];
      if (!def) throw new RoutingError(`Unknown tool "${t}"`);
      out.push(...def.agentTools);
    }
    return uniq(out);
  };
  const readOnlyPaths = uniq([...def.readOnly, ...def.writable].map(expand));
  const writablePaths = def.writable.map(expand);
  const inputPaths = input.inputs.map((i) => inCourse(i.path));
  const base = { readOnlyPaths, timeoutSec: def.limits.taskTimeoutSec, maxTurns: def.limits.maxTurns };
  const task = (
    t: Omit<TaskSpec, 'agentTools' | 'readOnlyPaths' | 'timeoutSec' | 'maxTurns' | 'writablePaths'> & { writeMode: WriteMode },
  ): TaskSpec => ({
    ...t,
    ...base,
    agentTools: agentToolsFor(t.tools),
    writablePaths: t.writeMode === 'artifact-write' ? writablePaths : [],
  });

  decide({
    kind: 'stage',
    subject: stage,
    input: `${input.fromStatus}:${input.mode}:${input.startStage}->${input.targetStage}`,
    selected: def.kind,
    rule: route.rule,
    reason: null,
  });

  /* backend */
  const requested = input.overrides.backend ?? input.manifest.pipeline.agent_backend;
  const backend = selectBackend(requested, input.probes, reg.fallbacks, input.forcedHarness, input.manifest.pipeline.backend_fallback);
  decide({
    kind: 'backend',
    subject: 'backend',
    input: requested,
    selected: backend.selected,
    rule: backend.rule,
    fallback: backend.rule === 'BACKEND-FALLBACK-001',
    reason: backend.reason,
  });

  /* gate */
  const gate = effectiveGate(stage, {
    policy: reg.policy,
    stageDef: def,
    manifest: input.manifest,
    riskTier: input.riskTier,
    cli: input.overrides.gate ?? null,
  });
  decide({
    kind: 'gate',
    subject: stage,
    input: `risk=${input.riskTier};override=${input.manifest.course.risk_override ?? 'none'};cli=${input.overrides.gate ?? 'none'}`,
    selected: gate.mode,
    rule: `GATE-${gate.source.toUpperCase()}-001`,
    reason: null,
  });

  /* generator */
  const g = def.generator;
  const generator =
    g && intake.generate
      ? task({
          taskId: `${planId}:gen`,
          role: g.role,
          promptTemplate: g.promptTemplate,
          subject: null,
          rubric: null,
          skills: g.skills,
          tools: g.tools,
          inputPaths,
          outputSchema: g.outputSchema,
          writeMode: g.writeMode,
          network: g.network,
        })
      : null;

  /* reviewers */
  const reviewers: TaskSpec[] = [];
  for (const id of def.reviewers) {
    const r = reg.reviewers.reviewers[id];
    if (!r) throw new RoutingError(`Stage ${stage} references unknown reviewer "${id}"`);
    const skipReason = !r.enabled ? 'disabled in reviewers.json' : !intake.review ? `mode ${input.mode} does not review` : null;
    decide({
      kind: 'reviewer',
      subject: id,
      input: stage,
      selected: skipReason ? 'skipped' : 'enabled',
      rule: route.rule,
      reason: skipReason,
    });
    if (skipReason) continue;
    reviewers.push(
      task({
        taskId: `${planId}:rev:${id}`,
        role: 'reviewer',
        promptTemplate: r.promptTemplate,
        subject: id,
        rubric: r.rubric,
        skills: r.skills,
        tools: r.tools,
        inputPaths: r.inputs.map(inCourse),
        outputSchema: 'finding-set',
        writeMode: 'findings-only',
        network: r.network,
      }),
    );
  }

  /* adjudicator / repairer get read-only tools already present in the stage bundle (never widen it) */
  const bundleTools = uniq([...(g?.tools ?? []), ...def.reviewers.flatMap((id) => reg.reviewers.reviewers[id]?.tools ?? [])]);
  const readTools = READ_ONLY_TOOLS.filter((t) => bundleTools.includes(t));
  const adjudicator =
    reviewers.length > 0
      ? task({
          taskId: `${planId}:adj`,
          role: 'adjudicator',
          promptTemplate: 'adjudicate',
          subject: null,
          rubric: null,
          skills: [],
          tools: readTools,
          inputPaths,
          outputSchema: 'adjudication',
          writeMode: 'structured',
          network: false,
        })
      : null;
  const repairer =
    def.repairer && intake.repair && reviewers.length > 0
      ? task({
          taskId: `${planId}:repair`,
          role: def.repairer.role,
          promptTemplate: def.repairer.promptTemplate,
          subject: null,
          rubric: null,
          skills: g?.skills ?? [],
          tools: readTools,
          inputPaths,
          outputSchema: def.repairer.outputSchema,
          writeMode: 'structured',
          network: false,
        })
      : null;

  const tasks = [generator, ...reviewers, adjudicator, repairer].filter((t): t is TaskSpec => t !== null);
  const skills = uniq(tasks.flatMap((t) => t.skills)).sort();
  const tools = uniq(tasks.flatMap((t) => t.tools)).sort();
  decide({ kind: 'skill', subject: 'skills', input: stage, selected: skills.join(',') || '(none)', rule: route.rule, reason: null });
  decide({ kind: 'tool', subject: 'tools', input: stage, selected: tools.join(',') || '(none)', rule: route.rule, reason: null });

  /* visuals */
  const visualRoutes: ExecutionPlan['visualRoutes'] = [];
  for (const v of input.visuals) {
    const r = routeVisual(v, reg.routing, reg.tools);
    visualRoutes.push({ visualId: v.id, archetype: VisualArchetypeSchema.parse(v.archetype), ...r });
    decide({
      kind: 'visual',
      subject: v.id,
      input: `${v.archetype}/${v.interaction ?? 'none'}${v.rendererOverride ? `/override=${v.rendererOverride}` : ''}`,
      selected: [r.renderer, ...r.fallbacks].join('>'),
      rule: r.rule,
      reason: null,
    });
  }

  return {
    schemaVersion: 1,
    planId,
    runId: input.runId,
    courseId: input.courseId,
    stage,
    revision: input.revision,
    supersedes: input.supersedes,
    createdAt: input.now,
    transition: { fromStatus: input.fromStatus, startStage: input.startStage, targetStage: input.targetStage },
    mode: input.mode,
    backend: { requested, selected: backend.selected, version: backend.version, rule: backend.rule },
    inputs: input.inputs.map((i) => ({ ...i })),
    generator,
    generatorFanOut: generator && g?.fanOut !== 'none' ? [...input.fanOutKeys] : [],
    compiler: def.compiler,
    validators: [...def.validators],
    reviewers,
    reviewConcurrency: reg.fallbacks.concurrency.reviewers,
    rerunMap: structuredClone(def.rerunMap),
    adjudicator,
    repairer,
    skills,
    tools,
    visualRoutes,
    fallbacks: structuredClone(reg.fallbacks),
    humanGate: gate,
    maxRepairCycles: input.manifest.pipeline.max_repair_cycles ?? reg.policy.perStageMaxRepairCycles[stage] ?? reg.policy.maxRepairCycles,
    onCapReached: reg.policy.onCapReached,
    repairSeverities: [...reg.policy.repairSeverities],
    writablePaths,
    readOnlyPaths,
    expectedOutputs: def.outputs.map(inCourse),
    limits: { ...def.limits },
    decisions,
    registryHashes: { ...reg.hashes },
  };
}
