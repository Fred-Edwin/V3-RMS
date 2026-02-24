import type { AppRole } from '@/types/auth';
import type { NotificationEvent, NotificationPolicy } from './types';

const isPrepRole = (role: AppRole | null): boolean => {
  return role === 'CHEF' || role === 'BARISTA' || role === 'KITCHEN_DISPLAY' || role === 'BARISTA_DISPLAY';
};

export const resolveNotificationPolicy = (
  role: AppRole | null,
  event: NotificationEvent,
): NotificationPolicy | null => {
  if (!role) {
    return null;
  }

  if (event.type === 'order:new') {
    if (!isPrepRole(role)) {
      return null;
    }

    return {
      channels: ['sound', 'toast'],
      toast: {
        variant: 'info',
        title: `New order #${event.payload.dailyNumber}`,
        message: event.payload.station === 'KITCHEN' ? 'Sent to kitchen queue.' : 'Sent to barista queue.',
      },
      dedupeKey: `${event.type}:${event.payload.orderId}:${event.payload.station}`,
      dedupeWindowMs: 3000,
    };
  }

  if (event.type === 'order:claimed') {
    if (event.source === 'local' && (role === 'CHEF' || role === 'BARISTA')) {
      return {
        channels: ['sound', 'toast'],
        toast: {
          variant: 'success',
          title: `Order #${event.payload.dailyNumber ?? ''} claimed`.trim(),
          message: 'Ticket moved to in-progress.',
        },
        dedupeKey: `${event.type}:${event.payload.ticketId}:local`,
        dedupeWindowMs: 1500,
      };
    }

    if (role === 'WAITER') {
      return {
        channels: ['toast'],
        toast: {
          variant: 'info',
          title: `Order claimed`,
          message: event.payload.claimedByName
            ? `${event.payload.claimedByName} started preparation.`
            : 'Preparation has started.',
        },
        dedupeKey: `${event.type}:${event.payload.ticketId}:waiter`,
        dedupeWindowMs: 2000,
      };
    }

    return null;
  }

  if (event.type === 'order:all_ready') {
    if (role !== 'WAITER') {
      return null;
    }

    return {
      channels: ['sound', 'toast'],
      toast: {
        variant: 'success',
        title: `Order #${event.payload.dailyNumber} is ready`,
        message: 'Collect and proceed to payment.',
      },
      dedupeKey: `${event.type}:${event.payload.orderId}`,
      dedupeWindowMs: 10000,
    };
  }

  return null;
};
