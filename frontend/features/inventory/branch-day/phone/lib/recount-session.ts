import type { RecountPreview } from '../../_shared/types/branch-day-contract';

/**
 * The recount (B2) is not saved on the server until it is signed, so the typed figures and the preview wait here for this tab. Blocked
 * storage only means a reload starts the recount again.
 */
export interface RecountSession {
  figures: Record<string, string>;
  preview: RecountPreview | null;
}

const KEY = 'branch-day-recount';

export function readRecount(): RecountSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecountSession) : null;
  } catch {
    return null;
  }
}

export function writeRecount(session: RecountSession): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Forgotten on reload.
  }
}

export function clearRecount(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
