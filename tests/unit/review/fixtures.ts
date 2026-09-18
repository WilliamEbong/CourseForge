import { readFileSync } from 'node:fs';
import type { Severity, Stage } from '../../../src/core/enums.js';
import type { FindingSet } from '../../../src/core/schemas/review.js';

export interface OverlapFixture {
  stage: Stage;
  cycle: number;
  lockedIds: string[];
  humanDecisions: Record<string, 'accepted' | 'rejected'>;
  repairSeverities: Severity[];
  reviews: { reviewer: string; artifactId: string | null; set: FindingSet }[];
}

export const overlap = (): OverlapFixture =>
  JSON.parse(readFileSync(new URL('../../fixtures/findings/overlap-reviews.json', import.meta.url), 'utf8')) as OverlapFixture;

/** Deterministic Fisher–Yates with a seeded LCG. */
export function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const out = [...xs];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
