/** Usage text. Every command also accepts --json (machine output on stdout) and --help. */

const H = '[--backend auto|claude|codex] [--harness claude|codex|fake]';

export const COMMAND_HELP: Record<string, { usage: string; summary: string }> = {
  setup: { usage: 'setup [--no-smoke]', summary: 'Repair the environment (doctor --repair), then run the smoke fixture' },
  doctor: {
    usage: 'doctor [--repair] [--only <id,...>] [--live]',
    summary: 'Check prerequisites; --repair fixes repo-local problems; --live runs one tiny isolated task per backend',
  },
  'validate-config': { usage: 'validate-config', summary: 'Validate config/*.json registries' },
  new: {
    usage: `new <title> [--id <id>] [--notes <file>] [--audience <text>] [--duration <minutes>] [--jurisdiction <text>] [--language <code>] [--to <stage>] [--gate auto|hybrid|human] ${H}`,
    summary: 'Create a course from a concept (optionally run it to a stage)',
  },
  ingest: {
    usage: `ingest <file> [--course <id>] [--title <text>] [--stage <stage>] [--mode preserve|review-only|improve|rebuild] [--replace] [--conservative] ${H}`,
    summary: 'Import an existing artifact (research, design, storyboard, HTML …)',
  },
  run: {
    usage: `run --course <id> [--from <stage>] [--to <stage>] [--gate <mode>] [--force] ${H}`,
    summary: 'Run the pipeline over a stage range',
  },
  continue: { usage: `continue --course <id> ${H}`, summary: 'Resume an interrupted or paused run' },
  review: { usage: `review --course <id> [--stage <stage>] ${H}`, summary: 'Run the reviewer panel without repairing' },
  improve: {
    usage: `improve --course <id> [--input <file>] [--to <stage>] ${H}`,
    summary: 'Review, adjudicate and repair an existing artifact',
  },
  status: { usage: 'status [--course <id>]', summary: 'Show course status (all courses when --course is omitted)' },
  list: { usage: 'list', summary: 'List courses' },
  gate: {
    usage:
      'gate <approve|reject|comment|lock|unlock|rereview> --course <id> --stage <stage> [--by <name>] [--text <text>] [--ids a,b] [--abort] [--instructions <text>]',
    summary: 'Act on a human review gate',
  },
  findings: {
    usage: 'findings <list|accept|reject> --course <id> [--stage <stage>] [--ids a,b] [--by <name>]',
    summary: 'List or decide findings',
  },
  versions: {
    usage: 'versions <list|restore|select> --course <id> [--label <label>] [--artifact <id>]',
    summary: 'Artifact version history',
  },
  trace: {
    usage: 'trace --course <id> [--id <id>] [--direction up|down] [--depth <n>] [--impact a,b]',
    summary: 'Traceability: source → claim → objective → screen',
  },
  build: { usage: `build --course <id> [--force] ${H}`, summary: 'Run the COURSE_BUILD stage' },
  qa: { usage: `qa --course <id> [--force] ${H}`, summary: 'Run the COURSE_QA stage' },
  release: { usage: `release --course <id> [--force] ${H}`, summary: 'Run the RELEASE stage (release gate)' },
  package: { usage: 'package --course <id> [--out <file>]', summary: 'Zip the course folder' },
  clean: { usage: 'clean [--course <id>] [--build] [--cache] [--dry-run]', summary: 'Remove generated files (never sources or originals)' },
  smoke: { usage: 'smoke', summary: 'Run the setup smoke fixture (build, render, browser, axe, screenshot)' },
  version: { usage: 'version', summary: 'Print the CourseForge version' },
  help: { usage: 'help [command]', summary: 'Show help' },
};

const STAGE_NOTE =
  'Stages: CONCEPT, RESEARCH_BRIEF, RESEARCH_DOSSIER, INSTRUCTIONAL_DESIGN, STORYBOARD, EDITORIAL, VISUAL_DIRECTION,\n' +
  '        COURSE_MODEL, COURSE_BUILD, COURSE_QA, RELEASE (any case) or concept, brief, research|dossier, design,\n' +
  '        storyboard, editorial, visual, model, build, qa, release.';

export function helpText(command?: string): string {
  const entry = command ? COMMAND_HELP[command] : undefined;
  if (entry) return `Usage: courseforge ${entry.usage} [--json]\n\n${entry.summary}.\n`;
  const width = Math.max(...Object.keys(COMMAND_HELP).map((k) => k.length));
  const rows = Object.entries(COMMAND_HELP).map(([k, v]) => `  ${k.padEnd(width)}  ${v.summary}`);
  return [
    'Usage: courseforge <command> [options] [--json]',
    '',
    'Commands:',
    ...rows,
    '',
    STAGE_NOTE,
    'Exit codes: 0 ok, 1 internal, 2 usage/config, 3 environment, 4 blocked, 5 course locked, 10 waiting for human, 11 stage failed.',
    'Run `courseforge help <command>` for options.',
    '',
  ].join('\n');
}
