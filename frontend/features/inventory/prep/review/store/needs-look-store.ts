import { create } from 'zustand';

import { prepApi } from '../../_shared/services/prep-api';

interface NeedsLookState {
  /** Runs waiting for review; 0 until the first answer (a zero badge draws nothing). */
  count: number;
  /** Whose count this is, so a different person never sees the last person's number. */
  userId: string | null;
  refresh: (userId: string) => Promise<void>;
  reset: () => void;
}

let latest = 0;

/**
 * The sidebar badge's number (GET /needs-a-look/count). Shared by the shell and the Runs screen, so a Mark reviewed on screen can
 * refresh it. Only the newest request writes, and a failed refresh keeps the old number (the badge is a hint, not a gate).
 */
export const useNeedsLookStore = create<NeedsLookState>((set, get) => ({
  count: 0,
  userId: null,
  refresh: async (userId) => {
    const request = ++latest;
    try {
      const { count } = await prepApi.needsLookCount();
      if (request === latest) set({ count, userId });
    } catch {
      if (request === latest && get().userId !== userId) set({ count: 0, userId });
    }
  },
  reset: () => {
    latest += 1;
    set({ count: 0, userId: null });
  },
}));
