/**
 * PipelineApi implementation: course lifecycle operations used by the CLI and tests.
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  addLockedIds,
  buildTraceGraph,
  impact,
  latest,
  listArtifacts,
  loadRegistry,
  registerArtifact,
  removeLockedIds,
  restoreVersion,
  trace,
} from '../artifacts/index.js';
import { EXIT, IntakeModeSchema, STAGES, type Stage } from '../core/enums.js';
import { CfError, usageError } from '../core/errors.js';
import { ensureDir, exists, readText, removePath, writeAtomic } from '../core/fsx.js';
import { slugify } from '../core/ids.js';
import { COURSE_FILES, courseDir, coursesDir, localStateDir, repoRoot } from '../core/paths.js';
import { CourseManifestSchema, type Finding } from '../core/schemas/index.js';
import { ingestFile } from '../ingestion/intake.js';
import type { PipelineApi, RunOutcome, StatusReport } from './api.js';
import { loadStageFindings, saveStageFindings } from './findings-store.js';
import { defaultFromStage, openContext, runRange } from './runner.js';
import { runSmoke } from './smoke.js';
import {
  courseExists,
  initialState,
  loadManifest,
  loadState,
  logEvent,
  requireCourse,
  saveManifest,
  saveState,
  transitionStage,
} from './store.js';

const now = () => new Date().toISOString();

function courseReadme(title: string, id: string): string {
  return `# ${title}

This folder is a self-contained CourseForge course project (\`${id}\`): inputs, research, design, storyboard,
visual direction, course model, builds, reviews, screenshots, logs, versions and releases all live here.

- \`course.yaml\` — course settings (audience, risk tier, human review gates, backend preference)
- \`state.json\` — pipeline state (managed by CourseForge; do not edit)
- \`artifacts.json\` — artifact registry with hashes, provenance and semantic versions
- \`input/originals/\` — imported files, byte-for-byte and read-only
- \`versions/\` — snapshots of every artifact version
- \`logs/\` — execution plans, routing decisions and run events
- \`release/\` — the released single-file course and its QA and source reports

Use \`courseforge status --course ${id}\` to see where the course is and what to do next.
`;
}

function createCourse(
  id: string,
  title: string,
  extra: Partial<{ audience: string; duration: number; jurisdiction: string; language: string; start: Stage }> = {},
): string {
  const dir = courseDir(id);
  if (courseExists(id)) throw usageError(`Course "${id}" already exists`);
  ensureDir(dir);
  const manifest = CourseManifestSchema.parse({
    course: {
      id,
      title,
      language: extra.language ?? 'en',
      audience: extra.audience ?? null,
      target_duration_minutes: extra.duration ?? null,
      jurisdiction: extra.jurisdiction ?? null,
    },
    pipeline: { start_stage: extra.start ?? 'CONCEPT', target_stage: 'RELEASE' },
  });
  saveManifest(dir, manifest);
  saveState(dir, initialState(id, extra.start ?? 'CONCEPT', 'RELEASE', now()), now());
  writeAtomic(join(dir, COURSE_FILES.readme), courseReadme(title, id));
  logEvent(dir, { ts: now(), runId: null, stage: null, event: 'course.created', detail: { id, title } });
  return dir;
}

async function run(opts: Parameters<PipelineApi['run']>[0]): Promise<RunOutcome> {
  const ctx = await openContext({
    courseId: opts.courseId,
    backend: opts.backend,
    harness: opts.harness,
    gate: opts.gate,
    progress: progressSink(),
  });
  const from = opts.from ?? defaultFromStage(ctx);
  const to = opts.to ?? ctx.state.targetStage ?? ctx.manifest.pipeline.target_stage;
  if (opts.force && opts.from) {
    const st = ctx.state.stages[opts.from];
    if (st.status === 'LOCKED' || st.status === 'FAILED' || st.status === 'SUPERSEDED') {
      transitionStage(ctx.dir, ctx.state, opts.from, 'reset', now(), ctx.runId);
      st.mode = 'generate';
    }
  }
  return runRange(ctx, from, to, { force: opts.force });
}

let progressWriter: ((msg: string) => void) | null = null;
/** The CLI installs a progress printer; tests leave it silent. */
export function setProgressWriter(fn: ((msg: string) => void) | null): void {
  progressWriter = fn;
}
function progressSink(): (msg: string) => void {
  return (msg) => progressWriter?.(msg);
}

