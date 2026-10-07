import { ApiError } from '@/types/api';

/**
 * Turns whatever a Counting, Stock or Waste call threw into plain words. A known contract `code` gets its line from the
 * sub-module's copy table; a 401, 403, 5xx or lost connection gets the shared line; the raw code is never shown.
 */
export function scwErrorMessage(err: unknown, table: Record<string, string>, fallback: string): string {
  if (err instanceof ApiError) {
    const known = table[err.code];
    if (known) return known;
    if (err.statusCode === 401) return 'Your session ended. Sign in again, then try again.';
    if (err.statusCode === 403) return 'You do not have access to do this.';
    if (err.statusCode >= 500) return `${fallback} The server had a problem. Nothing was lost.`;
    return fallback;
  }
  if (err instanceof TypeError) return 'No connection. Check your network, then try again.';
  return fallback;
}

/** The contract `code` of a failed call, or null (a network failure or an unknown error). */
export function scwErrorCode(err: unknown): string | null {
  return err instanceof ApiError ? err.code : null;
}

export const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError';
