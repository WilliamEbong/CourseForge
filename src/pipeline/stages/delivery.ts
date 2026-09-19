/**
 * Deterministic delivery stages: COURSE_MODEL, COURSE_BUILD, COURSE_QA (browser QA + review panel), RELEASE.
 */
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { buildTraceGraph, latest, listArtifacts, loadRegistry, traceIssues, traceSummary } from '../../artifacts/index.js';
import type { Renderer } from '../../core/enums.js';
import { copyFile, exists, readJson, readText, writeAtomic, writeFileRaw, writeJson } from '../../core/fsx.js';
import { hashFile } from '../../core/hash.js';
import { COURSE_FILES, repoRoot } from '../../core/paths.js';
import {
  AccessibilityReportSchema,
  BuildReportSchema,
  type CourseModel,
  CourseModelSchema,
  DesignDirectionSchema,
  effectiveRiskTier,
  effectiveTracking,
  type Finding,
  FunctionalReportSchema,
  IntakeReportSchema,
  type ReleaseDecision,
  trackingOrigins,
  type VisualSpec,
} from '../../core/schemas/index.js';
import { GraphicsBrowser, renderAll } from '../../graphics/index.js';
import { compareQaRuns, qaIssues, regressionMarkdown, runQa } from '../../qa/index.js';
import { buildReleaseManifest, qaReportMarkdown, releaseGate, sourceReportMarkdown } from '../../release/index.js';
import {
  checkIdsRendered,
  checkNoDragOnly,
  checkNoRuntimeDeps,
  checkSingleFile,
  checkSizeBudget,
  checkTextEquivalents,
  renderCourse,
} from '../../renderer/index.js';
import { routeVisual } from '../../routing/visual.js';
import type { Issue } from '../checks/content.js';
import { loCoverageIssues } from '../checks/content.js';
import { compileCourseModel, modelIntegrityProblems } from '../compile/model.js';
import type { RunContext } from '../context.js';
import { allStageFindings } from '../findings-store.js';
import { scormInfo, scormPackage } from '../scorm.js';
import { runVisualRepair } from '../visual-repair.js';
import { editorial, ensureVisualDirection, readVisualSpecs, storyboard, storyboardValidators } from './authoring.js';
import {
  canonicalStoryboard,
  canonicalStoryboardPath,
  claims,
  has,
  type Produced,
  p,
  read,
  type StageHandler,
  sources,
  wants,
} from './common.js';

const F = COURSE_FILES;

/* ------------------------------------------------------------- COURSE_MODEL */

function traceJson(ctx: RunContext) {
  const g = buildTraceGraph(ctx.dir);
  const edges: [string, string][] = [];
  for (const [from, tos] of g.down) for (const to of tos) edges.push([from, to]);
  edges.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  return {
    schemaVersion: 1,
    nodes: [...g.nodes.values()].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)),
    edges,
    summary: traceSummary(g),
    issues: traceIssues(g),
  };
}

export function compileModelFiles(ctx: RunContext): Produced[] {
  ensureVisualDirection(ctx);
  const sbPath = canonicalStoryboardPath(ctx);
  const sb = canonicalStoryboard(ctx);
  const direction = read(ctx, F.direction, DesignDirectionSchema);
  const visuals: VisualSpec[] = readVisualSpecs(ctx);
  const routes = visuals.map((v) => {
    const r = routeVisual(v, ctx.registries.routing, ctx.registries.tools);
    return { visualId: v.id, renderer: r.renderer, fallbacks: r.fallbacks, rule: r.rule };
  });
  const reg = loadRegistry(ctx.dir);
  const inputs = [sbPath, F.direction, F.visualSpecs].map((path) => {
    const rec =
      listArtifacts(reg)
        .filter((a) => a.path === path)
        .at(-1) ?? null;
    return { artifactId: rec?.artifactId ?? null, path, hash: hashFile(p(ctx, path)) };
  });
  const model = compileCourseModel({
    storyboard: sb,
    direction,
    visuals,
    visualRoutes: routes,
    componentMap: ctx.registries.routing.components,
    sourceArtifacts: inputs,
  });
  writeJson(p(ctx, F.courseModel), model);
  writeJson(p(ctx, F.trace), traceJson(ctx));
  writeJson(p(ctx, F.buildManifest), {
    schemaVersion: 1,
    courseId: ctx.courseId,
    modelVersion: model.version,
    inputs,
    registryHashes: ctx.registries.hashes,
  });
  return [{ logicalKey: 'course-model', path: F.courseModel, stage: 'COURSE_MODEL' }];
}

