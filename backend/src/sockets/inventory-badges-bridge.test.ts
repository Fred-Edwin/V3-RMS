import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/redis', () => ({ redisClient: {} }));

import { createInventoryBadgesBridge, INVENTORY_BADGES_CHANNEL, type BadgesBridgeDeps } from './inventory-badges-bridge';
import type { InventoryBadgesPayload } from './socket-service';

/** A tiny in-memory stand-in for Redis pub/sub, shared by the "processes" of one test. */
const bus = () => {
  const listeners: Array<(message: string) => void> = [];
  const depsFor = (origin: string): BadgesBridgeDeps => ({
    origin,
    publish: async (channel, message) => {
      if (channel === INVENTORY_BADGES_CHANNEL) listeners.forEach((l) => l(message));
    },
    subscribe: async (channel, onMessage) => {
      if (channel === INVENTORY_BADGES_CHANNEL) listeners.push(onMessage);
    },
  });
  return { depsFor, listeners };
};

const payload: InventoryBadgesPayload = { siteId: 'site-1', reason: 'requisition.urgent_escalated' };

describe('the inventory badges bridge', () => {
  it('delivers a nudge published by the worker to the API process, and not back to the worker', async () => {
    const { depsFor } = bus();
    const worker = createInventoryBadgesBridge(depsFor('worker'));
    const api = createInventoryBadgesBridge(depsFor('api'));
    const emitApi = vi.fn();
    const emitWorker = vi.fn();
    await api.start(emitApi);
    await worker.start(emitWorker);

    await worker.publish(payload);

    expect(emitApi).toHaveBeenCalledTimes(1);
    expect(emitApi).toHaveBeenCalledWith(payload);
    expect(emitWorker).not.toHaveBeenCalled();
  });

  it('ignores an unreadable message instead of throwing', async () => {
    const { depsFor, listeners } = bus();
    const api = createInventoryBadgesBridge(depsFor('api'));
    const emit = vi.fn();
    await api.start(emit);

    expect(() => listeners.forEach((l) => l('not json'))).not.toThrow();
    expect(emit).not.toHaveBeenCalled();
  });

  it('never throws when Redis refuses the publish: a missed nudge is healed by the screens refetching on focus', async () => {
    const failing = createInventoryBadgesBridge({ origin: 'worker', publish: async () => Promise.reject(new Error('redis down')), subscribe: async () => undefined });
    await expect(failing.publish(payload)).resolves.toBeUndefined();
  });
});
