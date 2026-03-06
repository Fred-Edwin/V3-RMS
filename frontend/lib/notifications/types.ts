import type { AppRole } from '@/types/auth';
import type { PrepStation } from '@/types/order';

export type NotificationEventType =
  | 'order:new'
  | 'order:claimed'
  | 'order:ready'
  | 'order:all_ready'
  | 'order:paid'
  | 'order:force_cancelled'
  | 'ticket:rejected'
  | 'ticket:unclaimed'
  | 'modification:requested'
  | 'modification:reviewed';

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
  'order:ready': {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    dailyNumber: number;
  };
  'order:all_ready': {
    orderId: string;
    dailyNumber: number;
  };
  'order:paid': {
    orderId: string;
    dailyNumber: number;
  };
  'order:force_cancelled': {
    orderId: string;
  };
  'ticket:rejected': {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    reason: string;
  };
  'ticket:unclaimed': {
    orderId: string;
    ticketId: string;
    station: PrepStation;
  };
  'modification:requested': {
    id: string;
    orderId: string;
    description: string;
    requestedBy: { id: string; name: string };
  };
  'modification:reviewed': {
    id: string;
    orderId: string;
    status: 'APPROVED' | 'REJECTED';
    reviewNote?: string;
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
