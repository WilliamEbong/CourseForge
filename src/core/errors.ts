import { EXIT, type ExitCode, type StageFailure } from './enums.js';

/** Typed CourseForge error. `exitCode` is what the CLI returns; `kind` classifies stage failures. */
export class CfError extends Error {
  readonly code: string;
  readonly exitCode: ExitCode;
  readonly kind: StageFailure | null;
  readonly detail: Record<string, unknown> | null;

  constructor(
    code: string,
    message: string,
    opts: { exitCode?: ExitCode; kind?: StageFailure; detail?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = 'CfError';
    this.code = code;
    this.exitCode = opts.exitCode ?? EXIT.INTERNAL;
    this.kind = opts.kind ?? null;
    this.detail = opts.detail ?? null;
  }
}

export const usageError = (message: string, detail?: Record<string, unknown>) =>
  new CfError('USAGE', message, { exitCode: EXIT.USAGE, ...(detail ? { detail } : {}) });

export const configError = (message: string, detail?: Record<string, unknown>) =>
  new CfError('CONFIG_INVALID', message, { exitCode: EXIT.USAGE, ...(detail ? { detail } : {}) });

/** Thrown for unknown/invalid routing inputs: routing never silently defaults (spec 05). */
export class RoutingError extends CfError {
  constructor(message: string, detail?: Record<string, unknown>) {
    super('ROUTING', message, { exitCode: EXIT.USAGE, kind: 'input_invalid', ...(detail ? { detail } : {}) });
    this.name = 'RoutingError';
  }
}

export class IllegalTransitionError extends CfError {
  constructor(message: string, detail?: Record<string, unknown>) {
    super('ILLEGAL_TRANSITION', message, { exitCode: EXIT.USAGE, kind: 'input_invalid', ...(detail ? { detail } : {}) });
    this.name = 'IllegalTransitionError';
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
