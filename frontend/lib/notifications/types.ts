import type { AppRole } from '@/types/auth';
import type { PrepStation } from '@/types/order';

export type NotificationEventType = 'order:new' | 'order:claimed' | 'order:all_ready';

export type NotificationChannel = 'sound' | 'toast' | 'push';

export interface NotificationEventPayloadMap {
  'order:new': {
    orderId: string;
    dailyNumber: number;
    station: PrepStation;
  };
  'order:claimed': {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    claimedByName?: string;
    dailyNumber?: number;
  };
  'order:all_ready': {
    orderId: string;
    dailyNumber: number;
  };
}

export type NotificationEvent = {
  [K in NotificationEventType]: {
    type: K;
    payload: NotificationEventPayloadMap[K];
    source: 'socket' | 'local';
    occurredAt: number;
  };
}[NotificationEventType];

export interface NotificationToastConfig {
  variant: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

export interface NotificationPolicy {
  channels: NotificationChannel[];
  toast?: NotificationToastConfig;
  dedupeKey: string;
  dedupeWindowMs: number;
}

export interface NotificationDispatchContext {
  role: AppRole | null;
  toast: (input: NotificationToastConfig) => void;
}
