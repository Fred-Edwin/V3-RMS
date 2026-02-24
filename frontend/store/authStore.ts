import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';
import { authService } from '@/services/authService';
import { ApiError } from '@/types/api';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  organizationId: string | null;
  role: AuthUser['role'] | null;
  isAuthenticated: boolean;
  setAuth: (input: { user: AuthUser; accessToken: string }) => void;
  refreshAccessToken: () => Promise<void>;
  hydrateSession: () => Promise<void>;
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

const decodeTokenClaims = (token: string): { role: AuthUser['role']; organizationId: string | null } | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as {
      role?: AuthUser['role'];
      organizationId?: string | null;
    };

    if (!payload.role) {
      return null;
    }

    return {
      role: payload.role,
      organizationId: payload.organizationId ?? null,
    };
  } catch {
    return null;
  }
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
    try {
      const { accessToken, user } = await authService.refreshToken();
      const claims = decodeTokenClaims(accessToken);
      setAccessTokenCookie(accessToken);
      scheduleRefresh(accessToken);
      set({
        user,
        accessToken,
        isAuthenticated: true,
        role: claims?.role ?? user.role,
        organizationId: claims?.organizationId ?? user.organizationId,
      });
    } catch (error) {
      if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
        useAuthStore.getState().clearAuth();
      }
    }
  },
  hydrateSession: async () => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      return;
    }

    await useAuthStore.getState().refreshAccessToken();
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
