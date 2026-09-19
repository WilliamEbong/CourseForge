/**
 * Single-file HTML compiler: CourseModel → one self-contained, deterministic HTML document with inline CSS,
 * bundled runtime JS, course data, inline SVG figures and a Lucide icon sprite, locked down by a hashed CSP.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { build, transform } from 'esbuild';
import { AppShell, courseData, dataScript } from '../../components/course-ui/src/components/shell.js';
import { esc, iconSprite } from '../../components/course-ui/src/contract.js';
import { compileTheme } from '../../components/course-ui/tokens/compile.js';
import { CfError } from '../core/errors.js';
import { sha256 } from '../core/hash.js';
import { repoRoot } from '../core/paths.js';
import { type Tracking, trackingOrigins } from '../core/schemas/course.js';
import { type CourseModel, CourseModelSchema } from '../core/schemas/model.js';
import type { BuildReport } from '../core/schemas/reports.js';
import { type CheckResult, runChecks } from './checks.js';
import { LUCIDE_NOTICE, lucideSvg } from './icons.js';

export interface VisualInput {
  svg: string;
  renderer: string;
  fallbackUsed?: boolean;
}

export interface RenderOptions {
  visuals: Map<string, VisualInput>;
  mode: 'release' | 'dev';
  /** Icon SVG provider (defaults to lucide-static from node_modules). */
  icons?: (name: string) => string;
  /** Size budget for the size check (bytes). */
  maxBytes?: number;
  /** Learner result tracking (deployment setting from course.yaml); null/absent builds a fully offline course. */
  tracking?: Tracking | null;
}

export type RenderReport = Omit<BuildReport, 'outputPath' | 'inputHashes' | 'toolVersions' | 'visuals'> & { checks: CheckResult[] };

export interface RenderResult {
  html: string;
  report: RenderReport;
}

const STYLE_FILES = ['base.css', 'components.css', 'utilities.css'];
const bundleCache = new Map<string, string>();

async function bundleRuntime(mode: 'release' | 'dev'): Promise<string> {
  const hit = bundleCache.get(mode);
  if (hit) return hit;
  const root = repoRoot();
  const out = await build({
    entryPoints: [join(root, 'components', 'course-ui', 'src', 'runtime', 'index.ts')],
    absWorkingDir: root,
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020', 'chrome100', 'firefox100', 'safari15'],
    minify: mode === 'release',
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'silent',
  });
  const js = (out.outputFiles[0]?.text ?? '').replace(/<\/(script)/gi, '<\\/$1').trim();
  bundleCache.set(mode, js);
  return js;
}

async function stylesheet(themeCss: string, mode: 'release' | 'dev'): Promise<string> {
  const dir = join(repoRoot(), 'components', 'course-ui', 'src', 'styles');
  const css = [themeCss, ...STYLE_FILES.map((f) => readFileSync(join(dir, f), 'utf8'))].join('\n').replace(/\r\n?/g, '\n');
  if (mode === 'dev') return css;
  const min = await transform(css, { loader: 'css', minify: true, target: ['chrome100', 'firefox100', 'safari15'], logLevel: 'silent' });
  return min.code.trim();
}

const b64sha = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/**
 * Inline style sources exactly as the browser will see them: parse5 (via cheerio) applies the same HTML and
 * SVG-foreign-content rules, so entity decoding, quoting and CDATA handling match what CSP hashes.
 */
function inlineStyles(body: string): { elements: string[]; attributes: string[] } {
  const $ = cheerio.load(body);
  return {
    elements: $('style')
      .map((_, el) => $(el).text())
      .get(),
    attributes: $('[style]')
      .map((_, el) => $(el).attr('style') ?? '')
      .get(),
  };
}

/**
 * CSP from the exact inline blocks: every <style> element, style attributes (via 'unsafe-hashes'), the runtime
 * script. Connections are forbidden unless the course is tracked, then only to the tracking origins (ADR 0013).
 */
