import { useCallback, useRef } from 'react';

const newKey = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * One idempotency key per form, made when the form opens and reused for every submit of it, so a double tap or Enter twice cannot
 * write twice. Call `renew` after a successful submit when the same form stays open for another entry. Stable references.
 */
export function useIdempotencyKey(): { key: () => string; renew: () => void } {
  const ref = useRef<string | null>(null);
  const key = useCallback((): string => {
    ref.current ??= newKey();
    return ref.current;
  }, []);
  const renew = useCallback((): void => {
    ref.current = null;
  }, []);
  return { key, renew };
}
