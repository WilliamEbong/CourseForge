/**
 * `courseforge doctor`: inspect → classify → (optionally) repair repo-local problems → recheck →
 * write `.courseforge/environment.json` (gitignored) and return the manifest.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeJson } from '../core/fsx.js';
import { repoRoot } from '../core/paths.js';
import type { DoctorCheck, EnvironmentManifest } from '../core/schemas/reports.js';
import {
  browserStatus,
  CHECKS,
  claudeAuth,
  claudeGlobalConfig,
  claudeVersion,
  codexAuth,
  codexGlobalConfig,
  codexVersion,
  type DoctorCheckDef,
  detectCloudSync,
  gitVersion,
  NODE_REQUIRED,
  npmVersion,
  packageVersion,
  REQUIRED_PACKAGES,
  versionAtLeast,
} from './checks.js';
import { type EnvProbe, memoProbe, realProbe } from './probe.js';

export interface DoctorOptions {
  repair?: boolean;
  /** Restrict to these check IDs (or ID prefixes such as `claude.`). */
  only?: string[];
  probe?: EnvProbe;
  checks?: DoctorCheckDef[];
  /** Write `.courseforge/environment.json` (default true). */
  write?: boolean;
}

async function runChecks(defs: DoctorCheckDef[], probe: EnvProbe): Promise<DoctorCheck[]> {
  return Promise.all(
    defs.map(async (def) => {
      const started = Date.now();
      let outcome: Pick<DoctorCheck, 'status' | 'classification' | 'message' | 'repair'>;
      try {
        outcome = await def.run(probe);
      } catch (err) {
        outcome = { status: 'fail', classification: 'manual', message: `check crashed: ${String(err)}`, repair: null };
      }
      return { id: def.id, title: def.title, ...outcome, repaired: false, durationMs: Date.now() - started };
    }),
  );
}

/** failed if any manual failure, repairable if any repairable failure, else ready (warnings never block). */
export function overallStatus(checks: DoctorCheck[]): EnvironmentManifest['status'] {
  const failed = checks.filter((c) => c.status === 'fail');
  if (failed.some((c) => c.classification !== 'repairable')) return 'failed';
  if (failed.length) return 'repairable';
  return 'ready';
}

async function buildManifest(p: EnvProbe, checks: DoctorCheck[]): Promise<EnvironmentManifest> {
  const [npm, git, claudeV, codexV, claudeReady, codexReady, browser] = await Promise.all([
    npmVersion(p),
    gitVersion(p),
    claudeVersion(p),
    codexVersion(p),
    claudeAuth(p),
    codexAuth(p),
    browserStatus(p),
  ]);
  const gb = (n: number) => Math.round((n / 1024 ** 3) * 10) / 10;
  const pwVersion = packageVersion(p, 'playwright');
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    platform: p.platform,
    release: p.release,
    architecture: p.arch,
    cpu: p.cpu,
    memoryGb: { total: gb(p.totalmem), free: gb(p.freemem) },
    node: {
      installed: true,
      version: p.nodeVersion,
      compatible: versionAtLeast(p.nodeVersion, NODE_REQUIRED),
      required: `>=${NODE_REQUIRED}`,
    },
    npm: { installed: npm !== null, version: npm },
    git: { installed: git !== null, version: git },
    claude: { installed: claudeV !== null, version: claudeV, ready: claudeReady, globalConfigDetected: claudeGlobalConfig(p) },
    codex: { installed: codexV !== null, version: codexV, ready: codexReady, globalConfigDetected: codexGlobalConfig(p) },
    playwright: { installed: pwVersion !== null, version: pwVersion, chromium: browser.chromium, source: browser.source },
    packages: Object.fromEntries(REQUIRED_PACKAGES.map((n) => [n, packageVersion(p, n)])),
    cloudSync: detectCloudSync(p),
    checks,
    status: overallStatus(checks),
  };
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<EnvironmentManifest> {
  const base = opts.probe ?? realProbe();
  const only = opts.only;
  const defs = (opts.checks ?? CHECKS).filter((c) => !only?.length || only.some((o) => c.id === o || c.id.startsWith(o)));

  let probe = memoProbe(base);
  let checks = await runChecks(defs, probe);

  if (opts.repair) {
    const repairs: Record<string, string> = {};
    // Sequential: repairs share node_modules/dist and some depend on earlier ones (npm ci before build).
    const done = new Set<DoctorCheckDef['repair']>();
    for (const def of defs) {
      const c = checks.find((x) => x.id === def.id);
      if (!c || c.status === 'pass' || c.status === 'skip' || !def.repair || c.classification === 'advisory') continue;
      if (done.has(def.repair)) continue;
      done.add(def.repair);
      try {
        repairs[def.id] = await def.repair(base);
      } catch (err) {
        repairs[def.id] = `repair failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    if (Object.keys(repairs).length) {
      const before = new Map(checks.map((c) => [c.id, c]));
      probe = memoProbe(base);
      checks = (await runChecks(defs, probe)).map((c) => {
        const prev = before.get(c.id);
        const wasBroken = prev && prev.status !== 'pass' && prev.status !== 'skip';
        const note = repairs[c.id];
        if (wasBroken && c.status === 'pass') return { ...c, repaired: true };
        return note && c.status !== 'pass' ? { ...c, message: `${c.message} (${note.split('\n')[0]})` } : c;
      });
    }
  }

  const manifest = await buildManifest(probe, checks);
  if (opts.write !== false) writeJson(join(base.repoRoot, '.courseforge', 'environment.json'), manifest);
  return manifest;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Copy of a manifest safe to store in a course audit trail: repo path → `<repo>`, home → `~`
 * (both slash styles, case-insensitive). The manifest never contains environment variable values.
 */
export function redactEnvironment(
  manifest: EnvironmentManifest,
  paths: { home: string; repo: string } = { home: homedir(), repo: repoRoot() },
): EnvironmentManifest {
  const variants = (p: string) => [...new Set([p, p.replace(/\\/g, '/'), p.replace(/\//g, '\\')])].map(escapeRe).join('|');
  const repoRe = new RegExp(variants(paths.repo), 'gi');
  const homeRe = new RegExp(variants(paths.home), 'gi');
  const scrub = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(repoRe, '<repo>').replace(homeRe, '~');
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)]));
    return v;
  };
  return scrub(manifest) as EnvironmentManifest;
}
