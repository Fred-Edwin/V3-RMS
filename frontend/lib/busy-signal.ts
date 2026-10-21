/**
 * "The system is busy, trying again" (finding 46). The api client calls `busyStarted` when a read is waiting to retry after a 429 and
 * `busyEnded` when it stops (answered or given up). The shell shows a note while at least one read is waiting.
 */
export const BUSY_EVENT = 'api:busy';

let waiting = 0;

const announce = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: { waiting } }));
};

export const busyStarted = (): void => {
  waiting += 1;
  announce();
};

export const busyEnded = (): void => {
  waiting = Math.max(0, waiting - 1);
  announce();
};
