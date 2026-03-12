'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { useFcmToken } from '@/hooks/useFcmToken';
import { roleHome } from '@/lib/role-home';
import { notificationSoundPlayer } from '@/lib/notifications/sound-player';
import { useAuthStore } from '@/store/authStore';

export function SessionBootstrap(): null {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);

  // Attempt session hydration on /app/* pages when no access token exists
  useEffect(() => {
    if (!pathname.startsWith('/app')) {
      return;
    }

    if (!accessToken) {
      void hydrateSession();
    }
  }, [accessToken, hydrateSession, pathname]);

  // After hydration completes, redirect to login if still unauthenticated
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (pathname.startsWith('/app') && !isAuthenticated) {
      const loginUrl = `/login?next=${encodeURIComponent(pathname)}`;
      router.replace(loginUrl);
    }
  }, [isHydrated, isAuthenticated, pathname, router]);

  // Redirect authenticated users away from /login to their role home
  useEffect(() => {
    if (pathname === '/login' && isAuthenticated && role) {
      const nextParam = new URLSearchParams(window.location.search).get('next');
      router.replace(nextParam || roleHome[role]);
    }
  }, [pathname, isAuthenticated, role, router]);

  // Unlock audio on the first user gesture anywhere in the app.
  // Required for browsers that block autoplay until a gesture occurs.
  // The KDS/BDS fullscreen overlay handles its own unlock; this covers
  // all other roles (WAITER, CHEF, BARISTA on phone/dashboard).
  useEffect(() => {
    if (notificationSoundPlayer.isUnlocked()) {
      return;
    }

    const unlock = () => { notificationSoundPlayer.unlock(); };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchend', unlock, { once: true });

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchend', unlock);
    };
  }, []);

  useNotifications();
  useFcmToken();
  return null;
}
