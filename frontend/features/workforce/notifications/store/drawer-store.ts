import { create } from 'zustand';

interface NotificationsDrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Whether the desktop notifications drawer is open. The bell and "See all notifications" set it; the drawer in the Workforce layout reads it. */
export const useNotificationsDrawer = create<NotificationsDrawerState>((set) => ({ open: false, setOpen: (open) => set({ open }) }));
