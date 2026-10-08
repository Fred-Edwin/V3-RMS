import { randomUUID } from 'node:crypto';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import type { InventoryBadgesPayload } from './socket-service';

/**
 * The `inventory:badges` nudge can start in the worker (the urgent-escalation job runs there), but the browsers are connected to
 * the API process, and each process has its own socket server. So every nudge is also published on a Redis channel, and every
 * process that has a socket server re-emits what it hears from the OTHER processes to its own clients. A process ignores its own
 * messages (it already emitted locally), so nothing is sent twice. A failure to publish is logged, never thrown: a missed nudge is
 * healed by the screens refetching when the tab regains focus.
 */
export const INVENTORY_BADGES_CHANNEL = 'inventory:badges';

interface Message {
  origin: string;
  payload: InventoryBadgesPayload;
}

export interface BadgesBridgeDeps {
  origin: string;
  publish: (channel: string, message: string) => Promise<unknown>;
  subscribe: (channel: string, onMessage: (message: string) => void) => Promise<void>;
}

export const createInventoryBadgesBridge = (deps: BadgesBridgeDeps) => ({
  publish: async (payload: InventoryBadgesPayload): Promise<void> => {
    try {
      const message: Message = { origin: deps.origin, payload };
      await deps.publish(INVENTORY_BADGES_CHANNEL, JSON.stringify(message));
    } catch (error) {
      logger.warn({ error }, 'Could not publish the inventory badges nudge');
    }
  },
  start: async (emitLocal: (payload: InventoryBadgesPayload) => void): Promise<void> => {
    await deps.subscribe(INVENTORY_BADGES_CHANNEL, (raw) => {
      try {
        const message = JSON.parse(raw) as Message;
        if (message.origin !== deps.origin) emitLocal(message.payload);
      } catch (error) {
        logger.warn({ error }, 'Ignored an unreadable inventory badges message');
      }
    });
  },
});

export const inventoryBadgesBridge = createInventoryBadgesBridge({
  origin: randomUUID(),
  publish: (channel, message) => redisClient.publish(channel, message),
  subscribe: async (channel, onMessage) => {
    // A connection that subscribes can do nothing else, so it is its own.
    const subscriber = redisClient.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (_channel: string, message: string) => onMessage(message));
  },
});
