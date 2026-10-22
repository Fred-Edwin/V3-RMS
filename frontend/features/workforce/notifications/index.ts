/**
 * Workforce notifications (Segment 6a): the Inbox's Notifications tab and the unread number. The Inbox page and the shell import from here only.
 * The server renders the wording at send time; this only lists, opens and marks read. See README.md.
 */
export { NotificationsTab } from './components/notifications-tab';
export { NotificationsScreen } from './components/notifications-screen';
export { NotificationsDrawer } from './components/notifications-drawer';
export { useOpenNotifications } from './hooks/use-open-notifications';
export { useWorkforceUnread, useWorkforceUnreadCount } from './hooks/use-workforce-unread';
export { notificationWrites } from './services/notification-services'; // Home's "Mark all read"
export { useUnreadStore } from './store/unread-store';
export { safeHref, whenWords } from './lib/notification-words';
export type { WorkforceNotification } from './types/notification-types';
