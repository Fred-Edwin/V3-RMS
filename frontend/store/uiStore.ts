import { create } from 'zustand';

interface UiState {
  hideBottomNav: boolean;
  setHideBottomNav: (hidden: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  hideBottomNav: false,
  setHideBottomNav: (hidden) => set({ hideBottomNav: hidden }),
}));
