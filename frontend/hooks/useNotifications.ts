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
import { useToast } from './useToast';
import type { PrepTicketDetail } from '@/types/order';

const joinRoleRooms = (
  role: ReturnType<typeof useAuthStore.getState>['role'],
  organizationId: string | null,
  userId: string | null,
): void => {
  if (!role || !organizationId) {
    return;
  }

  if (role === 'WAITER') {
    joinBranchRoom(organizationId);
    if (userId) {
      joinUserRoom(userId);
    }
    return;
  }

  if (role === 'MANAGER') {
    joinBranchRoom(organizationId);
    return;
  }

  if (role === 'CHEF' || role === 'KITCHEN_DISPLAY') {
    joinStationRoom(organizationId, 'KITCHEN');
    return;
  }

  if (role === 'BARISTA' || role === 'BARISTA_DISPLAY') {
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

  useEffect(() => {
    if (!pathname.startsWith('/app') || !env.notificationsV2 || !accessToken || !role) {
      return;
    }

    connectSocket(accessToken);
    joinRoleRooms(role, organizationId, userId);

    const socket = getSocket();
    if (!socket) {
      return;
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

    const handleOrderClaimed = (payload: {
      orderId: string;
      ticketId: string;
      station: PrepTicketDetail['station'];
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
            claimedByName: payload.claimedBy.name,
          },
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

    socket.on('order:new', handleOrderNew);
    socket.on('order:claimed', handleOrderClaimed);
    socket.on('order:all_ready', handleOrderAllReady);

    const offReconnect = onReconnect(() => {
      joinRoleRooms(role, organizationId, userId);
    });

    return () => {
      socket.off('order:new', handleOrderNew);
      socket.off('order:claimed', handleOrderClaimed);
      socket.off('order:all_ready', handleOrderAllReady);
      offReconnect();
    };
  }, [accessToken, organizationId, pathname, role, toast, userId]);
};