export const courseModel: StageHandler = {
  async compile(ctx) {
    return compileModelFiles(ctx);
  },
  async validate(ctx, ids) {
    const out: Issue[] = [];
    const res = CourseModelSchema.safeParse(has(ctx, F.courseModel) ? readJson(p(ctx, F.courseModel)) : null);
    if (!res.success) {
      if (wants(ids, 'schema'))
        out.push({
          checkId: 'schema',
          severity: 'blocker',
          category: 'structure',
          location: F.courseModel,
          problem: 'Course model missing or invalid',
          recommendedAction: 'Recompile the model.',
        });
      return out;
    }
    if (wants(ids, 'model-integrity'))
      for (const pr of modelIntegrityProblems(res.data))
        out.push({
          checkId: 'model-integrity',
          severity: 'critical',
          category: 'structure',
          location: pr.location,
          problem: pr.problem,
          recommendedAction: 'Fix the upstream storyboard/visual specs and recompile.',
        });
    if (wants(ids, 'trace'))
      for (const t of traceIssues(buildTraceGraph(ctx.dir)))
        out.push({
          checkId: 'trace',
          severity: t.severity,
          category: 'traceability',
          location: t.id,
          problem: `${t.code}: ${t.detail}`,
          recommendedAction: 'Repair the traceability link upstream.',
        });
    if (wants(ids, 'lo-coverage')) out.push(...loCoverageIssues(canonicalStoryboard(ctx)));
    if (wants(ids, 'citations-resolve'))
      out.push(
        ...storyboardValidators(ctx, canonicalStoryboardPath(ctx), ['citations-resolve'], 'storyboard').filter(
          (i) => i.severity !== 'minor',
        ),
      );
    return out;
  },
};

/* ------------------------------------------------------------- COURSE_BUILD */

function toolVersions(): Record<string, string> {
  const req = createRequire(join(repoRoot(), 'package.json'));
  const out: Record<string, string> = {};
  for (const name of ['mermaid', 'vega', 'vega-lite', 'd3', '@svgdotjs/svg.js', 'lucide-static', 'esbuild', 'playwright', 'axe-core']) {
    try {
      out[name] = (req(`${name}/package.json`) as { version: string }).version;
    } catch {
      out[name] = 'unavailable';
    }
  }
  return out;
}

