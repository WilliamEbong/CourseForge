/**
 * Machine-readable reports: build, QA (functional / accessibility / screenshots), intake, release, environment.
 */
import { z } from 'zod';
import { RendererSchema, SeveritySchema, SourceFormatSchema, StageSchema, VisualArchetypeSchema } from '../enums.js';

/* ---------------------------------------------------------------- build report */

export const BuildReportSchema = z.object({
  schemaVersion: z.literal(1),
  courseId: z.string(),
  mode: z.enum(['release', 'dev']),
  outputPath: z.string(),
  outputHash: z.string(),
  bytes: z.number().int(),
  sizeBreakdown: z.object({ html: z.number(), css: z.number(), js: z.number(), data: z.number(), svg: z.number() }),
  inputHashes: z.record(z.string(), z.string()),
  theme: z.record(z.string(), z.unknown()),
  contrast: z.array(
    z.object({
      pair: z.string(),
      scheme: z.enum(['light', 'dark']),
      ratio: z.number(),
      required: z.number(),
      pass: z.boolean(),
      adjusted: z.boolean(),
    }),
  ),
  visuals: z.array(
    z.object({
      visualId: z.string(),
      archetype: VisualArchetypeSchema,
      renderer: RendererSchema,
      rule: z.string(),
      fallbackUsed: z.boolean(),
      attempts: z.array(z.object({ renderer: RendererSchema, ok: z.boolean(), error: z.string().nullable() })),
      bytes: z.number().int(),
    }),
  ),
  icons: z.array(z.string()),
  counts: z.object({
    modules: z.number(),
    screens: z.number(),
    interactions: z.number(),
    graded: z.number(),
    visuals: z.number(),
    glossary: z.number(),
    references: z.number(),
  }),
  checks: z.array(z.object({ id: z.string(), pass: z.boolean(), detail: z.string() })),
  toolVersions: z.record(z.string(), z.string()),
});
export type BuildReport = z.infer<typeof BuildReportSchema>;

/* ------------------------------------------------------------------ QA reports */

export const FunctionalReportSchema = z.object({
  schemaVersion: z.literal(1),
  courseId: z.string(),
  mode: z.enum(['contract', 'crawl']),
  target: z.string(),
  targetHash: z.string(),
  profile: z.enum(['dev', 'release', 'smoke']),
  viewports: z.array(z.number()),
  durationMs: z.number(),
  screens: z.array(
    z.object({
      id: z.string(),
      index: z.number(),
      viewport: z.number(),
      ok: z.boolean(),
      errors: z.array(z.string()),
      overflow: z.array(z.string()),
      missingIds: z.array(z.string()),
    }),
  ),
  interactions: z.array(
    z.object({
      id: z.string(),
      mode: z.string(),
      correctPath: z.enum(['pass', 'fail', 'skipped']),
      incorrectPath: z.enum(['pass', 'fail', 'skipped']),
      detail: z.string(),
    }),
  ),
  scoring: z.object({
    checked: z.boolean(),
    expectedPercent: z.number().nullable(),
    actualPercent: z.number().nullable(),
    ok: z.boolean(),
  }),
  navigation: z.object({ ok: z.boolean(), detail: z.string() }),
  resources: z.object({ glossary: z.number().nullable(), references: z.number().nullable(), ok: z.boolean(), detail: z.string() }),
  progress: z.object({ persisted: z.boolean().nullable(), resetOk: z.boolean().nullable() }),
  keyboard: z.object({ ok: z.boolean().nullable(), focusVisible: z.boolean().nullable(), detail: z.string() }),
  offline: z.object({ blockedRequests: z.array(z.string()) }),
  consoleErrors: z.array(z.string()),
  /** Crawl mode only: discovered states and controls. */
  crawl: z
    .object({ states: z.number(), maxDepth: z.number(), controls: z.array(z.string()), truncated: z.boolean() })
    .nullable()
    .default(null),
  summary: z.object({ pass: z.boolean(), failures: z.array(z.string()) }),
});
export type FunctionalReport = z.infer<typeof FunctionalReportSchema>;

export const AccessibilityReportSchema = z.object({
  schemaVersion: z.literal(1),
  courseId: z.string(),
  target: z.string(),
  engine: z.string(),
  tags: z.array(z.string()),
  screens: z.array(
    z.object({
      id: z.string(),
      viewport: z.number(),
      violations: z.array(
        z.object({
          id: z.string(),
          impact: z.enum(['minor', 'moderate', 'serious', 'critical']).nullable(),
          help: z.string(),
          helpUrl: z.string(),
          nodes: z.array(z.string()),
        }),
      ),
    }),
  ),
  totals: z.object({ critical: z.number(), serious: z.number(), moderate: z.number(), minor: z.number() }),
});
export type AccessibilityReport = z.infer<typeof AccessibilityReportSchema>;

export const ScreenshotManifestSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(z.object({ screenId: z.string(), viewport: z.number(), path: z.string(), sha256: z.string(), bytes: z.number() })),
});
export type ScreenshotManifest = z.infer<typeof ScreenshotManifestSchema>;

