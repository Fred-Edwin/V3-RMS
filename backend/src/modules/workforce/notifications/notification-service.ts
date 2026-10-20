import { notificationQueue } from '../../../config/queues';
import { firebaseMessaging } from '../../../config/firebase';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';
import { nudgeUsers } from './nudge';
import { renderNotification } from './wording/notification-wording';
import { notificationRepository, type StoreResult } from './notification-repository';
import { isHeldInQuietHours, nextQuietHoursEnd } from './quiet-hours';
import type { NotifyData, NotifyOptions, RenderedNotification } from './notification-types';

export const WORKFORCE_NOTICE_JOB = 'workforce.notice.dispatch';

/** What a held push carries (plain JSON: the queue stores it). The row already exists; only the push waits. */
export interface HeldPush {
  userId: string;
  notificationId: string;
  title: string;
  body: string;
  href: string | null;
  tone: RenderedNotification['tone'];
}

export interface NotifierDeps {
  store: (userId: string, kind: string, rendered: RenderedNotification, dedupeKey: string | null, replace: boolean) => Promise<StoreResult>;
  tokensOf: (userId: string) => Promise<string[]>;
  push: (tokens: string[], push: HeldPush) => Promise<number>;
  nudge: (userId: string) => void;
  hold: (push: HeldPush, runAt: Date, now: Date) => Promise<void>;
  log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void };
}

/**
 * Delivers one notification to one person: the words rendered on the server, one Inbox row, the socket nudge, and an FCM push.
 * The push is held until 05:00 Nairobi when it is plain information sent between 22:00 and 05:00; everything else goes at once
 * (a problem is high priority). Best effort by design: nothing here ever throws, so the change that caused the notification is
 * never failed or undone by a delivery problem.
 */
export const createNotifier = (deps: NotifierDeps) => ({
  async send(userId: string, kind: string, data: NotifyData = {}, options: NotifyOptions = {}): Promise<void> {
    const now = options.now ?? new Date();
    try {
      const rendered = renderNotification(kind, data);
      const stored = await deps.store(userId, kind, rendered, options.dedupeKey ?? null, options.replace === true);
      if (!stored.created && !stored.replaced) return; // a duplicate inside its window
      deps.nudge(userId);
      if (!rendered.push || stored.replaced) return; // a running count updates the row; it does not ring the phone again
      const push: HeldPush = { userId, notificationId: stored.id, title: rendered.title, body: rendered.body, href: rendered.href, tone: rendered.tone };
      if (isHeldInQuietHours(rendered.tone, now)) {
        await deps.hold(push, nextQuietHoursEnd(now), now);
        return;
      }
      await deps.push(await deps.tokensOf(userId), push);
    } catch (error) {
      deps.log.warn({ error, kind }, 'workforce notification failed');
    }
  },

  /** The delayed job fires: the held push goes out now. The row has been in the Inbox since it was sent. */
  async dispatchHeld(push: HeldPush): Promise<void> {
    try {
      await deps.push(await deps.tokensOf(push.userId), push);
    } catch (error) {
      deps.log.warn({ error, notificationId: push.notificationId }, 'held workforce push failed');
    }
  },
});

// --- the real wiring: Firebase, BullMQ, Socket.io ---------------------------------------------------------------------

const defaultDeps: NotifierDeps = {
  store: notificationRepository.store,
  tokensOf: notificationRepository.fcmTokensOf,
  push: async (tokens, push) => {
    if (!firebaseMessaging || !env.VAPID_KEY || tokens.length === 0) return 0;
    await firebaseMessaging.sendEachForMulticast({
      tokens,
      webpush: {
        headers: { Urgency: push.tone === 'problem' ? 'high' : 'normal' },
        notification: { title: push.title, body: push.body, icon: '/android-chrome-192x192.png', badge: '/android-chrome-192x192.png', tag: `workforce-${push.notificationId}` },
        fcmOptions: { link: push.href ?? '/app/inbox' },
      },
      data: { type: 'workforce_notification', id: push.notificationId, href: push.href ?? '' },
    });
    return tokens.length;
  },
  nudge: (userId) => nudgeUsers([userId], 'workforce:notifications'),
  hold: async (push, runAt, now) => {
    await notificationQueue.add(WORKFORCE_NOTICE_JOB, push, { delay: Math.max(0, runAt.getTime() - now.getTime()), jobId: `workforce-notice-${push.notificationId}`, removeOnComplete: true });
  },
  log: logger,
};

export const workforceNotifier = createNotifier(defaultDeps);