export async function buildCourseFiles(ctx: RunContext): Promise<Produced[]> {
  const model = read(ctx, F.courseModel, CourseModelSchema);
  const browser = new GraphicsBrowser();
  let rendered: Awaited<ReturnType<typeof renderAll>>;
  try {
    const routes = new Map(model.visualRoutes.map((r) => [r.visualId, r]));
    rendered = await renderAll(model.visuals, routes, {
      browser,
      theme: { figureStyle: model.theme.figureStyle, corner: model.theme.corner },
      maxSemanticRepairs: ctx.registries.fallbacks.renderer.maxSemanticRepairs,
      repair:
        ctx.harnessName === 'fake' && !process.env.COURSEFORGE_FIXTURES ? undefined : (spec, issues) => runVisualRepair(ctx, spec, issues),
    });
  } finally {
    await browser.close();
  }
  const visuals = new Map<string, { svg: string; renderer: string; fallbackUsed?: boolean; html?: string | null }>();
  for (const [id, rv] of rendered)
    visuals.set(id, { svg: rv.svg ?? '', renderer: rv.renderer, fallbackUsed: rv.fallbackUsed, html: rv.html });
  const { html, report } = await renderCourse(model, { visuals, mode: 'release', tracking: effectiveTracking(ctx.manifest) });
  writeAtomic(p(ctx, F.buildHtml), html);
  const inputHashes = { [F.courseModel]: hashFile(p(ctx, F.courseModel)) };
  const buildReport = BuildReportSchema.parse({
    ...report,
    outputPath: F.buildHtml,
    inputHashes,
    toolVersions: toolVersions(),
    visuals: [...rendered.values()].map((rv) => ({
      visualId: rv.visualId,
      archetype: model.visuals.find((v) => v.id === rv.visualId)?.archetype ?? 'PROCESS',
      renderer: rv.renderer as Renderer,
      rule: rv.rule,
      fallbackUsed: rv.fallbackUsed,
      attempts: rv.attempts.map((a) => ({ renderer: a.renderer as Renderer, ok: a.ok, error: a.error })),
      bytes: rv.bytes,
    })),
  });
  writeJson(p(ctx, F.buildReport), buildReport);
  return [{ logicalKey: 'build', path: F.buildHtml, stage: 'COURSE_BUILD', event: 'build' }];
}

export function buildChecks(ctx: RunContext): { id: string; pass: boolean; detail: string }[] {
  if (!has(ctx, F.buildHtml)) return [{ id: 'build-exists', pass: false, detail: 'build/index.html missing' }];
  const html = readText(p(ctx, F.buildHtml));
  const model = has(ctx, F.courseModel) ? read(ctx, F.courseModel, CourseModelSchema) : null;
  const connect = isCourseForgeBuild(html) ? trackingOrigins(effectiveTracking(ctx.manifest)) : [];
  const checks = [
    checkSingleFile(html, connect),
    checkNoRuntimeDeps(html),
    checkSizeBudget(html),
    checkTextEquivalents(html),
    checkNoDragOnly(html),
  ];
  if (model && isCourseForgeBuild(html)) checks.push(checkIdsRendered(html, model));
  return checks;
}

export function isCourseForgeBuild(html: string): boolean {
  return html.includes('id="cf-data"');
}

/**
 * An imported (non-CourseForge) HTML course with a reconstructed model is improved by rebuilding it through
 * the CourseForge component system after its original has been reviewed; content repairs apply on top.
 */
export function needsStructuralRebuild(ctx: RunContext): boolean {
  const mode = ctx.state.stages.COURSE_QA.mode;
  const buildMode = ctx.state.stages.COURSE_BUILD.mode;
  const improving = mode === 'improve' || mode === 'rebuild' || buildMode === 'improve' || buildMode === 'rebuild';
  return improving && has(ctx, F.buildHtml) && has(ctx, F.storyboardJson) && !isCourseForgeBuild(readText(p(ctx, F.buildHtml)));
}

const BUILD_CHECK_VALIDATOR: Record<string, string> = {
  'build-single-file': 'single-file',
  'build-ids-rendered': 'ids-rendered',
  'build-no-runtime-deps': 'no-runtime-deps',
  'build-size-budget': 'size-budget',
  'visual-text-equivalents': 'text-equivalents',
};

export const courseBuild: StageHandler = {
  async compile(ctx) {
    return buildCourseFiles(ctx);
  },
  async validate(ctx, ids) {
    const wanted = new Set(ids.map((i) => BUILD_CHECK_VALIDATOR[i]).filter(Boolean));
    const imported = has(ctx, F.buildHtml) && !isCourseForgeBuild(readText(p(ctx, F.buildHtml)));
    return buildChecks(ctx)
      .filter((c) => !c.pass && (wanted.size === 0 || [...wanted].some((w) => c.id.includes(w as string)) || c.id === 'build-exists'))
      .map((c) => ({
        checkId: `build:${c.id}`,
        // An imported course is reviewed, not blocked, by its own build defects; they become QA findings.
        severity: imported ? ('major' as const) : ('critical' as const),
        category: 'functional' as const,
        location: 'build/index.html',
        problem: c.detail,
        recommendedAction: 'Fix the renderer input or the component responsible and rebuild.',
      }));
  },
};

