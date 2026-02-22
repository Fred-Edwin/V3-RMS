import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';
import { authService } from '@/services/authService';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  organizationId: string | null;
  role: AuthUser['role'] | null;
  isAuthenticated: boolean;
  setAuth: (input: { user: AuthUser; accessToken: string }) => void;
  refreshAccessToken: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const setAccessTokenCookie = (token: string | null): void => {
  if (typeof document === 'undefined') {
    return;
  }

  if (!token) {
    document.cookie = 'accessToken=; path=/; max-age=0; samesite=strict';
    return;
  }

  document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=900; samesite=strict`;
};

const decodeTokenExp = (token: string): number | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
};

const scheduleRefresh = (token: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const exp = decodeTokenExp(token);
  if (!exp) {
    return;
  }

  const msUntilRefresh = exp * 1000 - Date.now() - 60_000;
  const delay = Math.max(msUntilRefresh, 5_000);

  refreshTimer = setTimeout(() => {
    void useAuthStore.getState().refreshAccessToken();
  }, delay);
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  organizationId: null,
  role: null,
  isAuthenticated: false,
  setAuth: ({ user, accessToken }) => {
    setAccessTokenCookie(accessToken);
    scheduleRefresh(accessToken);
    set({
      user,
      accessToken,
      organizationId: user.organizationId,
      role: user.role,
      isAuthenticated: true,
    });
  },
  refreshAccessToken: async () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      return;
    }

    try {
      const { accessToken } = await authService.refreshToken();
      setAccessTokenCookie(accessToken);
      scheduleRefresh(accessToken);
      set({
        accessToken,
        isAuthenticated: true,
      });
    } catch {
      useAuthStore.getState().clearAuth();
    }
  },
  logout: async () => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      try {
        await authService.logout(accessToken);
      } catch {
        // No-op: state must still be cleared locally.
      }
    }

    useAuthStore.getState().clearAuth();
  },
  clearAuth: () => {
    setAccessTokenCookie(null);
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    set({
      user: null,
      accessToken: null,
      organizationId: null,
      role: null,
      isAuthenticated: false,
    });
  },
}));
