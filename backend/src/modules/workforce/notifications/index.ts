import { setWorkforceNotifier } from '../_shared/events';
import { workforceNotifier } from './notification-service';
import type { NotifyData, NotifyOptions } from './notification-types';

/**
 * THE door of the Workforce notifier. Other modules call `notify` / `notifyMany` here (the built segments reach it through the
 * `told()` helper, which `registerWorkforceNotifier` points at this door). Best effort: these never throw.
 *
 *   notify(userId, kind, data?, options?)       one person, one Inbox row, a socket nudge and a push
 *   notifyMany(userIds, kind, data?, options?)  the same words to each person (duplicates removed)
 *
 * `kind` is a key of the server wording table (`wording-built.ts`, `wording-shared.ts`); `data` holds short facts (names with
 * roles, dates, month keys, counts) and never a pay figure, a code or a PIN. `options.dedupeKey` makes a repeat inside a window a
 * no-op (build it from kind, subject and the day or 15 minute window); with `replace` the existing row is rewritten instead.
 */
export const notify = (userId: string, kind: string, data: NotifyData = {}, options: NotifyOptions = {}): Promise<void> => workforceNotifier.send(userId, kind, data, options);

export async function notifyMany(userIds: readonly (string | null | undefined)[], kind: string, data: NotifyData = {}, options: NotifyOptions = {}): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => typeof id === 'string'))];
  await Promise.all(unique.map((id) => workforceNotifier.send(id, kind, data, options)));
}

/** Called once at start-up (routes/index.ts): every `told(...)` in the built segments is now really delivered. */
export function registerWorkforceNotifier(): void {
  setWorkforceNotifier({ notify: (userId, kind, data, options) => notify(userId, kind, data, options) });
}

export { default as workforceNotificationsRouter } from './notification-routes';
export { WORKFORCE_NOTICE_JOB, type HeldPush } from './notification-service';
export const dispatchHeldWorkforcePush = workforceNotifier.dispatchHeld;
export { renderNotification, knownKinds } from './notification-wording';
export type { NotifyData, NotifyOptions, NotificationTone, RenderedNotification } from './notification-types';
