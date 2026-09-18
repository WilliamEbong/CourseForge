/** Learner state with localStorage persistence (try/catch, in-memory fallback, version mismatch discards). */
import type { CfAnswer } from './types.js';

export interface LearnerState {
  v: 1;
  version: string;
  index: number;
  visited: string[];
  answers: Record<string, CfAnswer>;
}

interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

function storage(): KV {
  try {
    const ls = window.localStorage;
    const probe = '__cf_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => {
        try {
          ls.setItem(k, v);
        } catch {
          /* quota or privacy mode: keep going in memory */
        }
      },
      remove: (k) => ls.removeItem(k),
    };
  } catch {
    const mem = new Map<string, string>();
    return { get: (k) => mem.get(k) ?? null, set: (k, v) => void mem.set(k, v), remove: (k) => void mem.delete(k) };
  }
}

const fresh = (version: string): LearnerState => ({ v: 1, version, index: 0, visited: [], answers: {} });

export function createStore(key: string, version: string) {
  const kv = storage();
  let state = fresh(version);
  try {
    const raw = kv.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LearnerState>;
      if (
        parsed.v === 1 &&
        parsed.version === version &&
        Array.isArray(parsed.visited) &&
        parsed.answers &&
        typeof parsed.index === 'number'
      ) {
        state = {
          v: 1,
          version,
          index: parsed.index,
          visited: parsed.visited.filter((x) => typeof x === 'string'),
          answers: parsed.answers,
        };
      }
    }
  } catch {
    state = fresh(version);
  }
  return {
    get state() {
      return state;
    },
    save() {
      kv.set(key, JSON.stringify(state));
    },
    reset() {
      state = fresh(version);
      kv.remove(key);
    },
    prefs: kv,
  };
}
export type Store = ReturnType<typeof createStore>;
