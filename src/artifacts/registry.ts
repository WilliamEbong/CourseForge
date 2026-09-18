/**
 * The per-course artifact registry (`artifacts.json`): every version of every artifact, with hashes,
 * provenance, approval/lock state and a plain-copy snapshot under `versions/<label>/<path>`.
 * History is append-only: restoring copies a snapshot forward as a new version.
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { ProducerKind, Stage } from '../core/enums.js';
import { CfError } from '../core/errors.js';
import { copyFile, exists, readJson, readText, writeJson } from '../core/fsx.js';
import { hashFile } from '../core/hash.js';
import { formatSeq } from '../core/ids.js';
import { COURSE_FILES } from '../core/paths.js';
import { type ArtifactRecord, type ArtifactRegistry, ArtifactRegistrySchema } from '../core/schemas/index.js';
import { regionHashes } from './locks.js';

export type ArtifactEvent =
  | 'generated'
  | 'imported'
  | 'reviewed'
  | 'repaired'
  | 'human-edited'
  | 'human-approved'
  | 'build'
  | 'qa-repaired'
  | 'release'
  | 'restored';

export interface RegisterInput {
  stage: Stage;
  /** Course-relative path, forward slashes. */
  path: string;
  logicalKey: string;
  producer: { kind: ProducerKind; backendVersion?: string | null; taskId?: string | null; runId?: string | null };
  parents?: string[];
  schemaVersion?: string | null;
  event: ArtifactEvent;
  humanModified?: boolean;
  notes?: string[];
  now?: string;
}

const registryPath = (courseDir: string) => join(courseDir, COURSE_FILES.artifacts);

export function emptyRegistry(): ArtifactRegistry {
  return { schemaVersion: 1, nextSeq: 1, artifacts: {} };
}

export function loadRegistry(courseDir: string): ArtifactRegistry {
  const p = registryPath(courseDir);
  return exists(p) ? readJson(p, ArtifactRegistrySchema) : emptyRegistry();
}

export function saveRegistry(courseDir: string, reg: ArtifactRegistry): void {
  writeJson(registryPath(courseDir), reg);
}

export function listArtifacts(reg: ArtifactRegistry, logicalKey?: string): ArtifactRecord[] {
  return Object.values(reg.artifacts)
    .filter((a) => !logicalKey || a.logicalKey === logicalKey)
    .sort((a, b) => a.artifactId.localeCompare(b.artifactId));
}

/** Highest version for a logical key (the canonical candidate), or null. */
export function latest(reg: ArtifactRegistry, logicalKey: string): ArtifactRecord | null {
  let best: ArtifactRecord | null = null;
  for (const a of Object.values(reg.artifacts)) if (a.logicalKey === logicalKey && (!best || a.version > best.version)) best = a;
  return best;
}

export function getArtifact(reg: ArtifactRegistry, id: string): ArtifactRecord {
  const a = reg.artifacts[id];
  if (!a) throw new CfError('ARTIFACT_NOT_FOUND', `Unknown artifact ${id}`, { exitCode: 2 });
  return a;
}

export function registerArtifact(courseDir: string, input: RegisterInput): ArtifactRecord {
  const reg = loadRegistry(courseDir);
  const abs = join(courseDir, input.path);
  if (!exists(abs)) throw new CfError('ARTIFACT_MISSING', `Cannot register ${input.path}: file not found`, { exitCode: 2 });
  const hash = hashFile(abs);
  const prev = latest(reg, input.logicalKey);
  if (prev && prev.hash === hash) return prev;

  const now = input.now ?? new Date().toISOString();
  const version = (prev?.version ?? 0) + 1;
  const artifactId = formatSeq('ART', reg.nextSeq);
  const label = `${input.logicalKey}-v${version}-${input.event}`;
  const snapshotPath = `${COURSE_FILES.versions}/${label}/${input.path}`;
  copyFile(abs, join(courseDir, snapshotPath));

  const record: ArtifactRecord = {
    artifactId,
    stage: input.stage,
    path: input.path,
    logicalKey: input.logicalKey,
    version,
    label,
    producer: {
      kind: input.producer.kind,
      backendVersion: input.producer.backendVersion ?? null,
      taskId: input.producer.taskId ?? null,
      runId: input.producer.runId ?? null,
    },
    parents: input.parents ?? [],
    schemaVersion: input.schemaVersion ?? null,
    hash,
    bytes: statSync(abs).size,
    createdAt: now,
    modifiedAt: now,
    humanModified: input.humanModified ?? input.producer.kind === 'human',
    approval: 'none',
    locked: false,
    lockedIds: [],
    reviewStatus: 'unreviewed',
    supersededBy: null,
    snapshotPath,
    notes: input.notes ?? [],
    conflicts: [],
  };
  if (prev) prev.supersededBy = artifactId;
  reg.artifacts[artifactId] = record;
  reg.nextSeq += 1;
  saveRegistry(courseDir, reg);
  return record;
}

