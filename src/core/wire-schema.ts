/**
 * Converts a zod schema into the strict JSON Schema subset accepted by both agent backends'
 * structured-output modes (Claude `--json-schema`, Codex `--output-schema`):
 * objects strict, all properties required, no `$ref`, and only structural keywords.
 * Value constraints (min/max/pattern/…) are enforced by zod after the agent responds.
 */
import { z } from 'zod';

const ALLOWED = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'anyOf', 'const', 'description']);

type Json = Record<string, unknown>;

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== 'object') return node;
  const src = node as Json;
  const out: Json = {};
  for (const [k, v] of Object.entries(src)) {
    if (!ALLOWED.has(k)) continue;
    if (k === 'properties') {
      const props: Json = {};
      for (const [pk, pv] of Object.entries(v as Json)) props[pk] = clean(pv);
      out.properties = props;
    } else if (k === 'items' || k === 'anyOf') {
      out[k] = clean(v);
    } else {
      out[k] = v;
    }
  }
  if (out.type === 'object' || out.properties) {
    out.type = 'object';
    out.properties ??= {};
    out.required = Object.keys(out.properties as Json);
    out.additionalProperties = false;
  }
  return out;
}

export function toWireSchema(schema: z.ZodType): Json {
  const full = z.toJSONSchema(schema, { target: 'draft-2020-12', reused: 'inline', unrepresentable: 'throw' }) as Json;
  const root = clean(full) as Json;
  if (root.type !== 'object') throw new Error('Agent-facing schemas must have an object root');
  return root;
}

/** Returns human-readable violations of the strict wire subset (empty = compliant). Used by tests. */
export function wireViolations(node: unknown, path = '$'): string[] {
  const out: string[] = [];
  if (Array.isArray(node)) {
    node.forEach((n, i) => {
      out.push(...wireViolations(n, `${path}[${i}]`));
    });
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const n = node as Json;
  if ('$ref' in n) out.push(`${path}: contains $ref`);
  for (const k of Object.keys(n)) if (!ALLOWED.has(k) && k !== '$schema') out.push(`${path}: keyword ${k} not allowed`);
  if (n.type === 'object') {
    const props = Object.keys((n.properties as Json) ?? {});
    const req = (n.required as string[]) ?? [];
    if (n.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
    for (const p of props) if (!req.includes(p)) out.push(`${path}: property ${p} not required`);
  }
  for (const [k, v] of Object.entries(n)) {
    if (k === 'properties') for (const [pk, pv] of Object.entries(v as Json)) out.push(...wireViolations(pv, `${path}.${pk}`));
    else if (k === 'items' || k === 'anyOf') out.push(...wireViolations(v, `${path}.${k}`));
  }
  return out;
}
