import { ApiError } from '@/types/api';
import { PREP_STATES_COPY } from './states-copy';

/**
 * Turns whatever a Prep call threw into a sentence a person can act on. Never shows a raw code or "Request failed".
 * `fallback` is the screen's own "couldn't do X" line, used when nothing more specific is known.
 */
export function describePrepError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'RUN_NOT_OPEN') return PREP_STATES_COPY.needsLook.notOpen;
    if (error.code === 'EXPORT_TOO_LARGE') return PREP_STATES_COPY.history.exportTooLarge;
    if (error.statusCode === 401) return 'Your session has ended. Sign in again to continue.';
    if (error.statusCode === 403) return "Your role can't do this. Ask the Store Manager.";
    if (error.statusCode === 404) return 'That run could not be found. It may have been removed.';
    if (error.statusCode >= 500) return `Something went wrong on our side. ${fallback}`;
    return fallback;
  }
  // `fetch` rejects with a TypeError when there is no network.
  if (error instanceof TypeError) return PREP_STATES_COPY.history.offline;
  return fallback;
}
