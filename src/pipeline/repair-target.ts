/**
 * Scoped, ID-addressed repair of JSON artifacts. A repair agent can only replace whole objects that are
 * (a) targets of the approved repair plan, (b) not locked, and (c) valid against the object's schema.
 * Anything else is rejected and reported — this is what keeps repairs from rewriting unrelated content.
 */
import type { z } from 'zod';
import type { RepairPlan, RepairResult } from '../core/schemas/index.js';

export interface ObjectSlot {
  container: unknown[];
  index: number;
  /** Property name of the array holding the object (e.g. `blocks`, `visuals`). */
  key: string;
}

const ID_KEYS = ['id', 'sectionId'] as const;

export function objectId(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  for (const k of ID_KEYS) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === 'string') return v;
  }
  return null;
}

/** Index every object with an `id`/`sectionId` that lives inside an array property, anywhere in the tree. */
export function indexObjects(doc: unknown): Map<string, ObjectSlot> {
  const out = new Map<string, ObjectSlot>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        val.forEach((item, index) => {
          const id = objectId(item);
          if (id && !out.has(id)) out.set(id, { container: val, index, key });
        });
      }
      walk(val);
    }
  };
  walk(doc);
  return out;
}

export interface ApplyOutcome<T> {
  doc: T;
  applied: string[];
  rejected: { targetId: string; reason: string }[];
}

/**
 * Applies a repair result to a JSON document. `schemas` maps container keys (`blocks`, `visuals`, …) to item
 * schemas; `rootSchema` enables whole-document replacement via target `global` when nothing is locked.
 */
export function applyReplacements<T>(
  doc: T,
  result: RepairResult,
  plan: RepairPlan,
  opts: { schemas: Record<string, z.ZodType>; rootSchema?: z.ZodType<T>; locked: ReadonlySet<string> },
): ApplyOutcome<T> {
  let working = structuredClone(doc);
  const applied: string[] = [];
  const rejected: { targetId: string; reason: string }[] = [];
  const targets = new Map(plan.actions.map((a) => [a.targetId, a]));
  const actionIds = new Set(plan.actions.map((a) => a.actionId));
  for (const r of result.replacements) {
    const action = targets.get(r.targetId);
    if (!action) {
      rejected.push({ targetId: r.targetId, reason: 'not a target of the approved repair plan' });
      continue;
    }
    if (r.actionIds.some((a) => !actionIds.has(a))) {
      rejected.push({ targetId: r.targetId, reason: 'references unknown repair actions' });
      continue;
    }
    if (opts.locked.has(r.targetId)) {
      rejected.push({ targetId: r.targetId, reason: 'target is locked' });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.objectJson);
    } catch {
      rejected.push({ targetId: r.targetId, reason: 'objectJson is not valid JSON' });
      continue;
    }
    if (r.targetId === 'global') {
      if (!opts.rootSchema || opts.locked.size > 0) {
        rejected.push({ targetId: r.targetId, reason: 'whole-artifact replacement not allowed here' });
        continue;
      }
      const res = opts.rootSchema.safeParse(parsed);
      if (!res.success) {
        rejected.push({ targetId: r.targetId, reason: `invalid document: ${res.error.issues[0]?.message ?? 'schema'}` });
        continue;
      }
      working = res.data;
      applied.push(r.targetId);
      continue;
    }
    const slots = indexObjects(working);
    const slot = slots.get(r.targetId);
    if (!slot) {
      rejected.push({ targetId: r.targetId, reason: 'target id not found in artifact' });
      continue;
    }
    if (objectId(parsed) !== r.targetId) {
      rejected.push({ targetId: r.targetId, reason: 'replacement object changes the id' });
      continue;
    }
    const schema = opts.schemas[slot.key];
    if (!schema) {
      rejected.push({ targetId: r.targetId, reason: `objects under "${slot.key}" are not repairable` });
      continue;
    }
    const res = schema.safeParse(parsed);
    if (!res.success) {
      rejected.push({
        targetId: r.targetId,
        reason: `schema: ${res.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join('; ')}`,
      });
      continue;
    }
    // A replaced container object must not smuggle changes to locked descendants.
    const lockedInside = [...indexObjects(slot.container[slot.index])].filter(([id]) => opts.locked.has(id));
    const changedLocked = lockedInside.filter(([id, s]) => {
      const after = indexObjects(res.data).get(id);
      return !after || JSON.stringify(after.container[after.index]) !== JSON.stringify(s.container[s.index]);
    });
    if (changedLocked.length) {
      rejected.push({ targetId: r.targetId, reason: `would modify locked content (${changedLocked.map(([id]) => id).join(', ')})` });
      continue;
    }
    slot.container[slot.index] = res.data;
    applied.push(r.targetId);
  }
  return { doc: working, applied, rejected };
}

/** Current objects for plan targets, passed to the repair agent as context. */
export function targetObjects(doc: unknown, plan: RepairPlan): Record<string, unknown> {
  const slots = indexObjects(doc);
  const out: Record<string, unknown> = {};
  for (const a of plan.actions) {
    const s = slots.get(a.targetId);
    if (s) out[a.targetId] = s.container[s.index];
    else if (a.targetId === 'global') out.global = doc;
  }
  return out;
}
