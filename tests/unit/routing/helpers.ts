import type { BackendName, Stage } from '../../../src/core/enums.js';
import { type CourseManifest, CourseManifestSchema } from '../../../src/core/schemas/index.js';
import type { HarnessProbe } from '../../../src/harness/types.js';
import type { PlanInput } from '../../../src/routing/plan.js';
import { loadRegistries } from '../../../src/routing/registries.js';

export const registries = loadRegistries();

export function manifest(
  over: { course?: Record<string, unknown>; pipeline?: Record<string, unknown>; human_review?: Record<string, string> } = {},
): CourseManifest {
  return CourseManifestSchema.parse({
    course: { id: 'demo-course', title: 'Demo', ...over.course },
    ...(over.pipeline ? { pipeline: over.pipeline } : {}),
    ...(over.human_review ? { human_review: over.human_review } : {}),
  });
}

export function probe(name: BackendName, available = true, authenticated: boolean | 'unknown' = true): HarnessProbe {
  return { name, available, version: available ? `${name}-1.0.0` : null, authenticated, flags: [], detail: '' };
}

export function planInput(stage: Stage, over: Partial<PlanInput> = {}): PlanInput {
  return {
    courseId: 'demo-course',
    runId: 'RUN-20260918T000000Z-abcd',
    stage,
    revision: 1,
    supersedes: null,
    now: '2026-09-18T00:00:00.000Z',
    mode: 'generate',
    startStage: 'CONCEPT',
    targetStage: 'RELEASE',
    fromStatus: 'NOT_STARTED',
    registries,
    manifest: manifest(),
    riskTier: 'standard',
    probes: { claude: probe('claude'), codex: probe('codex') },
    overrides: {},
    inputs: [{ artifactId: 'ART-0001', path: 'input/concept.json', hash: null, required: true }],
    fanOutKeys: ['M1', 'M2'],
    visuals: [],
    courseRelRoot: 'courses/demo-course',
    ...over,
  };
}