/* --------------------------------------------------------------- intake report */

export const IntakeReportSchema = z.object({
  schemaVersion: z.literal(1),
  courseId: z.string(),
  createdAt: z.string(),
  originals: z.array(z.object({ name: z.string(), path: z.string(), hash: z.string(), bytes: z.number(), format: SourceFormatSchema })),
  declaredStage: StageSchema.nullable(),
  inferred: z.object({
    stage: StageSchema.nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
    method: z.enum(['heuristic', 'agent', 'declared']),
    scores: z.record(z.string(), z.number()),
    evidence: z.array(z.string()),
  }),
  acceptedStage: StageSchema,
  mode: z.enum(['preserve', 'review-only', 'improve', 'rebuild']),
  contractGaps: z.array(z.object({ requirement: z.string(), status: z.enum(['met', 'partial', 'missing']), detail: z.string() })),
  idsFound: z.record(z.string(), z.number()),
  counts: z.record(z.string(), z.number()),
  producedArtifacts: z.array(z.string()),
  warnings: z.array(z.string()),
  lossy: z.boolean(),
  nextLegalTargets: z.array(StageSchema),
});
export type IntakeReport = z.infer<typeof IntakeReportSchema>;

/* ------------------------------------------------------------- release gate */

export const GateReasonSchema = z.object({
  code: z.enum([
    'OPEN_BLOCKING_FINDING',
    'AXE_BLOCKING_VIOLATION',
    'FUNCTIONAL_FAILURE',
    'MISSING_ARTIFACT',
    'CITATION_INTEGRITY',
    'LOCK_CONFLICT',
    'CYCLES_EXHAUSTED',
    'ORIGINAL_MODIFIED',
    'BUILD_CHECK_FAILED',
    'HUMAN_APPROVAL_REQUIRED',
  ]),
  findingIds: z.array(z.string()),
  detail: z.string(),
});
export type GateReason = z.infer<typeof GateReasonSchema>;
export const ReleaseDecisionSchema = z.object({ decision: z.enum(['pass', 'block']), reasons: z.array(GateReasonSchema) });
export type ReleaseDecision = z.infer<typeof ReleaseDecisionSchema>;

export const ReleaseManifestSchema = z.object({
  schemaVersion: z.literal(1),
  courseId: z.string(),
  title: z.string(),
  releaseVersion: z.string(),
  releasedAt: z.string(),
  file: z.object({ path: z.string(), sha256: z.string(), bytes: z.number() }),
  decision: ReleaseDecisionSchema,
  backends: z.array(z.object({ name: z.string(), version: z.string().nullable() })),
  toolVersions: z.record(z.string(), z.string()),
  artifacts: z.array(z.object({ artifactId: z.string(), logicalKey: z.string(), path: z.string(), hash: z.string(), label: z.string() })),
  findings: z.object({ open: z.record(SeveritySchema, z.number()), accepted: z.number(), waived: z.number() }),
  trace: z.object({
    objectives: z.number(),
    screens: z.number(),
    assessedObjectives: z.number(),
    unassessedObjectives: z.array(z.string()),
    danglingReferences: z.array(z.string()),
    sourcesCited: z.number(),
  }),
  riskTier: z.string(),
  riskOverride: z.string().nullable(),
  humanApprovals: z.array(z.object({ stage: StageSchema, by: z.string().nullable(), at: z.string().nullable() })),
});
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

/* ---------------------------------------------------------- environment / doctor */

export const DoctorCheckSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['pass', 'warn', 'fail', 'skip']),
  /** How a failure is handled: fixed automatically, needs a human, or advisory only. */
  classification: z.enum(['ready', 'repairable', 'manual', 'advisory']),
  message: z.string(),
  repair: z.string().nullable(),
  repaired: z.boolean().default(false),
  durationMs: z.number(),
});
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;

const ToolPresence = z.object({ installed: z.boolean(), version: z.string().nullable() });

export const EnvironmentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  platform: z.string(),
  release: z.string(),
  architecture: z.string(),
  cpu: z.object({ model: z.string(), cores: z.number() }),
  memoryGb: z.object({ total: z.number(), free: z.number() }),
  node: ToolPresence.extend({ compatible: z.boolean(), required: z.string() }),
  npm: ToolPresence,
  git: ToolPresence,
  claude: ToolPresence.extend({ ready: z.boolean().nullable(), globalConfigDetected: z.array(z.string()) }),
  codex: ToolPresence.extend({ ready: z.boolean().nullable(), globalConfigDetected: z.array(z.string()) }),
  playwright: z.object({ installed: z.boolean(), version: z.string().nullable(), chromium: z.boolean(), source: z.string().nullable() }),
  packages: z.record(z.string(), z.string().nullable()),
  cloudSync: z.object({ detected: z.boolean(), provider: z.string().nullable() }),
  checks: z.array(DoctorCheckSchema),
  status: z.enum(['ready', 'repairable', 'manual', 'failed']),
});
export type EnvironmentManifest = z.infer<typeof EnvironmentManifestSchema>;
