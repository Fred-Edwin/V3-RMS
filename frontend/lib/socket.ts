import { io, type Socket } from 'socket.io-client';
import { env } from './env';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const connectSocket = (token?: string): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socketInstance) {
    socketInstance = io(env.socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
      auth: token ? { token } : undefined,
    });
  }

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const joinBranchRoom = (organizationId: string): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.emit('join:branch', { organizationId });
};

export const disconnectSocket = (): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.disconnect();
};

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> | null => socketInstance;
