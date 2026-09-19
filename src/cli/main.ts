/**
 * CourseForge CLI: parses argv, dispatches to the PipelineApi (or the local doctor/setup commands) and maps
 * results/errors to exit codes. Returns the exit code instead of exiting so tests can call it in-process.
 */

import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { basename, join, resolve } from 'node:path';
import {
  BackendPreferenceSchema,
  EXIT,
  GateModeInputSchema,
  HarnessNameSchema,
  IntakeModeSchema,
  STAGES,
  type Stage,
} from '../core/enums.js';
import { CfError, usageError } from '../core/errors.js';
import { readJson } from '../core/fsx.js';
import { slugify } from '../core/ids.js';
import { COURSE_FILES, courseDir, localStateDir, repoRoot } from '../core/paths.js';
import { type GuidanceConfig, type ReviewLevel, trackingUnfinished } from '../core/schemas/index.js';
import type { EnvironmentManifest } from '../core/schemas/reports.js';
import { type DoctorOptions, runDoctor } from '../environment/doctor.js';
import { formatDoctor, useColor } from '../environment/format.js';
import { loadConfigValidator } from '../environment/probe.js';
import {
  type GateAction,
  type HarnessOptions,
  loadPipelineApi,
  type PipelineApi,
  type RunOutcome,
  type SetupAnswers,
  type SetupInfo,
} from '../pipeline/api.js';
import { fillMessage } from '../pipeline/setup.js';
import { flag, type OptionSpec, optEnum, optInt, optList, optStage, parseCommand, required, str, type Values } from './args.js';
import { helpText } from './help.js';
import { formatCourseList, formatFindings, formatGate, formatIntake, formatJson, formatOutcome, formatStatus } from './output.js';

export interface OutStream {
  write(chunk: string): unknown;
  isTTY?: boolean;
}
export interface CliIo {
  stdout: OutStream;
  stderr: OutStream;
  /** Keyboard input for the setup wizard; the wizard runs only when this and stdout are terminals. */
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean };
}
export interface MainOverrides {
  api?: PipelineApi;
  doctor?: (opts: DoctorOptions) => Promise<EnvironmentManifest>;
  /** Scripted wizard replies (tests). When set, the wizard runs as if in a terminal. */
  ask?: (prompt: string) => Promise<string>;
  /** Replaces the network call of the wizard's connection test (tests). */
  testEndpoint?: (url: string) => Promise<string | null>;
}

interface Ctx {
  values: Values;
  positionals: string[];
  json: boolean;
  io: CliIo;
  api: () => Promise<PipelineApi>;
  doctor: (opts: DoctorOptions) => Promise<EnvironmentManifest>;
  overrides: MainOverrides;
}

interface Command {
  options: OptionSpec;
  positionals?: number;
  run(ctx: Ctx): Promise<number>;
}

const S = { type: 'string' } as const;
const B = { type: 'boolean' } as const;
const HARNESS: OptionSpec = { backend: S, harness: S };
const COURSE: OptionSpec = { course: S };

function print(ctx: Ctx, data: unknown, text: () => string): void {
  ctx.io.stdout.write(`${ctx.json ? formatJson(data) : text()}\n`);
}

const harnessOpts = (v: Values): HarnessOptions => ({
  backend: optEnum(BackendPreferenceSchema, v, 'backend'),
  harness: optEnum(HarnessNameSchema, v, 'harness'),
});

function outcome(ctx: Ctx, o: RunOutcome): number {
  print(ctx, o, () => formatOutcome(o));
  return o.exitCode;
}

/** The wizard runs only for a person at a terminal: never with --json, --defaults or redirected input/output. */
function interactive(ctx: Ctx): boolean {
  if (ctx.json || flag(ctx.values, 'defaults')) return false;
  return !!ctx.overrides.ask || (!!ctx.io.stdin?.isTTY && !!ctx.io.stdout.isTTY);
}

