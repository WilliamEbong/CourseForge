import { latest, loadRegistry, verifyLocks } from '../../artifacts/index.js';
import type { Issue } from '../checks/content.js';
import type { RunContext } from '../context.js';

/** Locked regions/artifacts must be byte-identical to their recorded hashes. */
export function lockIssues(ctx: RunContext, logicalKey: string): Issue[] {
  const rec = latest(loadRegistry(ctx.dir), logicalKey);
  if (!rec || (!rec.locked && rec.lockedIds.length === 0)) return [];
  return verifyLocks(ctx.dir, rec).map((v) => ({
    checkId: 'locks-intact',
    severity: 'blocker' as const,
    category: 'structure' as const,
    location: v.id,
    problem: `Locked content changed (expected ${v.expected}, found ${v.actual ?? 'missing'})`,
    recommendedAction: 'Restore the locked content from versions/ or unlock it explicitly.',
  }));
}
