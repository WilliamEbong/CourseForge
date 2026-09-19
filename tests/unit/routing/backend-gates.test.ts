import { describe, expect, it } from 'vitest';
import { type GateMode, STAGES, type Stage } from '../../../src/core/enums.js';
import { selectBackend } from '../../../src/routing/backend.js';
import { effectiveGate } from '../../../src/routing/gates.js';
import { resolveExecutionPlan } from '../../../src/routing/plan.js';
import { manifest, planInput, probe, registries } from './helpers.js';

const cfg = registries.fallbacks;
const withFallback = { ...cfg, backend: { ...cfg.backend, enabled: true } };

describe('backend selection @B4', () => {
  it('auto picks the first usable backend in configured order', () => {
    expect(selectBackend('auto', { claude: probe('claude'), codex: probe('codex') }, cfg)).toMatchObject({
      selected: 'claude',
      rule: 'BACKEND-AUTO-001',
    });
    expect(selectBackend('auto', { claude: probe('claude', true, false), codex: probe('codex') }, cfg)).toMatchObject({
      selected: 'codex',
      version: 'codex-1.0.0',
      rule: 'BACKEND-AUTO-001',
    });
    // 'unknown' auth is still usable
    expect(selectBackend('auto', { claude: probe('claude', true, 'unknown') }, cfg).selected).toBe('claude');
  });

  it('auto with nothing usable selects none', () => {
    expect(selectBackend('auto', { claude: probe('claude', false) }, cfg)).toMatchObject({ selected: 'none', rule: 'BACKEND-NONE-001' });
  });

  it('explicit preference is honoured', () => {
    expect(selectBackend('codex', { claude: probe('claude'), codex: probe('codex') }, cfg)).toMatchObject({
      selected: 'codex',
      rule: 'BACKEND-EXPLICIT-001',
    });
  });

  it('explicit unavailable: fallback only when registry AND course allow it', () => {
    const probes = { claude: probe('claude', false), codex: probe('codex') };
    expect(selectBackend('claude', probes, cfg, undefined, true)).toMatchObject({ selected: 'none', rule: 'BACKEND-NONE-001' });
    expect(selectBackend('claude', probes, withFallback, undefined, false)).toMatchObject({ selected: 'none', rule: 'BACKEND-NONE-001' });
    const fb = selectBackend('claude', probes, withFallback, undefined, true);
    expect(fb).toMatchObject({ selected: 'codex', rule: 'BACKEND-FALLBACK-001' });
    expect(fb.reason).toContain('claude unavailable');
  });

  it('forced harness wins over everything', () => {
    expect(selectBackend('claude', {}, cfg, 'fake')).toMatchObject({ selected: 'fake', version: null, rule: 'BACKEND-FORCED-001' });
  });

  it('plan records a fallback decision with fallback=true', () => {
    const reg = { ...registries, fallbacks: withFallback };
    const p = resolveExecutionPlan(
      planInput('CONCEPT', {
        registries: reg,
        manifest: manifest({ pipeline: { agent_backend: 'claude', backend_fallback: true } }),
        probes: { claude: probe('claude', false), codex: probe('codex') },
      }),
    );
    expect(p.backend).toEqual({ requested: 'claude', selected: 'codex', version: 'codex-1.0.0', rule: 'BACKEND-FALLBACK-001' });
    expect(p.decisions.find((d) => d.kind === 'backend')?.fallback).toBe(true);
  });
});

describe('human gate strictness @B4 @C7', () => {
  const gate = (
    stage: Stage,
    opts: {
      tier?: 'standard' | 'elevated' | 'high_stakes';
      human?: Record<string, string>;
      override?: boolean;
      cli?: GateMode;
      level?: 'one_shot' | 'recommended' | 'every_step' | 'strict';
    } = {},
  ) =>
    effectiveGate(stage, {
      policy: registries.policy,
      stageDef: registries.stages.stages[stage],
      manifest: manifest({
        course: opts.override ? { risk_override: 'acknowledged' } : {},
        ...(opts.human ? { human_review: opts.human } : {}),
        ...(opts.level ? { pipeline: { review_level: opts.level } } : {}),
      }),
      riskTier: opts.tier ?? 'standard',
      cli: opts.cli ?? null,
    });

  it('defaults to the stage gateDefault', () => {
    expect(gate('CONCEPT')).toEqual({ mode: 'auto', source: 'stage-default' });
    expect(gate('STORYBOARD')).toEqual({ mode: 'hybrid', source: 'stage-default' });
  });

  it('course.yaml can only make the gate stricter (legacy "required" accepted)', () => {
    expect(gate('CONCEPT', { human: { concept: 'required' } })).toEqual({ mode: 'human', source: 'course' });
    expect(gate('STORYBOARD', { human: { storyboard: 'optional' } })).toEqual({ mode: 'hybrid', source: 'stage-default' });
  });

  it('high_stakes floors apply to research, design, storyboard, QA and release', () => {
    expect(gate('RESEARCH_DOSSIER', { tier: 'high_stakes' })).toEqual({ mode: 'hybrid', source: 'risk-floor' });
    expect(gate('COURSE_QA', { tier: 'high_stakes' })).toEqual({ mode: 'human', source: 'risk-floor' });
    expect(gate('RELEASE', { tier: 'high_stakes' })).toEqual({ mode: 'human', source: 'risk-floor' });
    expect(gate('RELEASE', { tier: 'elevated' })).toEqual({ mode: 'hybrid', source: 'risk-floor' });
    expect(gate('CONCEPT', { tier: 'high_stakes' }).mode).toBe('auto');
  });

  it('CLI can lower a gate but not below the risk floor', () => {
    expect(gate('STORYBOARD', { cli: 'auto' })).toEqual({ mode: 'auto', source: 'cli' });
    expect(gate('COURSE_QA', { tier: 'high_stakes', cli: 'auto' })).toEqual({ mode: 'human', source: 'risk-floor' });
    expect(gate('CONCEPT', { cli: 'human' })).toEqual({ mode: 'human', source: 'cli' });
  });

  it('one-shot review: no gate until one human sign-off at release, whatever the risk tier', () => {
    for (const s of STAGES.filter((x) => x !== 'RELEASE')) {
      expect(gate(s, { level: 'one_shot' })).toEqual({ mode: 'auto', source: 'review-level' });
      expect(gate(s, { level: 'one_shot', tier: 'high_stakes' })).toEqual({ mode: 'auto', source: 'review-level' });
    }
    expect(gate('RELEASE', { level: 'one_shot' })).toEqual({ mode: 'human', source: 'review-level' });
    expect(gate('RELEASE', { level: 'one_shot', tier: 'high_stakes' })).toEqual({ mode: 'human', source: 'review-level' });
    // A CLI override still applies for that run, with the usual floor.
    expect(gate('COURSE_QA', { level: 'one_shot', cli: 'human' })).toEqual({ mode: 'human', source: 'cli' });
  });

  it('every-step and strict review put a human gate on every stage', () => {
    for (const s of STAGES) {
      expect(gate(s, { level: 'every_step' }).mode).toBe('human');
      expect(gate(s, { level: 'strict' }).mode).toBe('human');
    }
    expect(gate('CONCEPT', { level: 'every_step' })).toEqual({ mode: 'human', source: 'review-level' });
  });

  it('risk_override: acknowledged drops the floor', () => {
    expect(gate('COURSE_QA', { tier: 'high_stakes', override: true })).toEqual({ mode: 'auto', source: 'stage-default' });
    expect(gate('COURSE_QA', { tier: 'high_stakes', override: true, cli: 'auto' })).toEqual({ mode: 'auto', source: 'cli' });
  });
});
