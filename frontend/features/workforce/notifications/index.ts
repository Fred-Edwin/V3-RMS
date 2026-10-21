/**
 * Workforce notifications (Segment 6a): the Inbox's Notifications tab and the unread number. The Inbox page and the shell import from here only.
 * The server renders the wording at send time; this only lists, opens and marks read. See README.md.
 */
export { NotificationsTab } from './components/notifications-tab';
export { useWorkforceUnread, useWorkforceUnreadCount } from './hooks/use-workforce-unread';
export type { WorkforceNotification } from './types/notification-types';
