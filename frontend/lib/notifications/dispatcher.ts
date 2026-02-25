import { resolveNotificationPolicy } from './policy';
import { notificationSoundPlayer } from './sound-player';
import type { NotificationDispatchContext, NotificationEvent } from './types';

const dedupeWindowByKey = new Map<string, number>();

// BUG 9 fix: prune entries older than this threshold to prevent unbounded growth.
const DEDUPE_PRUNE_THRESHOLD_MS = 30_000;

const pruneStaleDedupe = (now: number): void => {
  Array.from(dedupeWindowByKey.entries()).forEach(([key, ts]) => {
    if (now - ts > DEDUPE_PRUNE_THRESHOLD_MS) {
      dedupeWindowByKey.delete(key);
    }
  });
};

const shouldDispatch = (dedupeKey: string, dedupeWindowMs: number, now: number): boolean => {
  const lastTimestamp = dedupeWindowByKey.get(dedupeKey);
  if (typeof lastTimestamp === 'number' && now - lastTimestamp < dedupeWindowMs) {
    return false;
  }

  dedupeWindowByKey.set(dedupeKey, now);
  pruneStaleDedupe(now);
  return true;
};

export const dispatchNotificationEvent = (
  event: NotificationEvent,
  context: NotificationDispatchContext,
): void => {
  const policy = resolveNotificationPolicy(context.role, event);
  if (!policy) {
    return;
  }

  if (!shouldDispatch(policy.dedupeKey, policy.dedupeWindowMs, event.occurredAt)) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[notifications] dispatch', {
      type: event.type,
      role: context.role,
      channels: policy.channels,
      payload: event.payload,
    });
  }

  if (policy.channels.includes('sound')) {
    notificationSoundPlayer.play(event.type);
  }

  if (policy.channels.includes('toast') && policy.toast) {
    context.toast(policy.toast);
  }
};
