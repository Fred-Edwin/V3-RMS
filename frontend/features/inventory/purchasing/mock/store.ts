import { emptyState, STATE_VERSION, type State } from './engine';
import { buildScenario, DEFAULT_SCENARIO } from './scenarios';

/**
 * The mock's database: one state object kept in this browser (`localStorage`, version-keyed, every access in try/catch).
 * Shared by every role in the same browser, so the Attendant's request is what the Store Manager sees. Nothing leaves the
 * browser. `reset` rebuilds a scenario from the fixtures.
 */
const KEY = `purchasing-mock-v${STATE_VERSION}`;

export interface MockStore {
  get: () => State;
  set: (state: State) => void;
  reset: (scenario?: string) => State;
  subscribe: (listener: () => void) => () => void;
}

interface StorageLike {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
}

export function createMockStore(storage: StorageLike | null, now: () => Date = () => new Date()): MockStore {
  let state: State | null = null;
  const listeners = new Set<() => void>();

  const persist = (s: State): void => {
    try {
      storage?.setItem(KEY, JSON.stringify(s));
    } catch {
      // Blocked or full storage: the demo keeps working until the page reloads.
    }
  };

  const load = (): State => {
    try {
      const raw = storage?.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (parsed.version === STATE_VERSION) return parsed;
      }
    } catch {
      // Corrupt or blocked: start again from the default scenario.
    }
    const fresh = buildScenario(DEFAULT_SCENARIO, now());
    persist(fresh);
    return fresh;
  };

  const notify = (): void => listeners.forEach((l) => l());

  return {
    get: () => (state ??= load()),
    set: (next) => {
      state = next;
      persist(next);
      notify();
    },
    reset: (scenario = DEFAULT_SCENARIO) => {
      state = scenario === 'fresh' ? emptyState('fresh') : buildScenario(scenario, now());
      persist(state);
      notify();
      return state;
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

let shared: MockStore | null = null;
/** The one store the screens use. */
export const mockStore = (): MockStore => (shared ??= createMockStore(browserStorage()));
