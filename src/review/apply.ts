/**
 * Scoped repair application. Model repairs replace whole objects by stable ID; HTML repairs are exact-once
 * find/replace edits. Anything outside the approved plan, touching locked content, or schema-invalid is rejected.
 */
import type { z } from 'zod';
import { hashJson } from '../core/hash.js';
import type { HtmlRepairResult, RepairPlan, RepairResult } from '../core/schemas/review.js';

type Slot = { container: Record<string, unknown> | unknown[]; key: string | number; value: Record<string, unknown> };

/** Every object in the tree whose `id` equals `id`, with its parent slot. */
function findSlots(root: unknown, id: string): Slot[] {
  const out: Slot[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) visit(node, i, node[i]);
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) visit(node as Record<string, unknown>, k, v);
    }
  };
  const visit = (container: Slot['container'], key: string | number, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && (v as { id?: unknown }).id === id) {
      out.push({ container, key, value: v as Record<string, unknown> });
    }
    walk(v);
  };
  walk(root);
  return out;
}

/** hashJson of the (first) object with each id; null when absent. */
export function lockedRegionHashes(artifact: unknown, ids: Iterable<string>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const id of [...ids].sort()) {
    const [slot] = findSlots(artifact, id);
    out[id] = slot ? hashJson(slot.value) : null;
  }
  return out;
}

export function applyRepairResult<T>(
  artifact: T,
  result: RepairResult,
  plan: RepairPlan,
  opts: { lockedIds: ReadonlySet<string>; schemaFor: (targetId: string, existing: unknown) => z.ZodType | null },
): { artifact: T; applied: string[]; rejected: { targetId: string; reason: string }[] } {
  const work = structuredClone(artifact);
  const applied: string[] = [];
  const rejected: { targetId: string; reason: string }[] = [];
  const actions = new Map(plan.actions.map((a) => [a.actionId, a]));
  const targets = new Set(plan.actions.map((a) => a.targetId));
  const seen = new Set<string>();

  for (const r of result.replacements) {
    const reject = (reason: string) => rejected.push({ targetId: r.targetId, reason });
    if (!targets.has(r.targetId)) {
      reject('target is not in the repair plan');
      continue;
    }
    if (opts.lockedIds.has(r.targetId)) {
      reject('target is locked');
      continue;
    }
    if (seen.has(r.targetId)) {
      reject('duplicate replacement for target');
      continue;
    }
    seen.add(r.targetId);
    if (r.actionIds.length === 0 || r.actionIds.some((id) => actions.get(id)?.targetId !== r.targetId)) {
      reject('actionIds do not belong to the plan for this target');
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.objectJson);
    } catch {
      reject('objectJson is not valid JSON');
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || (parsed as { id?: unknown }).id !== r.targetId) {
      reject('replacement object id does not match target');
      continue;
    }
    const slots = findSlots(work, r.targetId);
    if (slots.length !== 1) {
      reject(slots.length === 0 ? 'target not found in artifact' : 'target id is ambiguous in artifact');
      continue;
    }
    const slot = slots[0] as Slot;
    const schema = opts.schemaFor(r.targetId, slot.value);
    if (!schema) {
      reject('no schema');
      continue;
    }
    const check = schema.safeParse(parsed);
    if (!check.success) {
      reject(`schema invalid: ${check.error.issues.map((i) => `${i.path.join('.') || '<root>'} ${i.message}`).join('; ')}`);
      continue;
    }
    // Guard locked descendants/ancestors: the replacement must leave every locked region byte-identical.
    const before = lockedRegionHashes(work, opts.lockedIds);
    const put = (v: unknown) => {
      (slot.container as Record<string | number, unknown>)[slot.key] = v;
    };
    put(check.data);
    if (hashJson(lockedRegionHashes(work, opts.lockedIds)) !== hashJson(before)) {
      put(slot.value);
      reject('replacement would modify locked content');
      continue;
    }
    applied.push(r.targetId);
  }
  return { artifact: work, applied, rejected };
}

function occurrences(haystack: string, needle: string): number {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) n++;
  return n;
}

const scriptCount = (html: string) => (html.match(/<script/gi) ?? []).length;

export function applyHtmlEdits(
  html: string,
  result: HtmlRepairResult,
  plan: RepairPlan,
): { html: string; applied: string[]; rejected: { actionId: string; reason: string }[] } {
  const planned = new Set(plan.actions.map((a) => a.actionId));
  const applied: string[] = [];
  const rejected: { actionId: string; reason: string }[] = [];
  let current = html;
  for (const e of result.edits) {
    const reject = (reason: string) => rejected.push({ actionId: e.actionId, reason });
    if (!planned.has(e.actionId)) {
      reject('action is not in the repair plan');
      continue;
    }
    if (e.find === '') {
      reject('empty find');
      continue;
    }
    const n = occurrences(current, e.find);
    if (n !== 1) {
      reject(n === 0 ? 'not found' : 'ambiguous');
      continue;
    }
    const i = current.indexOf(e.find);
    const next = current.slice(0, i) + e.replace + current.slice(i + e.find.length);
    if (scriptCount(next) !== scriptCount(current)) {
      reject('edit changes the number of <script> tags');
      continue;
    }
    current = next;
    applied.push(e.actionId);
  }
  return { html: current, applied, rejected };
}