/** Runs the setup wizard with a line reader on stdin (or the scripted replies in tests). */
async function wizard(ctx: Ctx, info: SetupInfo, reconfigure: boolean): Promise<SetupAnswers> {
  const { runWizard } = await import('./wizard.js');
  const write = (t: string) => void ctx.io.stdout.write(t);
  const testEndpoint = ctx.overrides.testEndpoint ?? sendTestResult;
  const base = { guidance: info.guidance, courseId: info.courseId, title: info.title, current: info.answers, reconfigure, testEndpoint };
  if (ctx.overrides.ask) return runWizard({ ...base, io: { ask: ctx.overrides.ask, write } });
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: ctx.io.stdin as NodeJS.ReadableStream, output: ctx.io.stdout as NodeJS.WritableStream });
  let closed = false;
  const onClose = new Promise<string>((r) =>
    rl.once('close', () => {
      closed = true;
      r('');
    }),
  );
  const ask = (q: string) =>
    closed
      ? Promise.resolve('')
      : Promise.race([
          rl.question(q).then(
            (a) => a.trim(),
            () => '',
          ),
          onClose,
        ]);
  try {
    return await runWizard({ ...base, io: { ask, write } });
  } finally {
    rl.close();
  }
}

/** Posts the setup test result and reads the reply (Google Apps Script and the tracker both answer {"ok":true}). */
async function sendTestResult(url: string): Promise<string | null> {
  const event = {
    v: 1,
    courseId: 'courseforge-setup-test',
    courseTitle: 'CourseForge setup test',
    courseVersion: '0',
    learner: { name: 'CourseForge setup test', id: null, email: null },
    percent: null,
    passed: null,
    correct: 0,
    total: 0,
    completedAt: new Date().toISOString(),
    attempt: 1,
    test: true,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(event),
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return `the address answered with error ${res.status}`;
    return /"ok"\s*:\s*true/.test(await res.text()) ? null : 'the address answered, but not like a results connection';
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Plain-language lines printed after setup answers were saved. */
function setupSummary(g: GuidanceConfig, courseId: string, r: { guides: string[]; unfinished?: boolean; invalidated?: Stage[] }): string[] {
  const out: string[] = [];
  if (r.guides.length) out.push(fillMessage(g.messages.guides, { files: `\n  ${r.guides.join('\n  ')}` }));
  if (r.unfinished) out.push(fillMessage(g.messages.unfinished, { id: courseId }));
  if (r.invalidated?.length) out.push(fillMessage(g.messages.rebuild, { id: courseId }));
  return out;
}

function action<T extends string>(ctx: Ctx, allowed: readonly T[], command: string): T {
  const a = ctx.positionals[0];
  if (!a || !(allowed as readonly string[]).includes(a)) throw usageError(`${command}: expected one of ${allowed.join('|')}`);
  return a as T;
}

/** `build`, `qa`, `release`: sugar for `run --from <stage> --to <stage>`. */
const stageRun = (stage: Stage): Command => ({
  options: { ...COURSE, ...HARNESS, gate: S, force: B },
  run: async (ctx) => {
    const v = ctx.values;
    const api = await ctx.api();
    return outcome(
      ctx,
      await api.run({
        courseId: required(v, 'course', stage.toLowerCase()),
        from: stage,
        to: stage,
        gate: optEnum(GateModeInputSchema, v, 'gate'),
        force: flag(v, 'force'),
        ...harnessOpts(v),
      }),
    );
  },
});

/** `configure` / `reconfigure`: re-run the setup wizard for an existing course, current answers preselected. */
function configureCommand(): Command {
  return {
    options: { ...COURSE },
    run: async (ctx) => {
      const courseId = required(ctx.values, 'course', 'configure');
      const api = await ctx.api();
      const info = await api.setupInfo({ courseId });
      if (!info.exists) throw usageError(`Course "${courseId}" not found. Create it with \`courseforge new\` or \`courseforge ingest\`.`);
      if (!interactive(ctx))
        throw usageError(
          'configure asks questions, so it needs an interactive terminal (and no --json). Settings can also be edited in course.yaml.',
        );
      const answers = await wizard(ctx, info, info.configured);
      const res = await api.configure({ courseId, answers });
      print(ctx, res, () =>
        ['', fillMessage(info.guidance.messages.done, { file: res.manifestPath }), ...setupSummary(info.guidance, courseId, res)].join(
          '\n',
        ),
      );
      return EXIT.OK;
    },
  };
}

const REVIEW_FLAG: Record<string, ReviewLevel> = {
  'one-shot': 'one_shot',
  one_shot: 'one_shot',
  recommended: 'recommended',
  'every-step': 'every_step',
  every_step: 'every_step',
  strict: 'strict',
};

/**
 * `make`: everything the author has in, a finished course out. Arguments that are existing files or folders are
 * material; everything else is the prompt. A new course gets the setup questions first (or `--review` without them).
 */
const makeCommand: Command = {
  positionals: 100,
  options: { ...COURSE, ...HARNESS, title: S, id: S, review: S, defaults: B },
  run: async (ctx) => {
    const v = ctx.values;
    const paths = ctx.positionals.filter((a) => existsSync(a));
    const prompt = ctx.positionals.filter((a) => !existsSync(a)).join(' ');
    const reviewFlag = str(v, 'review');
    const review = reviewFlag === undefined ? undefined : REVIEW_FLAG[reviewFlag];
    if (reviewFlag !== undefined && !review) throw usageError('make: --review must be one-shot, recommended, every-step or strict');
    const courseId = str(v, 'course');
    const api = await ctx.api();
    let setup: SetupAnswers | undefined;
    const { titleFrom } = await import('../pipeline/make.js');
    const title = str(v, 'title') ?? titleFrom(prompt, paths[0] ? basename(paths[0]) : '');
    const info = await api.setupInfo({ title });
    if (!courseId) {
      if (review) info.answers = { ...info.answers, review };
      if (interactive(ctx)) setup = await wizard(ctx, info, false);
      else if (review) setup = info.answers;
    }
    const what = courseId
      ? `course ${courseId}`
      : paths.length
        ? `${paths.length} file(s) or folder(s)${prompt ? ' and your description' : ''}`
        : 'your description';
    if (!ctx.json) ctx.io.stderr.write(`${fillMessage(info.guidance.messages.makeStart, { title: courseId ?? title, what })}\n`);
    const res = await api.make({ prompt, paths, title: str(v, 'title'), id: str(v, 'id'), courseId, setup, ...harnessOpts(v) });
    const o = res.outcome;
    print(ctx, res, () => {
      const lines = [formatOutcome(o)];
      if (res.truncated) lines.push('Note: your documents were very long, so only the first part of them was used.');
      if (setup) lines.push(...setupSummary(info.guidance, res.courseId, { guides: res.guides, unfinished: trackingUnfinished(setup) }));
      if (o.status === 'waiting' && o.stoppedAt === 'RELEASE')
        lines.push(
          '',
          fillMessage(info.guidance.messages.signoff, { id: res.courseId, file: join(courseDir(res.courseId), COURSE_FILES.buildHtml) }),
        );
      return lines.join('\n');
    });
    return o.exitCode;
  },
};

const COMMANDS: Record<string, Command> = {
  doctor: {
    options: { repair: B, only: S, live: B },
    run: async (ctx) => {
      const m = await ctx.doctor({ repair: flag(ctx.values, 'repair'), only: optList(ctx.values, 'only') });
      const live = flag(ctx.values, 'live') ? await (await import('../environment/canary.js')).runCanary(repoRoot()) : null;
      print(ctx, live ? { ...m, live } : m, () =>
        [
          formatDoctor(m, { color: useColor(ctx.io.stdout) }).trimEnd(),
          ...(live
            ? ['', 'Live canary (one small model call per backend)', ...live.map((c) => `  ${c.ok ? '✓' : '✗'} ${c.backend}: ${c.detail}`)]
            : []),
        ].join('\n'),
      );
      const liveOk = !live || live.some((c) => c.ok);
      return m.status === 'ready' && liveOk ? EXIT.OK : EXIT.ENVIRONMENT;
    },
  },
  setup: {
    options: { 'no-smoke': B },
    run: async (ctx) => {
      const env = await ctx.doctor({ repair: true });
      if (!ctx.json) ctx.io.stdout.write(formatDoctor(env, { color: useColor(ctx.io.stdout), final: false }));
      let smoke: Awaited<ReturnType<PipelineApi['smoke']>> | null = null;
      if (env.status === 'ready' && !flag(ctx.values, 'no-smoke')) smoke = await (await ctx.api()).smoke({});
      const ready = env.status === 'ready' && (smoke === null || smoke.ok);
      print(ctx, { ready, environment: env, smoke }, () =>
        [
          ...(smoke ? ['', 'Smoke fixture', ...smoke.steps.map((s) => `  ${s.ok ? '✓' : '✗'} ${s.name}: ${s.detail}`)] : []),
          '',
          ready ? 'READY' : env.status === 'ready' ? 'ACTION REQUIRED — smoke fixture failed' : 'ACTION REQUIRED — see next steps above',
        ].join('\n'),
      );
      return ready ? EXIT.OK : EXIT.ENVIRONMENT;
    },
  },
  'validate-config': {
    options: {},
    run: async (ctx) => {
      const validate = await loadConfigValidator();
      if (!validate)
        throw new CfError('ROUTING_UNAVAILABLE', 'routing module not available (src/routing/registries)', { exitCode: EXIT.ENVIRONMENT });
      const res = validate() as { ok?: unknown; errors?: unknown } | undefined;
      const ok = !(res && res.ok === false);
      print(ctx, res ?? { ok: true }, () => (ok ? 'config valid' : `config invalid:\n${formatJson(res?.errors ?? res)}`));
      return ok ? EXIT.OK : EXIT.USAGE;
    },
  },
  new: {
    positionals: 1,
    options: {
      ...HARNESS,
      id: S,
      notes: S,
      audience: S,
      duration: S,
      jurisdiction: S,
      language: S,
      to: S,
      gate: S,
      defaults: B,
    },
    run: async (ctx) => {
      const v = ctx.values;
      const title = ctx.positionals[0];
      if (!title) throw usageError('new: a course title is required');
      const api = await ctx.api();
      let setup: SetupAnswers | undefined;
      let guidance: GuidanceConfig | undefined;
      if (interactive(ctx)) {
        const info = await api.setupInfo({ courseId: str(v, 'id') ?? slugify(title), title });
        if (info.exists) throw usageError(`Course "${info.courseId}" already exists`);
        guidance = info.guidance;
        info.answers = {
          ...info.answers,
          language: str(v, 'language') ?? info.answers.language,
          audience: str(v, 'audience') ?? info.answers.audience,
        };
        setup = await wizard(ctx, info, false);
      }
      const res = await api.newCourse({
        setup,
        title,
        id: str(v, 'id'),
        notesFile: str(v, 'notes'),
        audience: str(v, 'audience'),
        durationMinutes: optInt(v, 'duration'),
        jurisdiction: str(v, 'jurisdiction'),
        language: str(v, 'language'),
        runTo: optStage(v, 'to'),
        gate: optEnum(GateModeInputSchema, v, 'gate'),
        ...harnessOpts(v),
      });
      print(ctx, res, () =>
        [
          `created ${res.courseId} at ${res.courseDir}`,
          ...(guidance && setup ? setupSummary(guidance, res.courseId, { guides: res.guides, unfinished: trackingUnfinished(setup) }) : []),
          res.outcome ? formatOutcome(res.outcome) : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return res.outcome?.exitCode ?? EXIT.OK;
    },
  },
  ingest: {
    positionals: 1,
    options: { ...COURSE, ...HARNESS, title: S, stage: S, mode: S, replace: B, conservative: B, defaults: B },
    run: async (ctx) => {
      const v = ctx.values;
      const file = ctx.positionals[0];
      if (!file) throw usageError('ingest: a file is required');
      const api = await ctx.api();
      let setup: SetupAnswers | undefined;
      if (interactive(ctx)) {
        const target = await api.ingestTarget({ file, courseId: str(v, 'course'), title: str(v, 'title') });
        if (target.isNew) setup = await wizard(ctx, await api.setupInfo({ courseId: target.courseId, title: target.title }), false);
      }
      const res = await api.ingest({
        setup,
        file,
        courseId: str(v, 'course'),
        title: str(v, 'title'),
        stage: optStage(v, 'stage'),
        mode: optEnum(IntakeModeSchema, v, 'mode'),
        replace: flag(v, 'replace'),
        conservative: flag(v, 'conservative'),
        ...harnessOpts(v),
      });
      const guidance = ctx.json ? null : (await api.setupInfo({ courseId: res.courseId })).guidance;
      print(ctx, res, () => {
        if (!guidance) return formatIntake(res.courseId, res.report);
        const stage = guidance.stages[res.report.acceptedStage];
        return [
          formatIntake(res.courseId, res.report),
          fillMessage(guidance.messages.landing, { number: STAGES.indexOf(res.report.acceptedStage) + 1, ...stage }),
          ...(setup ? setupSummary(guidance, res.courseId, { guides: res.guides, unfinished: trackingUnfinished(setup) }) : []),
        ].join('\n');
      });
      return EXIT.OK;
    },
  },
  make: makeCommand,
  configure: configureCommand(),
  reconfigure: configureCommand(),
  run: {
    options: { ...COURSE, ...HARNESS, from: S, to: S, gate: S, force: B },
    run: async (ctx) => {
      const v = ctx.values;
      return outcome(
        ctx,
        await (await ctx.api()).run({
          courseId: required(v, 'course', 'run'),
          from: optStage(v, 'from'),
          to: optStage(v, 'to'),
          gate: optEnum(GateModeInputSchema, v, 'gate'),
          force: flag(v, 'force'),
          ...harnessOpts(v),
        }),
      );
    },
  },
  continue: {
    options: { ...COURSE, ...HARNESS },
    run: async (ctx) =>
      outcome(
        ctx,
        await (await ctx.api()).continueRun({ courseId: required(ctx.values, 'course', 'continue'), ...harnessOpts(ctx.values) }),
      ),
  },
  review: {
    options: { ...COURSE, ...HARNESS, stage: S },
    run: async (ctx) =>
      outcome(
        ctx,
        await (await ctx.api()).review({
          courseId: required(ctx.values, 'course', 'review'),
          stage: optStage(ctx.values, 'stage'),
          ...harnessOpts(ctx.values),
        }),
      ),
  },
  improve: {
    options: { ...COURSE, ...HARNESS, input: S, to: S },
    run: async (ctx) =>
      outcome(
        ctx,
        await (await ctx.api()).improve({
          courseId: required(ctx.values, 'course', 'improve'),
          input: str(ctx.values, 'input'),
          to: optStage(ctx.values, 'to'),
          ...harnessOpts(ctx.values),
        }),
      ),
  },
  status: {
    options: COURSE,
    run: async (ctx) => {
      const api = await ctx.api();
      const courseId = str(ctx.values, 'course');
      if (!courseId) {
        const list = await api.listCourses();
        print(ctx, list, () => formatCourseList(list));
      } else {
        const s = await api.status({ courseId });
        print(ctx, s, () => formatStatus(s));
      }
      return EXIT.OK;
    },
  },
  list: {
    options: {},
    run: async (ctx) => {
      const list = await (await ctx.api()).listCourses();
      print(ctx, list, () => formatCourseList(list));
      return EXIT.OK;
    },
  },
  gate: {
    positionals: 1,
    options: { ...COURSE, stage: S, by: S, text: S, ids: S, abort: B, instructions: S },
    run: async (ctx) => {
      const v = ctx.values;
      const a = action<GateAction>(ctx, ['approve', 'reject', 'comment', 'lock', 'unlock', 'rereview'], 'gate');
      const stage = optStage(v, 'stage');
      if (!stage) throw usageError('gate: --stage is required');
      const g = await (await ctx.api()).gate({
        courseId: required(v, 'course', 'gate'),
        stage,
        action: a,
        by: str(v, 'by'),
        text: str(v, 'text'),
        ids: optList(v, 'ids'),
        abort: flag(v, 'abort'),
        instructions: str(v, 'instructions'),
      });
      print(ctx, g, () => formatGate(g));
      return EXIT.OK;
    },
  },
  findings: {
    positionals: 1,
    options: { ...COURSE, stage: S, ids: S, by: S },
    run: async (ctx) => {
      const v = ctx.values;
      const f = await (await ctx.api()).findings({
        courseId: required(v, 'course', 'findings'),
        action: action(ctx, ['list', 'accept', 'reject'] as const, 'findings'),
        stage: optStage(v, 'stage'),
        ids: optList(v, 'ids'),
        by: str(v, 'by'),
      });
      print(ctx, f, () => formatFindings(f));
      return EXIT.OK;
    },
  },
  versions: {
    positionals: 1,
    options: { ...COURSE, label: S, artifact: S },
    run: async (ctx) => {
      const v = ctx.values;
      const res = await (await ctx.api()).versions({
        courseId: required(v, 'course', 'versions'),
        action: action(ctx, ['list', 'restore', 'select'] as const, 'versions'),
        label: str(v, 'label'),
        artifactId: str(v, 'artifact'),
      });
      print(ctx, res, () => formatJson(res));
      return EXIT.OK;
    },
  },
  trace: {
    options: { ...COURSE, id: S, direction: S, depth: S, impact: S },
    run: async (ctx) => {
      const v = ctx.values;
      const direction = str(v, 'direction');
      if (direction !== undefined && direction !== 'up' && direction !== 'down') throw usageError('trace: --direction must be up or down');
      const res = await (await ctx.api()).trace({
        courseId: required(v, 'course', 'trace'),
        id: str(v, 'id'),
        direction,
        depth: optInt(v, 'depth'),
        impactIds: optList(v, 'impact'),
      });
      print(ctx, res, () => formatJson(res));
      return EXIT.OK;
    },
  },
  build: stageRun('COURSE_BUILD'),
  qa: stageRun('COURSE_QA'),
  release: stageRun('RELEASE'),
  package: {
    options: { ...COURSE, out: S, scorm: B },
    run: async (ctx) => {
      const res = await (await ctx.api()).packageCourse({
        courseId: required(ctx.values, 'course', 'package'),
        out: str(ctx.values, 'out'),
        scorm: flag(ctx.values, 'scorm'),
      });
      print(ctx, res, () => `packaged ${res.path} (${res.bytes} bytes)`);
      return EXIT.OK;
    },
  },
  tracker: {
    options: { port: S, host: S, data: S },
    run: async (ctx) => {
      const v = ctx.values;
      const password = process.env.COURSEFORGE_TRACKER_PASSWORD;
      if (!password)
        throw new CfError(
          'TRACKER_PASSWORD',
          'Choose a password for the results dashboard and put it in the COURSEFORGE_TRACKER_PASSWORD environment variable, then run this again.',
          { exitCode: EXIT.ENVIRONMENT },
        );
      const host = str(v, 'host') ?? '127.0.0.1';
      const dataDir = resolve(str(v, 'data') ?? join(localStateDir(), 'tracker'));
      const { createTrackerServer } = await import('../tracker/server.js');
      const server = createTrackerServer({ dataDir, password });
      await new Promise<void>((ok, fail) => {
        server.once('error', fail);
        server.listen(optInt(v, 'port') ?? 8787, host, ok);
      });
      const { port } = server.address() as AddressInfo;
      const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
      const info = { dashboard: `http://${shown}:${port}/`, endpoint: `http://${shown}:${port}/api/events`, dataDir };
      print(ctx, info, () =>
        [
          `Results dashboard running at ${info.dashboard} (sign in with any user name and your password)`,
          `Courses send results to ${info.endpoint}`,
          `Results are saved in ${join(dataDir, 'results.jsonl')}`,
          'Press Ctrl+C to stop.',
        ].join('\n'),
      );
      await new Promise<void>((done) => {
        const stop = () => server.close(() => done());
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
      });
      return EXIT.OK;
    },
  },
  clean: {
    options: { ...COURSE, build: B, cache: B, 'dry-run': B },
    run: async (ctx) => {
      const v = ctx.values;
      const dryRun = flag(v, 'dry-run');
      const res = await (await ctx.api()).clean({ courseId: str(v, 'course'), build: flag(v, 'build'), cache: flag(v, 'cache'), dryRun });
      print(ctx, res, () =>
        res.removed.length ? `${dryRun ? 'would remove' : 'removed'}:\n${res.removed.map((r) => `  ${r}`).join('\n')}` : 'nothing to clean',
      );
      return EXIT.OK;
    },
  },
  smoke: {
    options: { out: S },
    run: async (ctx) => {
      const res = await (await ctx.api()).smoke({ outDir: str(ctx.values, 'out') });
      print(ctx, res, () =>
        [...res.steps.map((s) => `  ${s.ok ? '✓' : '✗'} ${s.name}: ${s.detail}`), res.ok ? 'smoke passed' : 'smoke FAILED'].join('\n'),
      );
      return res.ok ? EXIT.OK : EXIT.ENVIRONMENT;
    },
  },
  version: {
    options: {},
    run: async (ctx) => {
      const pkg = readJson<{ version?: string }>(join(repoRoot(), 'package.json'));
      const info = { courseforge: pkg.version ?? 'unknown', node: process.versions.node };
      print(ctx, info, () => `courseforge ${info.courseforge} (node ${info.node})`);
      return EXIT.OK;
    },
  },
  help: {
    positionals: 1,
    options: {},
    run: async (ctx) => {
      const cmd = ctx.positionals[0];
      if (cmd && !COMMANDS[cmd]) throw usageError(`unknown command "${cmd}"`);
      ctx.io.stdout.write(helpText(cmd));
      return EXIT.OK;
    },
  },
};

function exitCodeOf(err: unknown): number {
  const code = (err as { exitCode?: unknown } | null)?.exitCode;
  return typeof code === 'number' && Number.isInteger(code) ? code : EXIT.INTERNAL;
}

export async function main(
  argv: string[],
  io: CliIo = { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin },
  overrides: MainOverrides = {},
): Promise<number> {
  const json = argv.includes('--json');
  const [name, ...rest] = argv;
  try {
    if (!name || name === '--help' || name === '-h') {
      io.stdout.write(helpText());
      return name ? EXIT.OK : EXIT.USAGE;
    }
    if (name === '--version') return await main(['version', ...rest], io, overrides);
    const cmd = COMMANDS[name];
    if (!cmd) throw usageError(`unknown command "${name}". Run \`courseforge help\`.`);
    const { values, positionals } = parseCommand(
      rest,
      { ...cmd.options, json: B, help: { type: 'boolean', short: 'h' } },
      cmd.positionals ?? 0,
      name,
    );
    if (values.help === true) {
      io.stdout.write(helpText(name));
      return EXIT.OK;
    }
    return await cmd.run({
      values,
      positionals,
      json,
      io,
      api: () =>
        overrides.api
          ? Promise.resolve(overrides.api)
          : loadPipelineApi(
              json
                ? undefined
                : (line) =>
                    io.stderr.write(`  · ${line}
`),
            ),
      doctor: overrides.doctor ?? runDoctor,
      overrides,
    });
  } catch (err) {
    const exitCode = exitCodeOf(err);
    const known = exitCode !== EXIT.INTERNAL || (err as { name?: unknown } | null)?.name === 'CfError';
    const message = err instanceof Error ? err.message : String(err);
    io.stderr.write(`courseforge: ${known ? '' : 'internal error: '}${message}\n`);
    if (process.env.COURSEFORGE_DEBUG === '1' && err instanceof Error && err.stack) io.stderr.write(`${err.stack}\n`);
    if (json) {
      const code = (err as { code?: unknown } | null)?.code;
      io.stdout.write(`${formatJson({ ok: false, error: { code: typeof code === 'string' ? code : 'INTERNAL', message, exitCode } })}\n`);
    }
    return exitCode;
  }
}
