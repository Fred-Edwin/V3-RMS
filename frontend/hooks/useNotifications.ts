'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  connectSocket,
  getSocket,
  joinBranchRoom,
  joinStationRoom,
  joinUserRoom,
  onReconnect,
} from '@/lib/socket';
import { dispatchNotificationEvent } from '@/lib/notifications/dispatcher';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { useIncidentStore } from '@/store/incidentStore';
import { useToast } from './useToast';
import type { PrepTicketDetail, PrepStation } from '@/types/order';

const joinRoleRooms = (
  role: ReturnType<typeof useAuthStore.getState>['role'],
  organizationId: string | null,
  userId: string | null,
): void => {
  if (!role) return;

  // System-level roles have no organizationId — they are auto-joined to their
  // user room server-side on connect, so no client-side join:branch is needed.
  if (role === 'DIRECTOR' || role === 'HR_MANAGER') {
    if (userId) joinUserRoom(userId);
    return;
  }

  if (!organizationId) return;

  if (role === 'WAITER') {
    joinBranchRoom(organizationId);
    if (userId) {
      joinUserRoom(userId);
    }
    return;
  }

  if (role === 'MANAGER') {
    joinBranchRoom(organizationId);
    if (userId) joinUserRoom(userId);
    return;
  }

  if (role === 'ACCOUNTANT') {
    joinBranchRoom(organizationId);
    if (userId) joinUserRoom(userId);
    return;
  }

  if (role === 'CHEF') {
    joinBranchRoom(organizationId);
    joinStationRoom(organizationId, 'KITCHEN');
    return;
  }

  if (role === 'KITCHEN_DISPLAY') {
    joinStationRoom(organizationId, 'KITCHEN');
    return;
  }

  if (role === 'BARISTA') {
    joinBranchRoom(organizationId);
    joinStationRoom(organizationId, 'BARISTA');
    return;
  }

  if (role === 'BARISTA_DISPLAY') {
    joinStationRoom(organizationId, 'BARISTA');
  }
};

export const useNotifications = (): void => {
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const organizationId = useAuthStore((state) => state.organizationId);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { toast } = useToast();
  const incrementUnread = useIncidentStore((state) => state.incrementUnread);

  useEffect(() => {
    if (!pathname.startsWith('/app') || !env.notificationsV2 || !accessToken || !role) {
      return;
    }

    connectSocket(accessToken);

    const socket = getSocket();
    if (!socket) {
      return;
    }

    // BUG 6 fix: defer room joins until after the socket has connected and the
    // server-side auth middleware has validated the token. Emitting join events
    // before the handshake completes can result in them being silently dropped.
    const handleConnect = () => {
      joinRoleRooms(role, organizationId, userId);
    };

    socket.on('connect', handleConnect);

    // If the socket is already connected (e.g. effect re-runs after hot-reload),
    // join rooms immediately so we don't wait for the next connect event.
    if (socket.connected) {
      joinRoleRooms(role, organizationId, userId);
    }

    const handleOrderNew = (payload: PrepTicketDetail) => {
      dispatchNotificationEvent(
        {
          type: 'order:new',
          source: 'socket',
          occurredAt: Date.now(),
          payload: {
            orderId: payload.orderId,
            dailyNumber: payload.orderDailyNumber,
            station: payload.station,
          },
        },
        { role, toast },
      );
    };

    // BUG 7 fix: forward dailyNumber from the updated payload so the waiter
    // toast can display the correct order number.
    const handleOrderClaimed = (payload: {
      orderId: string;
      ticketId: string;
      station: PrepStation;
      dailyNumber: number;
      claimedBy: { id: string; name: string };
    }) => {
      dispatchNotificationEvent(
        {
          type: 'order:claimed',
          source: 'socket',
          occurredAt: Date.now(),
          payload: {
            orderId: payload.orderId,
            ticketId: payload.ticketId,
            station: payload.station,
            dailyNumber: payload.dailyNumber,
            claimedByName: payload.claimedBy.name,
          },
        },
        { role, toast },
      );
    };

    // BUG 1 fix: handle order:ready (individual station marked ready).
    const handleOrderReady = (payload: {
      orderId: string;
      ticketId: string;
      station: PrepStation;
      dailyNumber: number;
    }) => {
      dispatchNotificationEvent(
        {
          type: 'order:ready',
          source: 'socket',
          occurredAt: Date.now(),
          payload,
        },
        { role, toast },
      );
    };

    const handleOrderAllReady = (payload: { orderId: string; dailyNumber: number }) => {
      dispatchNotificationEvent(
        {
          type: 'order:all_ready',
          source: 'socket',
          occurredAt: Date.now(),
          payload,
        },
        { role, toast },
      );
    };

    // BUG 3 fix: handle order:paid emitted by backend after payment is recorded.
    const handleOrderPaid = (payload: { orderId: string; dailyNumber: number }) => {
      dispatchNotificationEvent(
        {
          type: 'order:paid',
          source: 'socket',
          occurredAt: Date.now(),
          payload,
        },
        { role, toast },
      );
    };

    const handleForceCancelled = (payload: { orderId: string }) => {
      dispatchNotificationEvent(
        { type: 'order:force_cancelled', source: 'socket', occurredAt: Date.now(), payload },
        { role, toast },
      );
    };

    const handleTicketRejected = (payload: {
      orderId: string;
      ticketId: string;
      station: PrepStation;
      reason: string;
    }) => {
      dispatchNotificationEvent(
        { type: 'ticket:rejected', source: 'socket', occurredAt: Date.now(), payload },
        { role, toast },
      );
    };

    const handleTicketUnclaimed = (payload: {
      orderId: string;
      ticketId: string;
      station: PrepStation;
    }) => {
      dispatchNotificationEvent(
        { type: 'ticket:unclaimed', source: 'socket', occurredAt: Date.now(), payload },
        { role, toast },
      );
    };

    const handleIncidentNew = () => {
      if (role === 'MANAGER' || role === 'DIRECTOR') {
        incrementUnread();
      }
    };

    socket.on('order:new', handleOrderNew);
    socket.on('order:claimed', handleOrderClaimed);
    socket.on('order:ready', handleOrderReady);
    socket.on('order:all_ready', handleOrderAllReady);
    socket.on('order:paid', handleOrderPaid);
    socket.on('order:force_cancelled', handleForceCancelled);
    socket.on('ticket:rejected', handleTicketRejected);
    socket.on('ticket:unclaimed', handleTicketUnclaimed);
    socket.on('incident:new', handleIncidentNew);

    const offReconnect = onReconnect(() => {
      joinRoleRooms(role, organizationId, userId);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('order:new', handleOrderNew);
      socket.off('order:claimed', handleOrderClaimed);
      socket.off('order:ready', handleOrderReady);
      socket.off('order:all_ready', handleOrderAllReady);
      socket.off('order:paid', handleOrderPaid);
      socket.off('order:force_cancelled', handleForceCancelled);
      socket.off('ticket:rejected', handleTicketRejected);
      socket.off('ticket:unclaimed', handleTicketUnclaimed);
      socket.off('incident:new', handleIncidentNew);
      offReconnect();
    };
  }, [accessToken, incrementUnread, organizationId, pathname, role, toast, userId]);
};