/* ---------------------------------------------------------------- COURSE_QA */

function qaProfile(): 'smoke' | 'dev' | 'release' {
  const v = process.env.COURSEFORGE_QA_PROFILE;
  return v === 'smoke' || v === 'release' ? v : 'dev';
}

const QA_BASELINE = 'review/qa-baseline.json';

async function runQaFiles(ctx: RunContext): Promise<Produced[]> {
  const html = p(ctx, F.buildHtml);
  const model = has(ctx, F.courseModel) && isCourseForgeBuild(readText(html)) ? read(ctx, F.courseModel, CourseModelSchema) : null;
  const { functional, accessibility, screenshots } = await runQa({
    tracking: effectiveTracking(ctx.manifest),
    htmlPath: html,
    model,
    outDir: p(ctx, F.qaDir),
    profile: qaProfile(),
    courseId: ctx.courseId,
  });
  writeJson(p(ctx, F.functional), functional);
  writeJson(p(ctx, F.accessibility), accessibility);
  writeJson(p(ctx, `${F.screenshots}/manifest.json`), screenshots);
  if (!has(ctx, QA_BASELINE)) writeJson(p(ctx, QA_BASELINE), { functional, accessibility });
  else {
    const before = readJson<{ functional: unknown; accessibility: unknown }>(p(ctx, QA_BASELINE));
    const regression = compareQaRuns(
      { functional: FunctionalReportSchema.parse(before.functional), accessibility: AccessibilityReportSchema.parse(before.accessibility) },
      { functional, accessibility },
    );
    writeJson(p(ctx, F.regression), regression);
    writeAtomic(p(ctx, F.regression.replace('.json', '.md')), regressionMarkdown(regression));
  }
  return [
    { logicalKey: 'qa-functional', path: F.functional, stage: 'COURSE_QA' },
    { logicalKey: 'qa-accessibility', path: F.accessibility, stage: 'COURSE_QA' },
  ];
}

export const courseQa: StageHandler = {
  async compile(ctx) {
    return runQaFiles(ctx);
  },
  async validate(ctx) {
    if (!has(ctx, F.functional))
      return [
        {
          checkId: 'qa-functional',
          severity: 'blocker',
          category: 'functional',
          location: 'global',
          problem: 'QA did not produce a functional report',
          recommendedAction: 'Rerun QA.',
        },
      ];
    const functional = read(ctx, F.functional, FunctionalReportSchema);
    const accessibility = read(ctx, F.accessibility, AccessibilityReportSchema);
    return qaIssues(functional, accessibility, { axeBlockingImpacts: ctx.registries.policy.axeBlockingImpacts });
  },
  repair(ctx) {
    // Repairs go to the canonical storyboard (the course is rebuilt from it). Pure imported HTML without a
    // reconstructable storyboard returns null and is repaired html-direct by the stage loop.
    if (!has(ctx, F.storyboardJson) && !has(ctx, F.storyboardEditedJson)) return null;
    const handler = canonicalStoryboardPath(ctx) === F.storyboardEditedJson ? editorial : storyboard;
    return handler.repair?.(ctx) ?? null;
  },
  async afterRepair(ctx) {
    // Rebuild through the CourseForge pipeline and retest (regression report compares with the baseline).
    const produced = compileModelFiles(ctx);
    produced.push(...(await buildCourseFiles(ctx)));
    produced.push(...(await runQaFiles(ctx)));
    return produced.map((x) => ({ ...x, event: 'qa-repaired' as const }));
  },
};

/* ------------------------------------------------------------------ RELEASE */

