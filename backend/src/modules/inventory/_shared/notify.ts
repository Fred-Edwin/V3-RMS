import type { UserRole } from '@prisma/client';
import { notificationQueue } from '../../../config/queues';
import { authRepository } from '../../../repositories/auth-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { socketService } from '../../../sockets/socket-service';
import { logger } from '../../../utils/logger';
import { send, type PushMessage } from '../counting/_shared/count-notify';
import { inQuietHours, nextQuietHoursEnd } from '../counting/_shared/count-time';

/**
 * THE notification layer of Inventory (docs/features/inventory/requisitions-contract.md §7). Every block sends through here; nothing
 * else in Inventory talks to FCM or the badge socket event directly.
 *
 * What one call does, in this order:
 *   1. Badge nudge: the socket event `inventory:badges` ({ siteId, reason }) goes to the room of every site named in `badgeSites`,
 *      at once, even when the push is held. It carries no counts: the open screen refetches its badge endpoint (R2).
 *   2. Push: the audiences are turned into FCM tokens (one push per device, however many audiences name the same person) and sent
 *      through the existing push service (`count-notify.send`, Firebase).
 *   3. Quiet hours: with `holdInQuietHours`, a push that would go out between 22:00 and 05:00 Africa/Nairobi is queued (a delayed
 *      job in the notifications queue, `INVENTORY_NOTICE_JOB`) and goes out at 05:00. Today only the Director's count alert is held.
 *
 * There is NO Inbox row (Amendment 1: the product Inbox is chat only). The notice is a push, a badge and a line on the page the
 * screen draws from its own data. Fire and forget: a failure is logged and never fails the write that caused it. Wording uses titles
 * (Branch Manager, the Kitchen head), not names, except where a record states who did something.
 *
 * Audiences name a site and a role or department; the token lookup is scoped by that site, so a notice never reaches another branch.
 */
export const INVENTORY_NOTICE_JOB = 'inventory.notice.dispatch';

export type Audience =
  /** The active users with these roles at one site (the Branch Manager of a branch, the Store Manager of the hub). */
  | { kind: 'roles'; siteId: string; roles: UserRole[] }
  /** Every active Director (a company-level role, so no site). */
  | { kind: 'directors' }
  /** The head, and unless `headsOnly` the members, of these departments of one branch. */
  | { kind: 'department'; siteId: string; departmentIds: string[]; headsOnly: boolean };

export interface Notification {
  audiences: Audience[];
  message: PushMessage;
  /** Hold the push until 05:00 Nairobi when it would go out between 22:00 and 05:00. Default false. */
  holdInQuietHours?: boolean;
  /** Sites whose room gets the `inventory:badges` nudge. The hub id is NOT added for you: name it when the store should refresh. */
  badgeSites: string[];
  /** Why the badges changed, for logs and tests ("requisition.sent"). */
  reason: string;
}

/** What the delayed job carries (plain JSON: the queue stores it). */
export interface HeldNotice {
  audiences: Audience[];
  message: PushMessage;
  reason: string;
}

export interface NotifyDeps {
  tokensFor: (audience: Audience) => Promise<string[]>;
  push: (tokens: string[], message: PushMessage) => Promise<number>;
  nudge: (siteId: string, reason: string) => void;
  hold: (notice: HeldNotice, runAt: Date, now: Date) => Promise<void>;
  log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void };
}

export const createNotifier = (deps: NotifyDeps) => {
  const deliver = async (notice: HeldNotice): Promise<number> => {
    const lists = await Promise.all(notice.audiences.map((a) => deps.tokensFor(a)));
    const tokens = [...new Set(lists.flat())];
    if (tokens.length === 0) return 0;
    return deps.push(tokens, notice.message);
  };

  return {
    /** Sends one notification. Never throws. */
    send: async (n: Notification, now: Date = new Date()): Promise<void> => {
      for (const siteId of new Set(n.badgeSites)) {
        try {
          deps.nudge(siteId, n.reason);
        } catch (error) {
          deps.log.warn({ error, siteId, reason: n.reason }, 'Inventory badge nudge failed');
        }
      }
      if (n.audiences.length === 0) return;
      const notice: HeldNotice = { audiences: n.audiences, message: n.message, reason: n.reason };
      try {
        if (n.holdInQuietHours && inQuietHours(now)) {
          const runAt = nextQuietHoursEnd(now);
          await deps.hold(notice, runAt, now);
          deps.log.info({ reason: n.reason, runAt: runAt.toISOString() }, 'Inventory push held for quiet hours');
          return;
        }
        const recipients = await deliver(notice);
        deps.log.info({ reason: n.reason, recipients }, 'Inventory push sent');
      } catch (error) {
        deps.log.warn({ error, reason: n.reason }, 'Inventory push failed');
      }
    },

    /** The delayed job fires: the held push goes out now. */
    dispatchHeld: async (notice: HeldNotice): Promise<void> => {
      try {
        const recipients = await deliver(notice);
        deps.log.info({ reason: notice.reason, recipients }, 'Held inventory push sent');
      } catch (error) {
        deps.log.warn({ error, reason: notice.reason }, 'Held inventory push failed');
      }
    },
  };
};

// --- The real wiring (Firebase, BullMQ, Socket.io) ---------------------------------------------------------------------

const defaultDeps: NotifyDeps = {
  tokensFor: async (audience) => {
    if (audience.kind === 'directors') return authRepository.findDirectorFcmTokens();
    if (audience.kind === 'roles') return authRepository.findFcmTokensByRole(audience.siteId, audience.roles);
    return authRepository.findDepartmentFcmTokens(audience.siteId, audience.departmentIds, audience.headsOnly);
  },
  push: send,
  nudge: (siteId, reason) => socketService.emitInventoryBadges(siteId, { siteId, reason }),
  hold: async (notice, runAt, now) => {
    await notificationQueue.add(INVENTORY_NOTICE_JOB, notice, { delay: Math.max(0, runAt.getTime() - now.getTime()), removeOnComplete: true });
  },
  log: logger,
};

export const inventoryNotify = createNotifier(defaultDeps);

/** The hub Site id, for notices the Central Store should see as a badge. Null when no hub is configured. */
export const findHubSiteId = async (): Promise<string | null> => (await branchRepository.findHub())?.id ?? null;
