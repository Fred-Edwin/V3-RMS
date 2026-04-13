import { create } from 'zustand';
import type { NewDirectMessagePayload, NewBroadcastPayload, NewFormalNoticePayload } from '@/types/comms';

interface CommsState {
  unreadDmCount: number;
  unreadBroadcastCount: number;
  unreadNoticeCount: number;
  activeConversationId: string | null;
  lastReceivedDm: NewDirectMessagePayload | null;
  lastReceivedBroadcast: NewBroadcastPayload | null;
  lastReceivedNotice: NewFormalNoticePayload | null;
  typingUsers: Record<string, string>; // conversationId → typing user name

  setActiveConversationId: (id: string | null) => void;
  incrementUnreadDm: () => void;
  decrementUnreadDm: () => void;
  resetUnreadDm: () => void;
  incrementUnreadBroadcast: () => void;
  resetUnreadBroadcast: () => void;
  incrementUnreadNotice: () => void;
  resetUnreadNotice: () => void;
  setLastReceivedDm: (payload: NewDirectMessagePayload) => void;
  setLastReceivedBroadcast: (payload: NewBroadcastPayload) => void;
  setLastReceivedNotice: (payload: NewFormalNoticePayload) => void;
  setTypingUser: (conversationId: string, name: string) => void;
  clearTypingUser: (conversationId: string) => void;
  resetAll: () => void;
}

export const useCommsStore = create<CommsState>((set) => ({
  unreadDmCount: 0,
  unreadBroadcastCount: 0,
  unreadNoticeCount: 0,
  activeConversationId: null,
  lastReceivedDm: null,
  lastReceivedBroadcast: null,
  lastReceivedNotice: null,
  typingUsers: {},

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  incrementUnreadDm: () => set((s) => ({ unreadDmCount: s.unreadDmCount + 1 })),
  decrementUnreadDm: () => set((s) => ({ unreadDmCount: Math.max(0, s.unreadDmCount - 1) })),
  resetUnreadDm: () => set({ unreadDmCount: 0 }),

  incrementUnreadBroadcast: () => set((s) => ({ unreadBroadcastCount: s.unreadBroadcastCount + 1 })),
  resetUnreadBroadcast: () => set({ unreadBroadcastCount: 0 }),

  incrementUnreadNotice: () => set((s) => ({ unreadNoticeCount: s.unreadNoticeCount + 1 })),
  resetUnreadNotice: () => set({ unreadNoticeCount: 0 }),

  setLastReceivedDm: (payload) => set({ lastReceivedDm: payload }),
  setLastReceivedBroadcast: (payload) => set({ lastReceivedBroadcast: payload }),
  setLastReceivedNotice: (payload) => set({ lastReceivedNotice: payload }),

  setTypingUser: (conversationId, name) =>
    set((s) => ({ typingUsers: { ...s.typingUsers, [conversationId]: name } })),
  clearTypingUser: (conversationId) =>
    set((s) => {
      const next = { ...s.typingUsers };
      delete next[conversationId];
      return { typingUsers: next };
    }),

  resetAll: () =>
    set({
      unreadDmCount: 0,
      unreadBroadcastCount: 0,
      unreadNoticeCount: 0,
      activeConversationId: null,
      lastReceivedDm: null,
      lastReceivedBroadcast: null,
      lastReceivedNotice: null,
      typingUsers: {},
    }),
}));