function originalsModified(ctx: RunContext): string[] {
  if (!has(ctx, F.intakeReport)) return [];
  const report = read(ctx, F.intakeReport, IntakeReportSchema);
  return report.originals.filter((o) => !exists(p(ctx, o.path)) || hashFile(p(ctx, o.path)) !== o.hash).map((o) => o.path);
}

export function computeReleaseDecision(ctx: RunContext): { decision: ReleaseDecision; findings: Finding[] } {
  const findings = allStageFindings(ctx);
  const functional = has(ctx, F.functional) ? read(ctx, F.functional, FunctionalReportSchema) : null;
  const accessibility = has(ctx, F.accessibility) ? read(ctx, F.accessibility, AccessibilityReportSchema) : null;
  const summary = traceSummary(buildTraceGraph(ctx.dir));
  const required = [F.buildHtml, F.functional, F.accessibility];
  const decision = releaseGate({
    findings,
    policy: {
      releaseBlockingSeverities: ctx.registries.policy.releaseBlockingSeverities,
      axeBlockingImpacts: ctx.registries.policy.axeBlockingImpacts,
    },
    functional,
    accessibility,
    build: { checks: buildChecks(ctx) },
    requiredArtifacts: required,
    presentArtifacts: required.filter((r) => has(ctx, r)),
    citations: { dangling: summary.dangling, unresolvedInline: [] },
    lockConflicts: findings.filter((f) => f.status === 'open' && f.checkId === 'locks-intact').map((f) => f.findingId),
    cyclesExhaustedWithBlockers: false,
    originalsModified: originalsModified(ctx),
    humanApprovalPending: false,
  });
  return { decision, findings };
}

function copyLicenses(ctx: RunContext): void {
  const lucide = join(repoRoot(), 'node_modules', 'lucide-static', 'LICENSE');
  if (exists(lucide)) copyFile(lucide, p(ctx, 'release/licenses/lucide-ISC.txt'));
}

