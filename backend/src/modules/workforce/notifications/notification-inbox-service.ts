import { notificationRepository } from './notification-repository';
import type { NotificationArea, StoredNotification } from './notification-types';

export interface InboxPage {
  items: StoredNotification[];
  /** Rows that match the filters (what the pager counts). */
  total: number;
  /** Every row the person has, before any filter: the number on the "All" chip. */
  all: number;
  /** Rows per area, before any filter: the numbers on the area chips. */
  areas: Array<{ area: NotificationArea; count: number }>;
  unread: number;
  page: number;
  pageSize: number;
}

/** The Notifications drawer and page: the signed-in person's own rows, newest first. Nothing here takes another person's id. */
export const notificationInboxService = {
  async list(userId: string, query: { unread: boolean; area?: NotificationArea; q?: string; page: number; pageSize: number }): Promise<InboxPage> {
    const [{ items, total }, unread, areas] = await Promise.all([
      notificationRepository.list(userId, { unreadOnly: query.unread, area: query.area, q: query.q || undefined }, query.page, query.pageSize),
      notificationRepository.unreadCount(userId),
      notificationRepository.areaCounts(userId),
    ]);
    return { items, total, all: areas.reduce((sum, a) => sum + a.count, 0), areas, unread, page: query.page, pageSize: query.pageSize };
  },

  unreadCount: async (userId: string): Promise<{ unread: number }> => ({ unread: await notificationRepository.unreadCount(userId) }),

  /** Ids that are not the caller's are simply not counted (no 404 that would say whether the id exists). */
  async markRead(userId: string, ids: string[], now: Date = new Date()): Promise<{ marked: number; unread: number }> {
    const marked = await notificationRepository.markRead(userId, ids, now);
    return { marked, unread: await notificationRepository.unreadCount(userId) };
  },

  async markAllRead(userId: string, now: Date = new Date()): Promise<{ marked: number; unread: number }> {
    return { marked: await notificationRepository.markAllRead(userId, now), unread: 0 };
  },
};
