import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const joinBranchSchema = z.object({
  organizationId: z.string().uuid(),
});

export const branchRoomName = (organizationId: string): string => `branch:${organizationId}`;

export const createSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Socket client connected');

    socket.on('join:branch', (payload: unknown) => {
      const parsedPayload = joinBranchSchema.safeParse(payload);
      if (!parsedPayload.success) {
        socket.emit('error:join:branch', { message: 'Invalid organizationId payload.' });
        return;
      }

      const room = branchRoomName(parsedPayload.data.organizationId);
      socket.join(room);
      socket.emit('joined:branch', { room });
      logger.info({ socketId: socket.id, room }, 'Socket client joined branch room');
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket client disconnected');
    });
  });

  return io;
};