function contentSecurityPolicy(styles: string[], styleAttrs: string[], script: string, connect: readonly string[]): string {
  const styleHashes = [...new Set(styles.map(b64sha))].sort();
  const attrHashes = [...new Set(styleAttrs.map(b64sha))].sort();
  const styleSrc = [...styleHashes, ...(attrHashes.length ? ["'unsafe-hashes'", ...attrHashes] : [])].join(' ');
  return [
    "default-src 'none'",
    'img-src data:',
    `style-src ${styleSrc}`,
    `script-src ${b64sha(script)}`,
    `connect-src ${connect.length ? connect.join(' ') : "'none'"}`,
    "font-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
}

export async function renderCourse(input: CourseModel, opts: RenderOptions): Promise<RenderResult> {
  const parsed = CourseModelSchema.safeParse(input);
  if (!parsed.success) {
    throw new CfError(
      'MODEL_INVALID',
      `Course model is invalid: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      {
        kind: 'input_invalid',
      },
    );
  }
  const model = parsed.data;
  const theme = compileTheme(model.theme);

  // SVG <style> CDATA markers would change the hashed text content; drop them.
  const visuals = new Map(
    [...opts.visuals].map(([id, v]) => [id, { ...v, svg: v.svg.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '') }] as const),
  );
  const tracking = opts.tracking ?? null;
  const connect = trackingOrigins(tracking);
  const body = AppShell.render({ model, visuals, tracking });
  const iconNames = [...new Set([...body.matchAll(/#cf-i-([a-z0-9-]+)/g)].map((m) => m[1]!))].sort();
  const sprite = iconSprite(iconNames, opts.icons ?? lucideSvg);
  const data = dataScript(courseData(model, tracking));
  const css = await stylesheet(theme.css, opts.mode);
  const js = await bundleRuntime(opts.mode);

  const figureSvgs = [...body.matchAll(/<div class="cf-figure-media">([\s\S]*?)<\/div><figcaption/g)].map((m) => m[1]!);
  const inline = inlineStyles(`${sprite}${body}`);
  const csp = contentSecurityPolicy([css, ...inline.elements], inline.attributes, js, connect);
  const d = model.theme;

  const html = `<!doctype html>
<html lang="${esc(model.language || 'en')}" data-cf-family="${esc(d.family)}" data-cf-density="${esc(d.density)}" data-cf-corner="${esc(d.corner)}" data-cf-figure-style="${esc(d.figureStyle)}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<meta name="generator" content="CourseForge">
<title>${esc(model.title)}</title>
<style>${css}</style>
</head>
<body>
<!-- ${LUCIDE_NOTICE} -->
${sprite}
${body}
${data}
<script>${js}</script>
</body>
</html>
`;

  const bytes = Buffer.byteLength(html, 'utf8');
  const size = (s: string) => Buffer.byteLength(s, 'utf8');
  const svgBytes = figureSvgs.reduce((n, s) => n + size(s), 0) + size(sprite);
  const cssBytes = size(css);
  const jsBytes = size(js);
  const dataBytes = size(data);
  const checks = runChecks(html, model, opts.maxBytes, connect);
  const report: RenderReport = {
    schemaVersion: 1,
    courseId: model.courseId,
    mode: opts.mode,
    outputHash: sha256(html),
    bytes,
    sizeBreakdown: { html: bytes - cssBytes - jsBytes - dataBytes - svgBytes, css: cssBytes, js: jsBytes, data: dataBytes, svg: svgBytes },
    theme: { ...d, label: theme.tokens.label },
    contrast: theme.contrast,
    icons: iconNames,
    counts: {
      modules: model.modules.length,
      screens: model.screens.length,
      interactions: model.screens.filter((s) => s.interaction).length,
      graded: model.screens.filter((s) => s.graded && s.interaction).length,
      visuals: new Set(model.screens.map((s) => s.visualId).filter(Boolean)).size,
      glossary: model.glossary.length,
      references: model.references.length,
    },
    checks,
  };
  return { html, report };
}
