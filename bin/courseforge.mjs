#!/usr/bin/env node
// CourseForge launcher: compiled CLI (dist/) when built, else the TypeScript sources via tsx (dev checkout).
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist', 'src', 'cli', 'main.js');
const src = join(root, 'src', 'cli', 'main.ts');

let mod;
if (existsSync(dist)) {
  mod = await import(pathToFileURL(dist).href);
} else if (existsSync(src) && existsSync(join(root, 'node_modules', 'tsx'))) {
  const { tsImport } = await import('tsx/esm/api');
  mod = await tsImport(pathToFileURL(src).href, import.meta.url);
} else {
  process.stderr.write('CourseForge is not built yet. Run ./setup.ps1 (Windows) or ./setup.sh\n');
  process.exit(3);
}

const code = await mod.main(process.argv.slice(2));
// Exit once stdout has drained (piped stdout is async on POSIX), so lingering handles cannot keep the CLI alive.
process.stdout.write('', () => process.exit(code));
