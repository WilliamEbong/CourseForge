/**
 * Placeholder wiring of the PipelineApi. Wave 2 (pipeline stream) replaces each method with the real
 * implementation; until then calls fail loudly rather than pretending to work.
 */
import { CfError } from '../core/errors.js';
import type { PipelineApi } from './api.js';

const pending = (name: string) => () =>
  Promise.reject(new CfError('NOT_IMPLEMENTED', `pipeline operation "${name}" is not implemented yet`));

export const pipelineApi: PipelineApi = {
  newCourse: pending('newCourse'),
  ingest: pending('ingest'),
  run: pending('run'),
  continueRun: pending('continueRun'),
  review: pending('review'),
  improve: pending('improve'),
  status: pending('status'),
  gate: pending('gate'),
  findings: pending('findings'),
  versions: pending('versions'),
  trace: pending('trace'),
  packageCourse: pending('packageCourse'),
  clean: pending('clean'),
  listCourses: pending('listCourses'),
  smoke: pending('smoke'),
};
