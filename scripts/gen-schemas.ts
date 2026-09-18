/**
 * Generates `schemas/*.schema.json` from the zod source of truth (`src/core/schemas`).
 * Agent-facing schemas are emitted in the strict wire form; others as full draft-2020-12 JSON Schema.
 * `--check` exits non-zero if the committed files differ (drift test / CI).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { repoRoot } from '../src/core/paths.js';
import { SCHEMAS } from '../src/core/schemas/index.js';
import { toWireSchema } from '../src/core/wire-schema.js';

export function renderSchemas(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [name, entry] of Object.entries(SCHEMAS)) {
    const body = entry.agent
      ? toWireSchema(entry.schema)
      : (z.toJSONSchema(entry.schema, { target: 'draft-2020-12', reused: 'inline', unrepresentable: 'any', io: 'input' }) as Record<
          string,
          unknown
        >);
    const { $schema: _ignored, ...rest } = body;
    const doc = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `https://courseforge.local/schemas/${name}.schema.json`,
      title: name,
      description: `${entry.description}${entry.agent ? ' (agent wire schema: strict subset)' : ''}. Generated from src/core/schemas — do not edit.`,
      ...rest,
    };
    out.set(`${name}.schema.json`, `${JSON.stringify(doc, null, 2)}\n`);
  }
  return out;
}

function main(): void {
  const dir = join(repoRoot(), 'schemas');
  const check = process.argv.includes('--check');
  const rendered = renderSchemas();
  if (check) {
    const drift: string[] = [];
    for (const [file, text] of rendered) {
      const p = join(dir, file);
      if (!existsSync(p) || readFileSync(p, 'utf8').replace(/\r\n/g, '\n') !== text) drift.push(file);
    }
    const extra = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.schema.json') && !rendered.has(f)) : [];
    if (drift.length || extra.length) {
      console.error(`Schema drift: ${[...drift, ...extra.map((e) => `${e} (stale)`)].join(', ')}\nRun: npm run gen:schemas`);
      process.exit(1);
    }
    console.log(`schemas up to date (${rendered.size})`);
    return;
  }
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of rendered) writeFileSync(join(dir, file), text);
  console.log(`wrote ${rendered.size} schemas to schemas/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
