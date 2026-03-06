import { create } from 'zustand';

interface IncidentStore {
  unreadCount: number;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export const useIncidentStore = create<IncidentStore>((set) => ({
  unreadCount: 0,
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}));
