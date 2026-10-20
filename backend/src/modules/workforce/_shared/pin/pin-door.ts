import { WINDOW_MS, shouldAlert, waitRemaining } from './pin-pause';

/** What a check is for. A new purpose (`CONDUCT_SIGN`) is a new string; the schedule and the store are shared. */
export type PinPurpose = 'SIGNER' | 'CONDUCT_SIGN';

export type PinAttempt = { kind: 'SLOW'; wait: number } | { kind: 'RIGHT' } | { kind: 'WRONG'; count: number; alert: boolean };

/** Where the tries live. The database store is registered at start-up; the memory store serves unit tests and scripts. */
export interface PinTryStore {
  /**
   * One person's checks run one at a time (so two phones guessing together cannot slip past the count). Answers SLOW while a pause
   * is running, without running `check`; otherwise runs `check`, records the try and answers RIGHT or WRONG.
   */
  attempt(userId: string, purpose: PinPurpose, now: Date, check: () => Promise<boolean>): Promise<PinAttempt>;
  reset?(): void;
}

interface Row {
  success: boolean;
  alerted: boolean;
  at: Date;
}

export function createMemoryTryStore(): PinTryStore {
  const rows = new Map<string, Row[]>();
  const chains = new Map<string, Promise<unknown>>();
  const run = async (userId: string, purpose: PinPurpose, now: Date, check: () => Promise<boolean>): Promise<PinAttempt> => {
    const key = `${userId}:${purpose}`;
    const all = rows.get(key) ?? [];
    const since = now.getTime() - WINDOW_MS;
    const lastRight = [...all].reverse().find((r) => r.success && r.at.getTime() > since);
    const wrong = all.filter((r) => !r.success && r.at.getTime() > since && (!lastRight || r.at > lastRight.at));
    const wait = waitRemaining(wrong.length, wrong[wrong.length - 1]?.at ?? null, now);
    if (wait > 0) return { kind: 'SLOW', wait };
    if (await check()) {
      rows.set(key, [...all, { success: true, alerted: false, at: now }]);
      return { kind: 'RIGHT' };
    }
    const count = wrong.length + 1;
    const alert = shouldAlert(count, wrong.some((r) => r.alerted));
    rows.set(key, [...all, { success: false, alerted: alert, at: now }]);
    return { kind: 'WRONG', count, alert };
  };
  return {
    attempt(userId, purpose, now, check) {
      const key = `${userId}:${purpose}`;
      const next = (chains.get(key) ?? Promise.resolve()).then(() => run(userId, purpose, now, check));
      chains.set(key, next.catch(() => undefined));
      return next;
    },
    reset: () => {
      rows.clear();
      chains.clear();
    },
  };
}

let store: PinTryStore = createMemoryTryStore();

export const setPinTryStore = (next: PinTryStore): void => {
  store = next;
};

/** For tests: forget every recorded try in the memory store. */
export const resetPinTries = (): void => store.reset?.();

export const attemptWithPause = (userId: string, purpose: PinPurpose, check: () => Promise<boolean>, now: Date = new Date()): Promise<PinAttempt> => store.attempt(userId, purpose, now, check);

/** Told when a window reaches its 3rd wrong try (once per window). Security registers its audit entry here. Never throws into the check. */
export type WrongThresholdListener = (event: { userId: string; purpose: PinPurpose; count: number; at: Date }) => Promise<void>;
let listener: WrongThresholdListener | null = null;
export const setWrongThresholdListener = (next: WrongThresholdListener | null): void => {
  listener = next;
};
export async function announceWrongThreshold(event: Parameters<WrongThresholdListener>[0]): Promise<void> {
  try {
    await listener?.(event);
  } catch {
    // a failing listener must never change the answer to the person signing
  }
}
