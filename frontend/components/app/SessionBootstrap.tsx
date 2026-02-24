'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { useFcmToken } from '@/hooks/useFcmToken';
import { useAuthStore } from '@/store/authStore';

export function SessionBootstrap(): null {
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);

  useEffect(() => {
    if (!pathname.startsWith('/app')) {
      return;
    }

    if (!accessToken) {
      void hydrateSession();
    }
  }, [accessToken, hydrateSession, pathname]);

  useNotifications();
  useFcmToken();
  return null;
}
