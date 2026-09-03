import { create } from 'zustand';
import type { AuthUser, DepartmentTag } from '@/types/auth';
import { authService } from '@/services/authService';
import { ApiError } from '@/types/api';
import { env } from '@/lib/env';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  organizationId: string | null;
  role: AuthUser['role'] | null;
  departmentTag: DepartmentTag | null;
  isDepartmentHead: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (input: { user: AuthUser; accessToken: string }) => void;
  refreshAccessToken: () => Promise<void>;
  hydrateSession: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight: Promise<void> | null = null;

const setAccessTokenCookie = (token: string | null): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const securePart = isHttps ? '; secure' : '';
  const domainPart = env.cookieDomain ? `; domain=${env.cookieDomain}` : '';

  if (!token) {
    document.cookie = `accessToken=; path=/; max-age=0; samesite=lax${securePart}${domainPart}`;
    return;
  }

  document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=900; samesite=lax${securePart}${domainPart}`;
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

const decodeTokenClaims = (
  token: string,
): {
  role: AuthUser['role'];
  organizationId: string | null;
  departmentTag: DepartmentTag | null;
  isDepartmentHead: boolean;
} | null => {
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
      departmentTag?: DepartmentTag | null;
      isDepartmentHead?: boolean;
    };

    if (!payload.role) {
      return null;
    }

    return {
      role: payload.role,
      organizationId: payload.organizationId ?? null,
      departmentTag: payload.departmentTag ?? null,
      isDepartmentHead: payload.isDepartmentHead ?? false,
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
  departmentTag: null,
  isDepartmentHead: false,
  isAuthenticated: false,
  isHydrated: false,
  setAuth: ({ user, accessToken }) => {
    setAccessTokenCookie(accessToken);
    scheduleRefresh(accessToken);
    const claims = decodeTokenClaims(accessToken);
    set({
      user,
      accessToken,
      organizationId: user.organizationId,
      role: user.role,
      departmentTag: claims?.departmentTag ?? user.departmentTag ?? null,
      isDepartmentHead: claims?.isDepartmentHead ?? user.isDepartmentHead ?? false,
      isAuthenticated: true,
      isHydrated: true,
    });
  },
  refreshAccessToken: async () => {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    refreshInFlight = (async () => {
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
          departmentTag: claims?.departmentTag ?? user.departmentTag ?? null,
          isDepartmentHead: claims?.isDepartmentHead ?? user.isDepartmentHead ?? false,
        });
      } catch (error) {
        if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
          useAuthStore.getState().clearAuth();
        }
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  },
  hydrateSession: async () => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      set({ isHydrated: true });
      return;
    }

    await useAuthStore.getState().refreshAccessToken();
    set({ isHydrated: true });
  },
  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // No-op: state must still be cleared locally.
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
      departmentTag: null,
      isDepartmentHead: false,
      isAuthenticated: false,
    });
  },
}));