function mutate(courseDir: string, id: string, fn: (a: ArtifactRecord) => void): ArtifactRecord {
  const reg = loadRegistry(courseDir);
  const a = getArtifact(reg, id);
  fn(a);
  saveRegistry(courseDir, reg);
  return a;
}

export const setApproval = (courseDir: string, id: string, approval: 'approved' | 'rejected') =>
  mutate(courseDir, id, (a) => {
    a.approval = approval;
  });

export const setLocked = (courseDir: string, id: string, locked: boolean) =>
  mutate(courseDir, id, (a) => {
    a.locked = locked;
  });

export const setReviewStatus = (courseDir: string, id: string, status: ArtifactRecord['reviewStatus']) =>
  mutate(courseDir, id, (a) => {
    a.reviewStatus = status;
  });

export const addConflict = (courseDir: string, id: string, conflict: { kind: string; detail: string; findingId?: string | null }) =>
  mutate(courseDir, id, (a) => {
    a.conflicts.push({ kind: conflict.kind, detail: conflict.detail, findingId: conflict.findingId ?? null });
  });

/** Locks IDs inside an artifact, hashing each region from the current file. Unknown IDs are an error. */
export function addLockedIds(courseDir: string, id: string, ids: string[]): ArtifactRecord {
  return mutate(courseDir, id, (a) => {
    const hashes = regionHashes(readText(join(courseDir, a.path)), a.path, ids);
    const missing = ids.filter((i) => hashes[i] === null);
    if (missing.length) throw new CfError('LOCK_ID_NOT_FOUND', `IDs not found in ${a.path}: ${missing.join(', ')}`, { exitCode: 2 });
    for (const i of ids) {
      const hash = hashes[i] as string;
      const existing = a.lockedIds.find((l) => l.id === i);
      if (existing) existing.hash = hash;
      else a.lockedIds.push({ id: i, hash });
    }
  });
}

export const removeLockedIds = (courseDir: string, id: string, ids: string[]) =>
  mutate(courseDir, id, (a) => {
    a.lockedIds = a.lockedIds.filter((l) => !ids.includes(l.id));
  });

/** Copies a snapshot forward as a new version (event `restored`). History is never rewound. */
export function restoreVersion(courseDir: string, label: string, now?: string): ArtifactRecord {
  const reg = loadRegistry(courseDir);
  const src = Object.values(reg.artifacts).find((a) => a.label === label);
  if (!src?.snapshotPath) throw new CfError('VERSION_NOT_FOUND', `No snapshot with label ${label}`, { exitCode: 2 });
  copyFile(join(courseDir, src.snapshotPath), join(courseDir, src.path));
  return registerArtifact(courseDir, {
    stage: src.stage,
    path: src.path,
    logicalKey: src.logicalKey,
    producer: { kind: 'courseforge' },
    parents: [src.artifactId],
    schemaVersion: src.schemaVersion,
    event: 'restored',
    notes: [`restored from ${label}`],
    ...(now ? { now } : {}),
  });
}

/** Latest records whose file on disk no longer matches (external human edit) or is missing (`currentHash` null). */
export function detectDrift(courseDir: string): { record: ArtifactRecord; currentHash: string | null }[] {
  const reg = loadRegistry(courseDir);
  const out: { record: ArtifactRecord; currentHash: string | null }[] = [];
  for (const a of listArtifacts(reg)) {
    if (a.supersededBy) continue;
    const abs = join(courseDir, a.path);
    const currentHash = exists(abs) ? hashFile(abs) : null;
    if (currentHash !== a.hash) out.push({ record: a, currentHash });
  }
  return out;
}
