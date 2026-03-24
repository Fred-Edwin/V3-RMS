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
        message: ({ KITCHEN: 'Sent to kitchen queue.', PIZZA: 'Sent to pizza queue.', PASTRY: 'Sent to pastry queue.', BARISTA: 'Sent to barista queue.' } as Record<string, string>)[event.payload.station] ?? `Sent to ${event.payload.station.toLowerCase()} queue.`,
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
          title: event.payload.dailyNumber != null
            ? `Order #${event.payload.dailyNumber} claimed`
            : 'Order claimed',
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

  if (event.type === 'order:ready') {
    if (role !== 'WAITER') {
      return null;
    }

    return {
      channels: ['toast'],
      toast: {
        variant: 'info',
        title: `Station ready — Order #${event.payload.dailyNumber}`,
        message: `${(event.payload.station as string).charAt(0) + (event.payload.station as string).slice(1).toLowerCase()} station done.`,
      },
      dedupeKey: `${event.type}:${event.payload.ticketId}`,
      dedupeWindowMs: 5000,
    };
  }

  if (event.type === 'order:paid') {
    if (role !== 'WAITER') {
      return null;
    }

    return {
      channels: ['sound', 'toast'],
      toast: {
        variant: 'success',
        title: `Payment confirmed — Order #${event.payload.dailyNumber}`,
        message: 'Order is closed.',
      },
      dedupeKey: `${event.type}:${event.payload.orderId}`,
      dedupeWindowMs: 5000,
    };
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

  if (event.type === 'order:force_cancelled') {
    if (role !== 'WAITER') {
      return null;
    }

    return {
      channels: ['sound', 'toast'],
      toast: {
        variant: 'warning',
        title: 'Order force-cancelled by manager',
        message: 'An in-progress order was cancelled.',
      },
      dedupeKey: `${event.type}:${event.payload.orderId}`,
      dedupeWindowMs: 5000,
    };
  }

  if (event.type === 'ticket:rejected') {
    if (role !== 'WAITER') {
      return null;
    }

    return {
      channels: ['sound', 'toast'],
      toast: {
        variant: 'warning',
        title: 'Ticket sent back',
        message: `${event.payload.reason} — you can now edit or cancel.`,
      },
      dedupeKey: `${event.type}:${event.payload.ticketId}`,
      dedupeWindowMs: 5000,
    };
  }

  if (event.type === 'ticket:unclaimed') {
    if (role !== 'WAITER') {
      return null;
    }

    return {
      channels: ['toast'],
      toast: {
        variant: 'warning',
        title: 'Ticket unclaimed',
        message: `A ${event.payload.station.toLowerCase()} ticket was returned to pending.`,
      },
      dedupeKey: `${event.type}:${event.payload.ticketId}`,
      dedupeWindowMs: 5000,
    };
  }

  return null;
};
