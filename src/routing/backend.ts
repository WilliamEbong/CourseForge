import type { BackendName, BackendPreference, HarnessName } from '../core/enums.js';
import type { FallbacksConfig } from '../core/schemas/index.js';
import type { HarnessProbe } from '../harness/types.js';

export interface BackendSelection {
  selected: HarnessName | 'none';
  version: string | null;
  rule: 'BACKEND-FORCED-001' | 'BACKEND-EXPLICIT-001' | 'BACKEND-AUTO-001' | 'BACKEND-FALLBACK-001' | 'BACKEND-NONE-001';
  reason: string;
}

const usable = (p: HarnessProbe | undefined): boolean => !!p && p.available && p.authenticated !== false;

/**
 * Picks the agent backend. `forced` (e.g. `fake`, or COURSEFORGE_HARNESS) wins; an explicit preference is honoured
 * or falls back only when both the registry and the course allow it; `auto` takes the first usable backend in
 * `cfg.backend.order`. Never switches because of answer quality.
 */
export function selectBackend(
  pref: BackendPreference,
  probes: Partial<Record<BackendName, HarnessProbe>>,
  cfg: FallbacksConfig,
  forced?: HarnessName,
  courseAllowsFallback = false,
): BackendSelection {
  if (forced) {
    const version = forced === 'fake' ? null : (probes[forced]?.version ?? null);
    return { selected: forced, version, rule: 'BACKEND-FORCED-001', reason: `harness forced to ${forced}` };
  }
  const firstUsable = (exclude?: BackendName) => cfg.backend.order.find((b) => b !== exclude && usable(probes[b]));

  if (pref === 'auto') {
    const b = firstUsable();
    if (b)
      return {
        selected: b,
        version: probes[b]?.version ?? null,
        rule: 'BACKEND-AUTO-001',
        reason: `first usable in order [${cfg.backend.order.join(', ')}]`,
      };
    return { selected: 'none', version: null, rule: 'BACKEND-NONE-001', reason: 'no configured backend is available and authenticated' };
  }

  const probe = probes[pref];
  if (probe && usable(probe)) return { selected: pref, version: probe.version, rule: 'BACKEND-EXPLICIT-001', reason: `requested ${pref}` };
  const why = !probe?.available ? `${pref} unavailable` : `${pref} not authenticated`;
  if (cfg.backend.enabled && courseAllowsFallback) {
    const b = firstUsable(pref);
    if (b) return { selected: b, version: probes[b]?.version ?? null, rule: 'BACKEND-FALLBACK-001', reason: `${why}; fell back to ${b}` };
    return { selected: 'none', version: null, rule: 'BACKEND-NONE-001', reason: `${why}; no fallback backend usable` };
  }
  return {
    selected: 'none',
    version: null,
    rule: 'BACKEND-NONE-001',
    reason: `${why}; backend fallback ${cfg.backend.enabled ? 'not allowed by course.yaml' : 'disabled in fallbacks.json'}`,
  };
}
