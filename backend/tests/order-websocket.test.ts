import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { createSocketServer } from '../src/sockets/socket';
import { socketService } from '../src/sockets/socket-service';
import type { PrepTicketRecord } from '../src/types/order.types';
import { signAccessToken } from '../src/utils/jwt';

const organizationId = '22222222-2222-4222-8222-222222222222';

let httpServer: HttpServer;
let ioServer: SocketIOServer;
let baseUrl = '';

const waitForEvent = <TPayload>(socket: ClientSocket, eventName: string, timeoutMs = 3000): Promise<TPayload> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for socket event: ${eventName}`));
    }, timeoutMs);

    const onEvent = (payload: TPayload): void => {
      clearTimeout(timeout);
      resolve(payload);
    };

    socket.once(eventName, onEvent);
  });
};

const connectAuthenticatedSocket = async (
  payload: Parameters<typeof signAccessToken>[0],
): Promise<ClientSocket> => {
  const token = signAccessToken(payload);

  const socket = createClient(baseUrl, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: false,
    extraHeaders: {
      Origin: 'http://localhost:3000',
    },
  });

  await new Promise<void>((resolve, reject) => {
    const onConnect = (): void => {
      socket.off('connect_error', onError);
      resolve();
    };

    const onError = (error: Error): void => {
      socket.off('connect', onConnect);
      reject(error);
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });

  return socket;
};

describe('Order websocket events', () => {
  beforeAll(async () => {
    httpServer = createServer();
    ioServer = createSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });

    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      ioServer.close(() => resolve());
    });

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('emits order:new to the correct station room', async () => {
    const socket = await connectAuthenticatedSocket({
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'KITCHEN_DISPLAY',
      organizationId,
    });

    try {
      socket.emit('join:station', { organizationId, station: 'KITCHEN' });
      const joined = await waitForEvent<{ room: string; station: 'KITCHEN' | 'BARISTA' }>(
        socket,
        'joined:station',
      );
      expect(joined.station).toBe('KITCHEN');
      expect(joined.room).toBe(`branch:${organizationId}:kitchen`);

      const ticket: PrepTicketRecord = {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        orderId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        station: 'KITCHEN',
        status: 'PENDING',
        claimedById: null,
        claimedBy: null,
        claimedAt: null,
        readyAt: null,
        items: [{ name: 'Burger', quantity: 2, notes: null }],
        createdAt: new Date('2026-02-24T10:00:00.000Z'),
        updatedAt: new Date('2026-02-24T10:00:00.000Z'),
      };

      const newOrderEvent = waitForEvent<{ id: string; station: 'KITCHEN' | 'BARISTA' }>(socket, 'order:new');
      socketService.emitNewOrder(organizationId, [ticket]);

      const payload = await newOrderEvent;
      expect(payload.id).toBe(ticket.id);
      expect(payload.station).toBe('KITCHEN');
    } finally {
      socket.disconnect();
    }
  });

  it('emits order:claimed and order:all_ready to waiter user room', async () => {
    const waiterId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const socket = await connectAuthenticatedSocket({
      userId: waiterId,
      role: 'WAITER',
      organizationId,
    });

    try {
      socket.emit('join:user', { userId: waiterId });
      const joined = await waitForEvent<{ room: string }>(socket, 'joined:user');
      expect(joined.room).toBe(`user:${waiterId}`);

      const claimedEvent = waitForEvent<{
        orderId: string;
        ticketId: string;
        station: 'KITCHEN' | 'BARISTA';
        claimedBy: { id: string; name: string };
      }>(socket, 'order:claimed');

      socketService.emitOrderClaimed(waiterId, {
        orderId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        ticketId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        station: 'KITCHEN',
        claimedBy: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Chef One',
        },
      });

      const claimedPayload = await claimedEvent;
      expect(claimedPayload.orderId).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
      expect(claimedPayload.station).toBe('KITCHEN');

      const allReadyEvent = waitForEvent<{ orderId: string; dailyNumber: number }>(
        socket,
        'order:all_ready',
      );
      socketService.emitOrderAllReady(waiterId, {
        orderId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        dailyNumber: 12,
      });

      const allReadyPayload = await allReadyEvent;
      expect(allReadyPayload.orderId).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
      expect(allReadyPayload.dailyNumber).toBe(12);
    } finally {
      socket.disconnect();
    }
  });
});
