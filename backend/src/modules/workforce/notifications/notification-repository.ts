import { Prisma, type WorkforceNotification } from '@prisma/client';
import { prisma } from '../../../config/database';
import { authRepository } from '../../../repositories/auth-repository';
import type { NotificationArea, NotificationTone, RenderedNotification } from './notification-types';

export interface StoreResult {
  id: string;
  created: boolean;
  replaced: boolean;
}

const asRow = (r: WorkforceNotification) => ({
  id: r.id,
  kind: r.kind,
  tone: r.tone as NotificationTone,
  area: r.area as NotificationArea,
  title: r.title,
  body: r.body,
  href: r.href,
  createdAt: r.updatedAt.toISOString(),
  read: r.readAt !== null,
});

/** Notifications of one person. Every query is scoped by the user id: nobody reads another person's rows. */
export const notificationRepository = {
  /**
   * Stores one row. A second call with the same dedupe key for the same person is a duplicate: it changes nothing, or, with
   * `replace`, rewrites the words of the existing row and marks it unread (a running count).
   */
  async store(userId: string, kind: string, rendered: RenderedNotification, dedupeKey: string | null, replace: boolean): Promise<StoreResult> {
    const data = { userId, kind, tone: rendered.tone, area: rendered.area, title: rendered.title, body: rendered.body, href: rendered.href, dedupeKey };
    try {
      const created = await prisma.workforceNotification.create({ data, select: { id: true } });
      return { id: created.id, created: true, replaced: false };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || dedupeKey === null) throw error;
      const existing = await prisma.workforceNotification.findUnique({ where: { userId_dedupeKey: { userId, dedupeKey } }, select: { id: true } });
      if (!existing) throw error;
      if (replace) await prisma.workforceNotification.update({ where: { id: existing.id }, data: { title: rendered.title, body: rendered.body, href: rendered.href, readAt: null } });
      return { id: existing.id, created: false, replaced: replace };
    }
  },

  async list(userId: string, unreadOnly: boolean, page: number, pageSize: number) {
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [rows, total] = await Promise.all([
      prisma.workforceNotification.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.workforceNotification.count({ where }),
    ]);
    return { items: rows.map(asRow), total };
  },

  unreadCount: (userId: string): Promise<number> => prisma.workforceNotification.count({ where: { userId, readAt: null } }),

  async markRead(userId: string, ids: readonly string[], now: Date): Promise<number> {
    const result = await prisma.workforceNotification.updateMany({ where: { userId, id: { in: [...ids] }, readAt: null }, data: { readAt: now } });
    return result.count;
  },

  async markAllRead(userId: string, now: Date): Promise<number> {
    const result = await prisma.workforceNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
    return result.count;
  },

  fcmTokensOf: (userId: string): Promise<string[]> => authRepository.findFcmTokensByUserIds([userId]),
};
