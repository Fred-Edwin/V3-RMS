import type { Server as HttpServer } from 'http';
import type { PrepStation, UserRole } from '@prisma/client';
import { Server } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';

const joinBranchSchema = z.object({
  organizationId: z.string().uuid(),
});

const joinStationSchema = z.object({
  organizationId: z.string().uuid(),
  station: z.enum(['KITCHEN', 'BARISTA', 'PIZZA', 'PASTRY']),
});

const joinUserSchema = z.object({
  userId: z.string().uuid(),
});

export const branchRoomName = (organizationId: string): string => `branch:${organizationId}`;
export const stationRoomName = (organizationId: string, station: PrepStation): string =>
  `branch:${organizationId}:${station.toLowerCase()}`;
export const userRoomName = (userId: string): string => `user:${userId}`;

interface SocketAuthContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
}

interface SocketData {
  auth: SocketAuthContext;
}

let socketServer: Server | null = null;

const kitchenRoles: UserRole[] = ['CHEF', 'KITCHEN_DISPLAY'];
const baristaRoles: UserRole[] = ['BARISTA', 'BARISTA_DISPLAY'];

const isRoleAllowedForStation = (role: UserRole, station: PrepStation): boolean => {
  if (station === 'KITCHEN' || station === 'PIZZA' || station === 'PASTRY') {
    return kitchenRoles.includes(role);
  }

  return baristaRoles.includes(role);
};

export const createSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.['token'];
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('Missing access token'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      (socket.data as SocketData).auth = {
        userId: payload.userId,
        role: payload.role,
        organizationId: payload.organizationId,
      };
      next();
    } catch {
      next(new Error('Invalid access token'));
    }
  });

  io.on('connection', (socket) => {
    const auth = (socket.data as SocketData).auth;
    logger.info({ socketId: socket.id, userId: auth.userId, role: auth.role }, 'Socket client connected');

    // System-level roles (DIRECTOR, HR_MANAGER) have no organizationId and cannot join a branch room.
    // Auto-join them into their personal user room so DMs, broadcasts, and notices are delivered.
    if (auth.role === 'DIRECTOR' || auth.role === 'HR_MANAGER') {
      const room = userRoomName(auth.userId);
      socket.join(room);
      logger.info({ socketId: socket.id, room, role: auth.role }, 'Auto-joined system-level user to user room');
    }

    socket.on('join:branch', (payload: unknown) => {
      const parsedPayload = joinBranchSchema.safeParse(payload);
      if (!parsedPayload.success) {
        socket.emit('error:join:branch', { message: 'Invalid organizationId payload.' });
        return;
      }

      if (!auth.organizationId || auth.organizationId !== parsedPayload.data.organizationId) {
        socket.emit('error:join:branch', { message: 'Unauthorized branch room join.' });
        return;
      }

      const room = branchRoomName(parsedPayload.data.organizationId);
      socket.join(room);
      socket.emit('joined:branch', { room });
      logger.info({ socketId: socket.id, room }, 'Socket client joined branch room');
    });

    socket.on('join:station', (payload: unknown) => {
      const parsedPayload = joinStationSchema.safeParse(payload);
      if (!parsedPayload.success) {
        socket.emit('error:join:station', { message: 'Invalid station room payload.' });
        return;
      }

      if (!auth.organizationId || auth.organizationId !== parsedPayload.data.organizationId) {
        socket.emit('error:join:station', { message: 'Unauthorized station room join.' });
        return;
      }

      if (!isRoleAllowedForStation(auth.role, parsedPayload.data.station)) {
        socket.emit('error:join:station', { message: 'Role is not allowed to join this station room.' });
        return;
      }

      const room = stationRoomName(parsedPayload.data.organizationId, parsedPayload.data.station);
      socket.join(room);
      socket.emit('joined:station', { room, station: parsedPayload.data.station });
      logger.info({ socketId: socket.id, room, station: parsedPayload.data.station }, 'Socket client joined station room');
    });

    socket.on('join:user', (payload: unknown) => {
      const parsedPayload = joinUserSchema.safeParse(payload);
      if (!parsedPayload.success) {
        socket.emit('error:join:user', { message: 'Invalid user room payload.' });
        return;
      }

      if (parsedPayload.data.userId !== auth.userId) {
        socket.emit('error:join:user', { message: 'Unauthorized user room join.' });
        return;
      }

      const room = userRoomName(parsedPayload.data.userId);
      socket.join(room);
      socket.emit('joined:user', { room });
      logger.info({ socketId: socket.id, room }, 'Socket client joined user room');
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket client disconnected');
    });
  });

  socketServer = io;
  return io;
};

export const getSocketServer = (): Server => {
  if (!socketServer) {
    throw new Error('Socket server has not been initialized');
  }

  return socketServer;
};
