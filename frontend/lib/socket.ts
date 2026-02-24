import { io, type Socket } from 'socket.io-client';
import { env } from './env';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import type { PrepStation } from '@/types/order';

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const connectSocket = (token?: string): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (!socketInstance) {
    socketInstance = io(env.socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  } else if (token) {
    socketInstance.auth = { token };
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

export const joinStationRoom = (organizationId: string, station: PrepStation): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.emit('join:station', { organizationId, station });
};

export const joinUserRoom = (userId: string): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.emit('join:user', { userId });
};

export const onReconnect = (callback: () => void): (() => void) => {
  if (!socketInstance) {
    return () => {};
  }

  socketInstance.io.on('reconnect', callback);
  return () => {
    socketInstance?.io.off('reconnect', callback);
  };
};

export const disconnectSocket = (): void => {
  if (!socketInstance) {
    return;
  }

  socketInstance.removeAllListeners();
  socketInstance.io.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
};

export const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> | null => socketInstance;
