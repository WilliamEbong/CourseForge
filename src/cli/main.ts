/**
 * CourseForge CLI: parses argv, dispatches to the PipelineApi (or the local doctor/setup commands) and maps
 * results/errors to exit codes. Returns the exit code instead of exiting so tests can call it in-process.
 */
import { join } from 'node:path';
import { BackendPreferenceSchema, EXIT, GateModeInputSchema, HarnessNameSchema, IntakeModeSchema, type Stage } from '../core/enums.js';
import { CfError, usageError } from '../core/errors.js';
import { readJson } from '../core/fsx.js';
import { repoRoot } from '../core/paths.js';
import type { EnvironmentManifest } from '../core/schemas/reports.js';
import { type DoctorOptions, runDoctor } from '../environment/doctor.js';
import { formatDoctor, useColor } from '../environment/format.js';
import { loadConfigValidator } from '../environment/probe.js';
import { type GateAction, type HarnessOptions, loadPipelineApi, type PipelineApi, type RunOutcome } from '../pipeline/api.js';
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
}
export interface MainOverrides {
  api?: PipelineApi;
  doctor?: (opts: DoctorOptions) => Promise<EnvironmentManifest>;
}

interface Ctx {
  values: Values;
  positionals: string[];
  json: boolean;
  io: CliIo;
  api: () => Promise<PipelineApi>;
  doctor: (opts: DoctorOptions) => Promise<EnvironmentManifest>;
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

const COMMANDS: Record<string, Command> = {
  doctor: {
    options: { repair: B, only: S },
    run: async (ctx) => {
      const m = await ctx.doctor({ repair: flag(ctx.values, 'repair'), only: optList(ctx.values, 'only') });
      print(ctx, m, () => formatDoctor(m, { color: useColor(ctx.io.stdout) }).trimEnd());
      return m.status === 'ready' ? EXIT.OK : EXIT.ENVIRONMENT;
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
    },
    run: async (ctx) => {
      const v = ctx.values;
      const title = ctx.positionals[0];
      if (!title) throw usageError('new: a course title is required');
      const res = await (await ctx.api()).newCourse({
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
        [`created ${res.courseId} at ${res.courseDir}`, res.outcome ? formatOutcome(res.outcome) : ''].filter(Boolean).join('\n'),
      );
      return res.outcome?.exitCode ?? EXIT.OK;
    },
  },
  ingest: {
    positionals: 1,
    options: { ...COURSE, ...HARNESS, title: S, stage: S, mode: S, replace: B, conservative: B },
    run: async (ctx) => {
      const v = ctx.values;
      const file = ctx.positionals[0];
      if (!file) throw usageError('ingest: a file is required');
      const res = await (await ctx.api()).ingest({
        file,
        courseId: str(v, 'course'),
        title: str(v, 'title'),
        stage: optStage(v, 'stage'),
        mode: optEnum(IntakeModeSchema, v, 'mode'),
        replace: flag(v, 'replace'),
        conservative: flag(v, 'conservative'),
        ...harnessOpts(v),
      });
      print(ctx, res, () => formatIntake(res.courseId, res.report));
      return EXIT.OK;
    },
  },
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
    options: { ...COURSE, out: S },
    run: async (ctx) => {
      const res = await (await ctx.api()).packageCourse({
        courseId: required(ctx.values, 'course', 'package'),
        out: str(ctx.values, 'out'),
      });
      print(ctx, res, () => `packaged ${res.path} (${res.bytes} bytes)`);
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
  io: CliIo = { stdout: process.stdout, stderr: process.stderr },
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