function listFindings(courseId: string, stage?: Stage): { stage: Stage; findings: Finding[] }[] {
  const dir = requireCourse(courseId);
  const stages = stage ? [stage] : [...STAGES];
  return stages.map((s) => ({ stage: s, findings: loadStageFindings({ dir }, s) }));
}

export const pipelineApi: PipelineApi = {
  async newCourse(opts) {
    const id = opts.id ?? slugify(opts.title);
    const dir = createCourse(id, opts.title, {
      audience: opts.audience,
      duration: opts.durationMinutes,
      jurisdiction: opts.jurisdiction,
      language: opts.language,
    });
    const notes = opts.notesFile ? readText(resolve(opts.notesFile)) : '';
    writeAtomic(
      join(dir, 'input/concept-request.md'),
      `# ${opts.title}\n\n${opts.audience ? `Audience: ${opts.audience}\n\n` : ''}${opts.durationMinutes ? `Target duration: ${opts.durationMinutes} minutes\n\n` : ''}${opts.jurisdiction ? `Jurisdiction: ${opts.jurisdiction}\n\n` : ''}${notes}\n`,
    );
    registerArtifact(dir, {
      stage: 'CONCEPT',
      path: 'input/concept-request.md',
      logicalKey: 'concept-request',
      producer: { kind: 'human' },
      event: 'imported',
      humanModified: true,
      now: now(),
    });
    const outcome = opts.runTo
      ? await run({ courseId: id, from: 'CONCEPT', to: opts.runTo, gate: opts.gate, backend: opts.backend, harness: opts.harness })
      : null;
    return { courseId: id, courseDir: dir, outcome };
  },

  async ingest(opts) {
    const file = resolve(opts.file);
    if (!exists(file)) throw usageError(`File not found: ${opts.file}`);
    const id = opts.courseId ?? slugify(basename(file).replace(/\.[^.]+$/, ''));
    const isNew = !courseExists(id);
    const dir = isNew
      ? createCourse(
          id,
          opts.title ??
            basename(file)
              .replace(/\.[^.]+$/, '')
              .replace(/[_-]+/g, ' '),
        )
      : requireCourse(id);
    const manifest = loadManifest(dir);
    const mode = opts.mode ?? (opts.conservative ? 'review-only' : manifest.improvement.default_import_mode);
    IntakeModeSchema.parse(mode);
    const { report, produced } = await ingestFile({
      filePath: file,
      courseDir: dir,
      courseId: id,
      declaredStage: opts.stage ?? null,
      mode,
      now: new Date(),
    });
    if (!opts.stage && report.inferred.confidence === 'low' && !opts.conservative) {
      throw new CfError(
        'LOW_CONFIDENCE',
        `Could not confidently infer the production stage of ${basename(file)} (best guess: ${report.inferred.stage ?? 'none'}). Re-run with --stage <stage> or --conservative (review-only). Evidence: ${report.inferred.evidence.slice(0, 3).join('; ')}`,
        { exitCode: EXIT.USAGE },
      );
    }
    const state = loadState(dir);
    const stage = report.acceptedStage;
    for (const p of produced) {
      registerArtifact(dir, {
        stage: p.stage,
        path: p.path,
        logicalKey: p.logicalKey,
        producer: { kind: opts.replace ? 'human' : 'imported' },
        event: opts.replace ? 'human-edited' : 'imported',
        humanModified: true,
        now: now(),
      });
      const rec = latest(loadRegistry(dir), p.logicalKey);
      if (rec) state.canonicalArtifacts[p.logicalKey] = rec.artifactId;
    }
    const st = state.stages[stage];
    if (st.status !== 'NOT_STARTED' && st.status !== 'INGESTED') {
      const trig =
        st.status === 'LOCKED' || st.status === 'FAILED' || st.status === 'SUPERSEDED' || st.status === 'WAITING_FOR_HUMAN'
          ? 'ingest'
          : null;
      if (!trig) throw usageError(`Stage ${stage} is ${st.status}; wait for the current run to finish before re-ingesting.`);
    }
    transitionStage(dir, state, stage, 'ingest', now(), null);
    st.mode = mode;
    st.gate = null;
    st.cyclesUsed = 0;
    // Everything downstream of a replaced artifact must be revisited.
    for (const s of STAGES.filter((x) => STAGES.indexOf(x) > STAGES.indexOf(stage))) {
      const d = state.stages[s];
      if (d.status === 'LOCKED') {
        transitionStage(dir, state, s, 'upstream-changed', now(), null);
        d.stale = { because: stage, at: now() };
      }
    }
    if (isNew || STAGES.indexOf(stage) < STAGES.indexOf(state.currentStage)) state.currentStage = stage;
    if (isNew) {
      manifest.pipeline.start_stage = stage;
      saveManifest(dir, manifest);
    }
    saveState(dir, state, now());
    logEvent(dir, {
      ts: now(),
      runId: null,
      stage,
      event: 'artifact.ingested',
      detail: { file: basename(file), mode, inferred: report.inferred.stage, confidence: report.inferred.confidence },
    });
    return { courseId: id, report };
  },

  run,

  async continueRun(opts) {
    return run({ courseId: opts.courseId, backend: opts.backend, harness: opts.harness });
  },

  async review(opts) {
    const dir = requireCourse(opts.courseId);
    const state = loadState(dir);
    const stage =
      opts.stage ??
      ([...STAGES].reverse().find((s) => state.stages[s].status !== 'NOT_STARTED' && s !== 'RELEASE') as Stage | undefined) ??
      'CONCEPT';
    const st = state.stages[stage];
    if (st.status === 'NOT_STARTED') throw usageError(`Stage ${stage} has no artifact to review yet.`);
    if (st.status !== 'INGESTED')
      transitionStage(
        dir,
        state,
        stage,
        st.status === 'WAITING_FOR_HUMAN' || st.status === 'LOCKED' || st.status === 'FAILED' || st.status === 'SUPERSEDED'
          ? 'ingest'
          : 'ingest',
        now(),
        null,
      );
    st.mode = 'review-only';
    saveState(dir, state, now());
    return run({ courseId: opts.courseId, from: stage, to: stage, backend: opts.backend, harness: opts.harness });
  },

  async improve(opts) {
    if (opts.input) {
      const { courseId } = await pipelineApi.ingest({
        file: opts.input,
        courseId: opts.courseId,
        mode: 'improve',
        backend: opts.backend,
        harness: opts.harness,
      });
      return run({ courseId, to: opts.to ?? 'RELEASE', backend: opts.backend, harness: opts.harness });
    }
    const dir = requireCourse(opts.courseId);
    const state = loadState(dir);
    if (!exists(join(dir, COURSE_FILES.buildHtml)))
      throw usageError('Nothing to improve yet: build the course first or pass --input <file>.');
    const qa = state.stages.COURSE_QA;
    if (qa.status !== 'NOT_STARTED') transitionStage(dir, state, 'COURSE_QA', qa.status === 'INGESTED' ? 'ingest' : 'ingest', now(), null);
    else transitionStage(dir, state, 'COURSE_QA', 'ingest', now(), null);
    qa.mode = 'improve';
    saveState(dir, state, now());
    return run({ courseId: opts.courseId, from: 'COURSE_QA', to: opts.to ?? 'RELEASE', backend: opts.backend, harness: opts.harness });
  },

  async status(opts): Promise<StatusReport> {
    const dir = requireCourse(opts.courseId);
    const manifest = loadManifest(dir);
    const state = loadState(dir);
    const reg = loadRegistry(dir);
    const stages = STAGES.map((s) => {
      const st = state.stages[s];
      const findings = loadStageFindings({ dir }, s);
      return {
        stage: s,
        status: st.status,
        mode: st.mode,
        cyclesUsed: st.cyclesUsed,
        gate: st.gate,
        canonical: listArtifacts(reg)
          .filter((a) => a.stage === s && !a.supersededBy)
          .map((a) => `${a.path} (${a.label})`),
        openFindings: findings.filter((f) => f.status === 'open' || f.status === 'accepted' || f.status === 'deferred').length,
        failure: st.failure ? `${st.failure.kind}: ${st.failure.message}` : null,
      };
    });
    const waiting = stages.find((s) => s.status === 'WAITING_FOR_HUMAN');
    const failed = stages.find((s) => s.status === 'FAILED');
    const nextAction = waiting
      ? `Review ${waiting.stage} (${waiting.gate?.reason}), then: courseforge gate approve --course ${opts.courseId} --stage ${waiting.stage.toLowerCase()}`
      : failed
        ? `Fix the cause of the ${failed.stage} failure, then: courseforge continue --course ${opts.courseId}`
        : stages.every((s) => s.status === 'LOCKED' || s.status === 'NOT_STARTED') && state.stages.RELEASE.status === 'LOCKED'
          ? `Released: ${COURSE_FILES.releaseHtml}`
          : `courseforge continue --course ${opts.courseId}`;
    return {
      courseId: opts.courseId,
      title: manifest.course.title,
      riskTier: manifest.course.risk_tier,
      currentStage: state.currentStage,
      targetStage: state.targetStage,
      activeRunId: state.activeRunId,
      stages,
      nextAction,
    };
  },

  async gate(opts) {
    const dir = requireCourse(opts.courseId);
    const state = loadState(dir);
    const st = state.stages[opts.stage];
    const by = opts.by ?? process.env.USERNAME ?? process.env.USER ?? 'human';
    const t = now();
    switch (opts.action) {
      case 'approve':
      case 'reject':
      case 'rereview': {
        if (st.status !== 'WAITING_FOR_HUMAN' || !st.gate)
          throw usageError(`Stage ${opts.stage} is not waiting for human review (status ${st.status}).`);
        if (opts.action === 'approve') st.gate = { ...st.gate, status: 'approved', decidedAt: t, decidedBy: by };
        else if (opts.action === 'reject' && opts.abort) {
          st.gate = { ...st.gate, status: 'rejected', decidedAt: t, decidedBy: by };
          transitionStage(dir, state, opts.stage, 'human-abort', t, null);
          st.failure = { kind: 'validator_failed', message: `Rejected by ${by}${opts.text ? `: ${opts.text}` : ''}`, at: t };
        } else
          st.gate = {
            ...st.gate,
            status: 'rejected',
            decidedAt: t,
            decidedBy: by,
            instructions: opts.action === 'reject' ? (opts.instructions ?? opts.text ?? null) : null,
          };
        break;
      }
      case 'comment': {
        const gate = st.gate ?? {
          mode: 'human' as const,
          status: 'approved' as const,
          reason: 'policy' as const,
          openedAt: t,
          decidedAt: t,
          decidedBy: by,
          reportPath: null,
          instructions: null,
          comments: [],
          findingDecisions: {},
        };
        gate.comments.push({ at: t, by, text: opts.text ?? '', targetId: opts.ids?.[0] ?? null });
        st.gate = gate;
        break;
      }
      case 'lock':
      case 'unlock': {
        if (!opts.ids?.length) throw usageError('--ids is required for lock/unlock');
        const reg = loadRegistry(dir);
        const keys = ['storyboard-edited', 'storyboard', 'design', 'dossier', 'visual-specs', 'research-brief', 'concept'];
        const rec =
          keys.map((k) => latest(reg, k)).find((r) => r && r.stage === opts.stage) ?? keys.map((k) => latest(reg, k)).find((r) => !!r);
        if (!rec) throw usageError(`No lockable artifact found for ${opts.stage}`);
        if (opts.action === 'lock') addLockedIds(dir, rec.artifactId, opts.ids);
        else removeLockedIds(dir, rec.artifactId, opts.ids);
        logEvent(dir, {
          ts: t,
          runId: null,
          stage: opts.stage,
          event: `ids.${opts.action}`,
          detail: { artifact: rec.artifactId, ids: opts.ids, by },
        });
        break;
      }
    }
    saveState(dir, state, t);
    logEvent(dir, { ts: t, runId: null, stage: opts.stage, event: `gate.${opts.action}`, detail: { by, text: opts.text ?? null } });
    return st.gate;
  },

  async findings(opts) {
    const groups = listFindings(opts.courseId, opts.stage);
    if (opts.action === 'list') return groups.flatMap((g) => g.findings);
    const ids = new Set(opts.ids ?? []);
    if (!ids.size) throw usageError('--ids is required');
    const dir = requireCourse(opts.courseId);
    const state = loadState(dir);
    const decision = opts.action === 'accept' ? 'accepted' : 'rejected';
    const touched: Finding[] = [];
    for (const g of groups) {
      let changed = false;
      for (const f of g.findings)
        if (ids.has(f.findingId)) {
          f.status = decision === 'accepted' ? 'accepted' : 'waived';
          changed = true;
          touched.push(f);
          const st = state.stages[g.stage];
          st.gate = st.gate ?? {
            mode: 'human',
            status: 'approved',
            reason: 'policy',
            openedAt: now(),
            decidedAt: now(),
            decidedBy: opts.by ?? 'human',
            reportPath: null,
            instructions: null,
            comments: [],
            findingDecisions: {},
          };
          st.gate.findingDecisions[f.findingId] = decision;
        }
      if (changed) saveStageFindings({ dir }, g.stage, g.findings);
    }
    saveState(dir, state, now());
    logEvent(dir, {
      ts: now(),
      runId: null,
      stage: null,
      event: `findings.${opts.action}`,
      detail: { ids: [...ids], by: opts.by ?? null },
    });
    return touched;
  },

  async versions(opts) {
    const dir = requireCourse(opts.courseId);
    const reg = loadRegistry(dir);
    if (opts.action === 'list')
      return listArtifacts(reg).map((a) => ({
        artifactId: a.artifactId,
        label: a.label,
        path: a.path,
        producer: a.producer.kind,
        hash: a.hash,
        supersededBy: a.supersededBy,
        approval: a.approval,
      }));
    const label = opts.label ?? (opts.artifactId ? reg.artifacts[opts.artifactId]?.label : undefined);
    if (!label) throw usageError('--label or --artifact is required');
    const rec = restoreVersion(dir, label, now());
    const state = loadState(dir);
    const st = state.stages[rec.stage];
    if (st.status !== 'NOT_STARTED') transitionStage(dir, state, rec.stage, 'ingest', now(), null);
    st.mode = 'preserve';
    state.canonicalArtifacts[rec.logicalKey] = rec.artifactId;
    saveState(dir, state, now());
    return rec;
  },

  async trace(opts) {
    const dir = requireCourse(opts.courseId);
    const g = buildTraceGraph(dir);
    if (opts.impactIds?.length) return impact(g, opts.impactIds);
    if (!opts.id) throw usageError('--id or --impact is required');
    return trace(g, opts.id, opts.direction ?? 'up', opts.depth);
  },

  async packageCourse(opts) {
    const dir = requireCourse(opts.courseId);
    const out = resolve(opts.out ?? join(localStateDir(), 'packages', `${opts.courseId}.zip`));
    ensureDir(dirname(out));
    const { zipDirectory } = await import('./zip.js');
    const buf = zipDirectory(dir, opts.courseId, ['.lock', 'logs/tasks']);
    writeFileSync(out, buf);
    return { path: out, bytes: buf.length };
  },

  async clean(opts) {
    const removed: string[] = [];
    const targets: string[] = [];
    const courses = opts.courseId ? [opts.courseId] : exists(coursesDir()) ? readdirSync(coursesDir()).filter((d) => courseExists(d)) : [];
    for (const id of courses) {
      const dir = courseDir(id);
      if (opts.build || (!opts.build && !opts.cache)) targets.push(join(dir, 'logs/tasks'), join(dir, '.cache'));
      if (opts.build) targets.push(join(dir, 'build'));
    }
    if (opts.cache || !opts.courseId)
      targets.push(join(localStateDir(), 'wire-schemas'), join(localStateDir(), 'smoke'), join(localStateDir(), 'packages'));
    const root = repoRoot();
    for (const t of targets) {
      if (!t.startsWith(root) && !t.startsWith(coursesDir())) continue;
      if (!exists(t)) continue;
      if (!opts.dryRun) removePath(t);
      removed.push(t);
    }
    return { removed };
  },

  async listCourses() {
    const root = coursesDir();
    if (!exists(root)) return [];
    return readdirSync(root)
      .filter((d) => statSync(join(root, d)).isDirectory() && courseExists(d))
      .map((d) => {
        const state = loadState(courseDir(d));
        const manifest = loadManifest(courseDir(d));
        return {
          courseId: d,
          title: manifest.course.title,
          currentStage: state.currentStage,
          status: state.stages[state.currentStage].status,
        };
      });
  },

  async smoke(opts) {
    return runSmoke(opts.outDir);
  },
};
