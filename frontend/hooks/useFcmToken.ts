'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from '@/lib/firebase';
import { env } from '@/lib/env';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';

const notificationRoles: AppRole[] = ['WAITER', 'CHEF', 'BARISTA'];

const shouldRegisterRole = (role: AppRole | null): role is AppRole => {
  if (!role) {
    return false;
  }

  return notificationRoles.includes(role);
};

const storageKeyForUser = (userId: string): string => `wendo:rms:fcm:${userId}`;
const dismissKeyForUser = (userId: string): string => `wendo:rms:fcm:dismissed:${userId}`;

const supportsNotifications = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'Notification' in window && 'serviceWorker' in navigator;
};

const registerMessagingToken = async (input: { accessToken: string; userId: string }): Promise<void> => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return;
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey: env.firebaseVapidKey,
    serviceWorkerRegistration,
  });

  if (!token) {
    return;
  }

  const storageKey = storageKeyForUser(input.userId);
  const existingToken = window.localStorage.getItem(storageKey);
  if (existingToken === token) {
    return;
  }

  await authService.registerDevice({ fcmToken: token }, input.accessToken);
  window.localStorage.setItem(storageKey, token);
};

export const requestAndRegisterFcmToken = async (input: {
  accessToken: string;
  userId: string;
}): Promise<NotificationPermission | 'unsupported'> => {
  if (!supportsNotifications()) {
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return permission;
  }

  await registerMessagingToken(input);
  return permission;
};

interface UseFcmTokenResult {
  isSupported: boolean;
  canPrompt: boolean;
  isRegistering: boolean;
  permission: NotificationPermission | 'unsupported';
  requestPermissionAndRegister: () => Promise<void>;
  dismissPrompt: () => void;
}

export const useFcmToken = (): UseFcmTokenResult => {
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supportsNotifications() ? Notification.permission : 'unsupported',
  );

  const isEligible = useMemo(() => {
    return (
      pathname.startsWith('/app') &&
      Boolean(accessToken) &&
      Boolean(userId) &&
      shouldRegisterRole(role) &&
      env.firebaseVapidKey.length > 0 &&
      supportsNotifications()
    );
  }, [accessToken, pathname, role, userId]);

  useEffect(() => {
    if (!userId || !supportsNotifications()) {
      return;
    }

    setIsPromptDismissed(window.localStorage.getItem(dismissKeyForUser(userId)) === '1');
    setPermission(Notification.permission);
  }, [userId]);

  useEffect(() => {
    if (!isEligible || !accessToken || !userId) {
      return;
    }

    if (permission !== 'granted') {
      return;
    }

    let isCancelled = false;
    setIsRegistering(true);

    void registerMessagingToken({ accessToken, userId })
      .catch(() => {
        // Token registration should never block app usage.
      })
      .finally(() => {
        if (!isCancelled) {
          setIsRegistering(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accessToken, isEligible, permission, userId]);

  const requestPermissionAndRegister = useCallback(async (): Promise<void> => {
    if (!isEligible || !accessToken || !userId) {
      return;
    }

    setIsRegistering(true);
    try {
      const nextPermission = await requestAndRegisterFcmToken({ accessToken, userId });
      if (nextPermission !== 'unsupported') {
        setPermission(nextPermission);
      }
      if (nextPermission === 'granted') {
        setIsPromptDismissed(true);
      }
    } catch {
      // Fail silently by design.
    } finally {
      setIsRegistering(false);
    }
  }, [accessToken, isEligible, userId]);

  const dismissPrompt = useCallback(() => {
    if (!userId || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(dismissKeyForUser(userId), '1');
    setIsPromptDismissed(true);
  }, [userId]);

  return {
    isSupported: permission !== 'unsupported',
    canPrompt: isEligible && permission === 'default' && !isPromptDismissed,
    isRegistering,
    permission,
    requestPermissionAndRegister,
    dismissPrompt,
  };
};
