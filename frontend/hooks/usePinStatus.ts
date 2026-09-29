import { useCallback, useEffect, useState } from "react";

import { authService } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";

export interface PinStatus {
  /** `null` until the first answer arrives (or when the lookup failed — see `failed`). */
  hasPin: boolean | null;
  loading: boolean;
  failed: boolean;
  /** Re-reads the status from the server. Stable reference. */
  refresh: () => void;
  /** Records a successful set locally, so the UI flips without another round trip. */
  markSet: () => void;
}

/**
 * The caller's signing-PIN status. Re-fetched every time `enabled` flips true
 * (each Sign Sheet open), so a Store Manager's PIN reset takes effect on the
 * attendant's very next signing without a re-login.
 */
export function usePinStatus(enabled: boolean): PinStatus {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled || !accessToken) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    authService
      .getPinStatus(accessToken)
      .then((status) => {
        if (!cancelled) setHasPin(status.hasPin);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, accessToken, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const markSet = useCallback(() => setHasPin(true), []);

  return { hasPin, loading, failed, refresh, markSet };
}
