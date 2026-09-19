import { GATE_STRICTNESS, type GateMode, type RiskTier, type Stage } from '../core/enums.js';
import type { CourseManifest, ReviewPolicy, StageDef } from '../core/schemas/index.js';

export type GateSource = 'policy' | 'stage-default' | 'course' | 'risk-floor' | 'cli' | 'review-level';

export interface GateContext {
  policy: ReviewPolicy;
  stageDef: StageDef;
  manifest: CourseManifest;
  riskTier: RiskTier;
  cli?: GateMode | null;
}

const stricter = (a: GateMode, b: GateMode) => GATE_STRICTNESS[a] > GATE_STRICTNESS[b];

/**
 * Effective human-gate mode = strictest of stage default, policy default, course.yaml and the risk floor.
 * A CLI override applies last; it may lower the gate, but never below the risk floor unless the course
 * records `risk_override: acknowledged` (which also drops the floor from the combination).
 */
export function effectiveGate(stage: Stage, ctx: GateContext): { mode: GateMode; source: GateSource } {
  const level = ctx.manifest.pipeline.review_level;
  // One-shot: the author chose to be asked once, before release (ADR 0014). A CLI override still applies.
  if (level === 'one_shot' && !ctx.cli) return { mode: stage === 'RELEASE' ? 'human' : 'auto', source: 'review-level' };
  const acknowledged = ctx.manifest.course.risk_override === 'acknowledged';
  const floor = acknowledged ? undefined : ctx.policy.riskFloors[ctx.riskTier]?.[stage];
  const candidates: [GateSource, GateMode | undefined][] = [
    ['policy', ctx.policy.gateDefaults[stage]],
    ['course', ctx.manifest.human_review[stage]],
    ['risk-floor', floor],
    ['review-level', level === 'every_step' || level === 'strict' ? 'human' : undefined],
  ];
  let best: { mode: GateMode; source: GateSource } = { mode: ctx.stageDef.gateDefault, source: 'stage-default' };
  for (const [source, mode] of candidates) if (mode && stricter(mode, best.mode)) best = { mode, source };

  if (ctx.cli) {
    if (floor && stricter(floor, ctx.cli)) return { mode: floor, source: 'risk-floor' };
    return { mode: ctx.cli, source: 'cli' };
  }
  return best;
}
