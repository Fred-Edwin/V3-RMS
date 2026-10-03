import type { Queue } from 'bullmq';
import { commsRepository } from '../repositories/comms-repository';
import { fcmService } from '../services/fcm-service';
import { logger } from '../utils/logger';

/**
 * Runs every 30 minutes.
 * - 24h pass: find unacknowledged notice recipients older than 24h that haven't had
 *   a reminder sent yet → send push → mark reminder24SentAt.
 * - 48h pass: find unacknowledged notice recipients older than 48h that haven't had
 *   an escalation sent yet → find director tokens → send escalation push → mark escalation48SentAt.
 */
export const checkFormalNoticeReminders = async (): Promise<void> => {
  // ── 24h reminders ──────────────────────────────────────────────────────────
  const pending24 = await commsRepository.findUnacknowledgedAfter24h();
  let reminded = 0;
  for (const row of pending24) {
    await fcmService.sendFormalNoticePush(row.user.id, {
      noticeId: row.notice.id,
      subject: row.notice.subject,
    });
    await commsRepository.markReminder24Sent(row.id);
    reminded++;
  }
  if (reminded > 0) {
    logger.info({ reminded }, 'Formal notice 24h reminders sent');
  }

  // ── 48h escalations ────────────────────────────────────────────────────────
  const pending48 = await commsRepository.findUnacknowledgedAfter48h();
  // Group by organizationId to batch director lookups
  const byOrg = new Map<string, typeof pending48>();
  for (const row of pending48) {
    const orgId = row.notice.siteId;
    const existing = byOrg.get(orgId);
    if (existing) {
      existing.push(row);
    } else {
      byOrg.set(orgId, [row]);
    }
  }

  let escalated = 0;
  for (const [orgId, rows] of byOrg.entries()) {
    const directors = await commsRepository.findDirectorsForOrg(orgId);
    const directorTokens = directors
      .map((d) => d.fcmToken)
      .filter((t): t is string => t !== null);

    for (const row of rows) {
      await fcmService.sendFormalNoticeEscalationPush(directorTokens, {
        noticeId: row.notice.id,
        subject: row.notice.subject,
        recipientName: row.user.id, // director notification only — recipient name not surfaced in FCM payload
      });
      await commsRepository.markEscalation48Sent(row.id);
      escalated++;
    }
  }
  if (escalated > 0) {
    logger.info({ escalated }, 'Formal notice 48h escalations sent to directors');
  }
};

export const ensureFormalNoticeReminderSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    'formal-notice-reminders.schedule',
    {},
    {
      repeat: { pattern: '*/30 * * * *' },
      jobId: 'formal-notice-reminders.schedule',
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