export const release: StageHandler = {
  async compile(ctx) {
    const { decision, findings } = computeReleaseDecision(ctx);
    writeJson(p(ctx, 'release/release-decision.json'), decision);
    if (decision.decision !== 'pass') return [];
    copyFile(p(ctx, F.buildHtml), p(ctx, F.releaseHtml));
    copyLicenses(ctx);
    if (effectiveTracking(ctx.manifest)?.destination === 'lms')
      writeFileRaw(
        p(ctx, F.releaseScorm),
        scormPackage({ htmlPath: p(ctx, F.releaseHtml), now: new Date(ctx.now()), ...scormInfo(ctx.dir, ctx.manifest) }),
      );
    const model: CourseModel | null = has(ctx, F.courseModel) ? read(ctx, F.courseModel, CourseModelSchema) : null;
    const functional = read(ctx, F.functional, FunctionalReportSchema);
    const accessibility = read(ctx, F.accessibility, AccessibilityReportSchema);
    const buildReport = has(ctx, F.buildReport) ? read(ctx, F.buildReport, BuildReportSchema) : null;
    const shotsManifest = has(ctx, `${F.screenshots}/manifest.json`)
      ? readJson<{ items: { screenId: string; viewport: number; path: string }[] }>(p(ctx, `${F.screenshots}/manifest.json`)).items
      : [];
    const version = `${(listArtifacts(loadRegistry(ctx.dir), 'release').length + 1).toString()}.0.0`;
    writeAtomic(
      p(ctx, F.qaReport),
      qaReportMarkdown({
        model,
        functional,
        accessibility,
        build: buildReport,
        findings,
        decision,
        screenshots: shotsManifest,
        courseTitle: ctx.manifest.course.title,
        releaseVersion: version,
      }),
    );
    const refs = model?.references ?? [];
    writeAtomic(
      p(ctx, F.sourceReport),
      sourceReportMarkdown({
        references: refs.length ? refs : has(ctx, F.sources) ? sources(ctx) : [],
        claims: has(ctx, F.claims) ? claims(ctx) : [],
        screens: (model?.screens ?? []).map((s) => ({ id: s.id, title: s.title, citations: s.citations })),
        traceSummary: releaseTrace(ctx),
      }),
    );
    const reg = loadRegistry(ctx.dir);
    const releaseHash = hashFile(p(ctx, F.releaseHtml));
    const stateStages = ctx.state.stages;
    const manifest = buildReleaseManifest({
      courseId: ctx.courseId,
      title: ctx.manifest.course.title,
      releaseVersion: version,
      releasedAt: ctx.now(),
      file: { path: F.releaseHtml, sha256: releaseHash, bytes: readText(p(ctx, F.releaseHtml)).length },
      decision,
      backends: [{ name: ctx.harnessName, version: ctx.probes[ctx.harnessName as 'claude' | 'codex']?.version ?? null }],
      toolVersions: buildReport?.toolVersions ?? toolVersions(),
      artifacts: [...new Set(listArtifacts(reg).map((a) => a.logicalKey))]
        .map((k) => latest(reg, k))
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => ({ artifactId: a.artifactId, logicalKey: a.logicalKey, path: a.path, hash: a.hash, label: a.label })),
      findings: {
        open: countOpen(findings),
        accepted: findings.filter((f) => f.status === 'accepted').length,
        waived: findings.filter((f) => f.status === 'waived' || f.status === 'rejected').length,
      },
      trace: releaseTrace(ctx),
      riskTier: effectiveRiskTier(ctx.manifest),
      riskOverride: ctx.manifest.course.risk_override,
      humanApprovals: Object.entries(stateStages)
        .filter(([, s]) => s.gate?.status === 'approved')
        .map(([stage, s]) => ({ stage: stage as keyof typeof stateStages, by: s.gate?.decidedBy ?? null, at: s.gate?.decidedAt ?? null })),
    });
    writeJson(p(ctx, F.releaseManifest), manifest);
    return [{ logicalKey: 'release', path: F.releaseHtml, stage: 'RELEASE', event: 'release' }];
  },
  async validate(ctx, ids) {
    const out: Issue[] = [];
    if (wants(ids, 'release-gate') && has(ctx, 'release/release-decision.json')) {
      const d = readJson<ReleaseDecision>(p(ctx, 'release/release-decision.json'));
      for (const r of d.reasons)
        out.push({
          checkId: 'release-gate',
          severity: 'blocker',
          category: 'functional',
          location: r.findingIds[0] ?? 'global',
          problem: `${r.code}: ${r.detail}`,
          recommendedAction: 'Resolve the blocking reason (fix, or have a human waive/accept the finding) and rerun release.',
        });
    }
    if (wants(ids, 'originals-intact'))
      for (const o of originalsModified(ctx))
        out.push({
          checkId: 'originals-intact',
          severity: 'blocker',
          category: 'structure',
          location: o,
          problem: 'Imported original was modified or removed',
          recommendedAction: 'Restore the original bytes; originals are immutable.',
        });
    return out;
  },
};

function countOpen(findings: Finding[]) {
  const out = { blocker: 0, critical: 0, major: 0, minor: 0, style: 0 };
  for (const f of findings) if (f.status === 'open' || f.status === 'accepted' || f.status === 'deferred') out[f.severity]++;
  return out;
}

function releaseTrace(ctx: RunContext) {
  const s = traceSummary(buildTraceGraph(ctx.dir));
  return {
    objectives: s.objectives,
    screens: has(ctx, F.courseModel) ? read(ctx, F.courseModel, CourseModelSchema).screens.length : 0,
    assessedObjectives: s.assessedObjectives,
    unassessedObjectives: s.unassessed,
    danglingReferences: s.dangling,
    sourcesCited: s.sourcesCited,
  };
}

export function screenshotFiles(ctx: RunContext): string[] {
  const dir = p(ctx, F.screenshots);
  return exists(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : [];
}
