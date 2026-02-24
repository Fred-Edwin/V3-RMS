import { useAuthStore } from '@/store/authStore';
import { disconnectSocket } from './socket';

export const performLogout = async (): Promise<void> => {
  await useAuthStore.getState().logout();
  disconnectSocket();
};
