import { notificationQueue } from '../../../../config/queues';
import { firebaseMessaging } from '../../../../config/firebase';
import { env } from '../../../../config/env';
import { authRepository } from '../../../../repositories/auth-repository';
import { logger } from '../../../../utils/logger';
import { fmtKes } from './count-format';
import { firstNameOf } from './count-people';
import { inQuietHours, nextQuietHoursEnd } from './count-time';

/**
 * Counting's two pushes (contract §5.7), both fire-and-forget AFTER the transaction commits:
 *   - a SUBMIT: the Store Manager hears that an Attendant signed a count;
 *   - a Director ALERT: a line at or above the alert amount. Quiet hours 22:00 to 05:00 Africa/Nairobi hold it until 05:00
 *     (a delayed queue job); there is no inbox row (the Inbox is chat only), the flagged list is the in-app place.
 * Push only: a failure is logged and never fails a count.
 */
export const COUNT_DIRECTOR_ALERT_JOB = 'count.director-alert.dispatch';
export const COUNTS_PATH = '/app/inventory/stock/counts';
export const FLAGGED_PATH = `${COUNTS_PATH}?view=flagged`;

export type PushMessage = { title: string; body: string; link: string; tag: string; data: Record<string, string>; urgency: 'normal' | 'high' };

export type SubmitPush = { countId: string; reference: string; counterName: string; itemsCounted: number };

export type AlertLine = { itemName: string; /** Signed KES: negative is short. */ valueKes: number };
export type DirectorAlertJob = { countId: string; reference: string; signerName: string; alertKes: number; lines: AlertLine[] };

// --- The words (the voice of Paper steps 15 and 46) -------------------------------

export const submitMessage = (p: SubmitPush): PushMessage => ({
  title: 'A count is waiting for you',
  body: `${firstNameOf(p.counterName)} submitted ${p.reference} · ${p.itemsCounted} ${p.itemsCounted === 1 ? 'item' : 'items'} counted`,
  link: COUNTS_PATH,
  tag: `count-submitted-${p.countId}`,
  data: { type: 'count_submitted', countId: p.countId },
  urgency: 'normal',
});

const lineText = (line: AlertLine): string => `${line.itemName} ${line.valueKes < 0 ? 'short' : 'over'} ${fmtKes(line.valueKes)}`;

/** "Isabel signed a count: Eggs short KES 5,200. Over your KES 5,000 alert. Tap to open it" */
export const alertMessage = (job: DirectorAlertJob): PushMessage => {
  const largest = [...job.lines].sort((a, b) => Math.abs(b.valueKes) - Math.abs(a.valueKes))[0];
  const detail =
    job.lines.length <= 1 && largest
      ? `${lineText(largest)}. Over your ${fmtKes(job.alertKes)} alert.`
      : `${job.lines.length} lines are over your ${fmtKes(job.alertKes)} alert, the largest ${largest ? lineText(largest) : ''}.`;
  return {
    title: 'Large stock difference',
    body: `${firstNameOf(job.signerName)} signed a count: ${detail} Tap to open it`,
    link: FLAGGED_PATH,
    tag: `count-director-alert-${job.countId}`,
    data: { type: 'count_director_alert', countId: job.countId },
    urgency: 'high',
  };
};

/** Quiet hours decide when the alert goes out: now, or at 05:00 Nairobi. Pure, so a test passes a fixed clock. */
export const alertSchedule = (now: Date): { sendNow: boolean; runAt: Date } => ({ sendNow: !inQuietHours(now), runAt: nextQuietHoursEnd(now) });

// --- The sending, behind one small interface so tests pass fakes ----------------

export interface CountNotifierDeps {
  sendToStoreManagers: (siteId: string, message: PushMessage) => Promise<number>;
  sendToDirectors: (message: PushMessage) => Promise<number>;
  scheduleDirectorAlert: (job: DirectorAlertJob, runAt: Date, now: Date) => Promise<void>;
  log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void };
}

export const createCountNotifier = (deps: CountNotifierDeps) => ({
  /** The Store Manager hears an Attendant signed. */
  submitted: async (siteId: string, push: SubmitPush): Promise<void> => {
    try {
      const sent = await deps.sendToStoreManagers(siteId, submitMessage(push));
      deps.log.info({ countId: push.countId, reference: push.reference, recipients: sent }, 'Count submitted push sent');
    } catch (error) {
      deps.log.warn({ error, countId: push.countId }, 'Failed to send count submitted push');
    }
  },

  /** The Directors hear of lines at or above the alert amount; held until 05:00 in quiet hours. No lines, no push. */
  directorAlert: async (job: DirectorAlertJob, now: Date): Promise<void> => {
    if (job.lines.length === 0) return;
    try {
      const schedule = alertSchedule(now);
      if (schedule.sendNow) {
        const sent = await deps.sendToDirectors(alertMessage(job));
        deps.log.info({ countId: job.countId, reference: job.reference, lines: job.lines.length, recipients: sent }, 'Count director alert push sent');
      } else {
        await deps.scheduleDirectorAlert(job, schedule.runAt, now);
        deps.log.info({ countId: job.countId, reference: job.reference, lines: job.lines.length, runAt: schedule.runAt.toISOString() }, 'Count director alert push held for quiet hours');
      }
    } catch (error) {
      deps.log.warn({ error, countId: job.countId }, 'Failed to send count director alert push');
    }
  },

  /** The delayed job fires: the held alert goes out. */
  dispatchDirectorAlertJob: async (job: DirectorAlertJob): Promise<void> => {
    try {
      const sent = await deps.sendToDirectors(alertMessage(job));
      deps.log.info({ countId: job.countId, reference: job.reference, recipients: sent }, 'Held count director alert push sent');
    } catch (error) {
      deps.log.warn({ error, countId: job.countId }, 'Failed to send held count director alert push');
    }
  },
});

// --- The real wiring (Firebase and BullMQ) ---------------------------------------

const send = async (tokens: string[], message: PushMessage): Promise<number> => {
  if (!firebaseMessaging || !env.VAPID_KEY || tokens.length === 0) return 0;
  await firebaseMessaging.sendEachForMulticast({
    tokens,
    webpush: {
      headers: { Urgency: message.urgency },
      notification: { title: message.title, body: message.body, icon: '/android-chrome-192x192.png', badge: '/android-chrome-192x192.png', tag: message.tag },
      fcmOptions: { link: message.link },
    },
    data: message.data,
  });
  return tokens.length;
};

const defaultDeps: CountNotifierDeps = {
  sendToStoreManagers: async (siteId, message) => send(await authRepository.findFcmTokensByRole(siteId, ['STORE_MANAGER']), message),
  sendToDirectors: async (message) => send(await authRepository.findDirectorFcmTokens(), message),
  scheduleDirectorAlert: async (job, runAt, now) => {
    // One held alert per count: a replayed sign cannot queue a second.
    await notificationQueue.add(COUNT_DIRECTOR_ALERT_JOB, job, { delay: Math.max(0, runAt.getTime() - now.getTime()), jobId: `count-director-alert-${job.countId}`, removeOnComplete: true });
  },
  log: logger,
};

export const countNotify = createCountNotifier(defaultDeps);
