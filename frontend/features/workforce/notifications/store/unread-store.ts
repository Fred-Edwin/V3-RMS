import { create } from 'zustand';

interface UnreadState {
  /** Unread Workforce notifications for the signed-in person. Set by whoever just asked the server. */
  unread: number;
  setUnread: (unread: number) => void;
}

/**
 * One number shared by the Inbox tab dot and the shell's Inbox badge, so the two never disagree. The shell asks the server
 * (`useWorkforceUnread`); the Notifications tab updates it from the answers to "read" and "read all".
 */
export const useUnreadStore = create<UnreadState>((set) => ({
  unread: 0,
  setUnread: (unread) => set((s) => (s.unread === unread ? s : { unread })),
}));
