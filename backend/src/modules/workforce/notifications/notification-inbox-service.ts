import { notificationRepository } from './notification-repository';
import type { StoredNotification } from './notification-types';

export interface InboxPage {
  items: StoredNotification[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

/** The Notifications tab of the Inbox: the signed-in person's own rows, newest first. Nothing here takes another person's id. */
export const notificationInboxService = {
  async list(userId: string, query: { unread: boolean; page: number; pageSize: number }): Promise<InboxPage> {
    const [{ items, total }, unread] = await Promise.all([notificationRepository.list(userId, query.unread, query.page, query.pageSize), notificationRepository.unreadCount(userId)]);
    return { items, total, unread, page: query.page, pageSize: query.pageSize };
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
