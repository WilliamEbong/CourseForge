/**
 * The ONLY module allowed to spawn subprocesses (enforced by tests/unit/arch/boundary.test.ts).
 * `shell` is always false: arguments are passed as an argv array, never interpolated into a shell string.
 * `cross-spawn` resolves Windows `.cmd`/`.exe` shims correctly without a shell.
 */
import spawn from 'cross-spawn';

export interface ProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  /** Set when the process could not be started at all (e.g. ENOENT). */
  spawnError: string | null;
}

export interface ProcessOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  /** Cap on captured output per stream (default 64 MiB). */
  maxBuffer?: number;
}

export function runProcess(argv: readonly string[], opts: ProcessOptions = {}): Promise<ProcessResult> {
  const [cmd, ...args] = argv;
  if (!cmd) return Promise.reject(new Error('runProcess: empty argv'));
  const started = Date.now();
  const max = opts.maxBuffer ?? 64 * 1024 * 1024;
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const finish = (code: number | null, signal: NodeJS.Signals | null, spawnError: string | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut, durationMs: Date.now() - started, spawnError });
    };
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 5000).unref();
        }, opts.timeoutMs)
      : null;
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (d: string) => {
      if (stdout.length < max) stdout += d;
    });
    child.stderr?.on('data', (d: string) => {
      if (stderr.length < max) stderr += d;
    });
    child.on('error', (err) => finish(null, null, err.message));
    child.on('close', (code, signal) => finish(code, signal, null));
    child.stdin?.on('error', () => {
      /* child may exit before reading stdin */
    });
    if (opts.stdin !== undefined) child.stdin?.end(opts.stdin, 'utf8');
    else child.stdin?.end();
  });
}

/** Convenience: first line of `<cmd> --version`-style output, or null when the tool is absent. */
export async function probeVersion(argv: readonly string[], timeoutMs = 20000): Promise<string | null> {
  const res = await runProcess(argv, { timeoutMs });
  if (res.spawnError || res.code !== 0) return null;
  const line = (res.stdout || res.stderr).trim().split(/\r?\n/)[0];
  return line ? line.trim() : null;
}
