import { useWdsToastStore } from '@/store/wdsToastStore';

/** The one quiet toast Leave shows after an action (the single active toast of the design system). */
export function leaveToast(title: string, variant: 'success' | 'error' | 'info' = 'success'): void {
  useWdsToastStore.getState().addToast({ variant, title });
}
