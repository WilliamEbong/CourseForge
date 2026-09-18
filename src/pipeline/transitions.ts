/**
 * Stage status state machine (spec 02) and stage-range legality. Pure.
 */
import { STAGES, type Stage, type StageStatus, stageIndex } from '../core/enums.js';
import { IllegalTransitionError } from '../core/errors.js';

export type Trigger =
  | 'ingest'
  | 'start'
  | 'inputs-valid-generate'
  | 'inputs-valid-review'
  | 'generated'
  | 'repair'
  | 'repaired'
  | 'approve'
  | 'wait-human'
  | 'human-approve'
  | 'human-rereview'
  | 'human-repair'
  | 'human-abort'
  | 'lock'
  | 'upstream-changed'
  | 'upstream-changed-human'
  | 'fail'
  | 'reset';

/** from → allowed (trigger → to). `*` rows apply to any in-flight status. */
const TABLE: Record<StageStatus, Partial<Record<Trigger, StageStatus>>> = {
  NOT_STARTED: { ingest: 'INGESTED', start: 'VALIDATING' },
  INGESTED: { start: 'VALIDATING', ingest: 'INGESTED' },
  VALIDATING: {
    'inputs-valid-generate': 'GENERATING',
    'inputs-valid-review': 'REVIEWING',
    'wait-human': 'WAITING_FOR_HUMAN',
    fail: 'FAILED',
  },
  GENERATING: { generated: 'REVIEWING', fail: 'FAILED', 'wait-human': 'WAITING_FOR_HUMAN' },
  REVIEWING: { repair: 'REPAIRING', approve: 'APPROVED', 'wait-human': 'WAITING_FOR_HUMAN', fail: 'FAILED' },
  REPAIRING: { repaired: 'REVIEWING', fail: 'FAILED', 'wait-human': 'WAITING_FOR_HUMAN' },
  WAITING_FOR_HUMAN: {
    'human-approve': 'APPROVED',
    'human-rereview': 'REVIEWING',
    'human-repair': 'REPAIRING',
    'human-abort': 'FAILED',
    ingest: 'INGESTED',
    start: 'VALIDATING',
  },
  APPROVED: { lock: 'LOCKED' },
  LOCKED: {
    'upstream-changed': 'SUPERSEDED',
    'upstream-changed-human': 'WAITING_FOR_HUMAN',
    ingest: 'INGESTED',
    start: 'VALIDATING',
    reset: 'NOT_STARTED',
  },
  FAILED: { start: 'VALIDATING', ingest: 'INGESTED', reset: 'NOT_STARTED' },
  SUPERSEDED: { start: 'VALIDATING', ingest: 'INGESTED', reset: 'NOT_STARTED' },
};

export const IN_FLIGHT: ReadonlySet<StageStatus> = new Set(['VALIDATING', 'GENERATING', 'REVIEWING', 'REPAIRING']);

export function nextStatus(from: StageStatus, trigger: Trigger): StageStatus {
  const to = TABLE[from][trigger];
  if (!to) throw new IllegalTransitionError(`Illegal stage transition: ${from} --${trigger}--> ?`, { from, trigger });
  return to;
}

export function canTransition(from: StageStatus, trigger: Trigger): boolean {
  return TABLE[from][trigger] !== undefined;
}

/** All (from, trigger, to) triples — used by tests and docs. */
export function transitionTable(): { from: StageStatus; trigger: Trigger; to: StageStatus }[] {
  const out: { from: StageStatus; trigger: Trigger; to: StageStatus }[] = [];
  for (const [from, row] of Object.entries(TABLE) as [StageStatus, Partial<Record<Trigger, StageStatus>>][]) {
    for (const [trigger, to] of Object.entries(row) as [Trigger, StageStatus][]) out.push({ from, trigger, to });
  }
  return out;
}

/** Stages from `from` to `to` inclusive; throws if `to` precedes `from`. */
export function stageRange(from: Stage, to: Stage): Stage[] {
  const a = stageIndex(from);
  const b = stageIndex(to);
  if (b < a) throw new IllegalTransitionError(`Target stage ${to} precedes start stage ${from}`, { from, to });
  return STAGES.slice(a, b + 1);
}

export function isDone(status: StageStatus): boolean {
  return status === 'LOCKED';
}
