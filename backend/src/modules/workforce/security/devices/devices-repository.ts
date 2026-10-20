import { createHash } from 'node:crypto';
import { Prisma, type WorkforceDevice } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Tx = Prisma.TransactionClient;

/** Only the SHA-256 of the browser's random device id is kept; the id itself is never stored or logged. */
export const hashDeviceId = (deviceId: string): string => createHash('sha256').update(deviceId).digest('hex');

export interface SeenResult {
  device: WorkforceDevice;
  /** First time this phone is seen, or seen again after the person removed it: the entry and the phone question follow. */
  created: boolean;
}

export const devicesRepository = {
  /** Race-safe: two first calls at once create one phone. A removed phone that comes back is asked about again. */
  async seen(tx: Tx, userId: string, deviceId: string, label: string, placeLabel: string | null, now: Date): Promise<SeenResult> {
    const deviceIdHash = hashDeviceId(deviceId);
    try {
      const device = await tx.workforceDevice.create({ data: { userId, deviceIdHash, label, placeLabel, firstSeenAt: now, lastSeenAt: now } });
      return { device, created: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    }
    const existing = await tx.workforceDevice.findUniqueOrThrow({ where: { userId_deviceIdHash: { userId, deviceIdHash } } });
    if (existing.removedAt !== null) {
      const device = await tx.workforceDevice.update({ where: { id: existing.id }, data: { removedAt: null, confirmedAt: null, confirmedMode: null, label, placeLabel, firstSeenAt: now, lastSeenAt: now } });
      return { device, created: true };
    }
    // Keep the last-seen time fresh without a write on every call.
    const stale = now.getTime() - existing.lastSeenAt.getTime() > 5 * 60_000;
    const device = stale ? await tx.workforceDevice.update({ where: { id: existing.id }, data: { lastSeenAt: now, placeLabel: placeLabel ?? existing.placeLabel } }) : existing;
    return { device, created: false };
  },

  findByHash: (userId: string, deviceId: string) => prisma.workforceDevice.findUnique({ where: { userId_deviceIdHash: { userId, deviceIdHash: hashDeviceId(deviceId) } } }),
  /** Own phones only: the id must belong to the user. */
  findOwn: (userId: string, id: string) => prisma.workforceDevice.findFirst({ where: { id, userId, removedAt: null } }),
  listActive: (userId: string) => prisma.workforceDevice.findMany({ where: { userId, removedAt: null }, orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }] }),
  countActive: (userId: string) => prisma.workforceDevice.count({ where: { userId, removedAt: null } }),

  confirm: (tx: Tx, id: string, mode: 'REMEMBER' | 'ONCE', now: Date) => tx.workforceDevice.update({ where: { id }, data: { confirmedAt: now, confirmedMode: mode } }),
  /** Idempotent: removing a removed phone changes nothing. */
  remove: (tx: Tx, userId: string, id: string, now: Date) => tx.workforceDevice.updateMany({ where: { id, userId, removedAt: null }, data: { removedAt: now } }),
  removeAll: (tx: Tx, userId: string, now: Date) => tx.workforceDevice.updateMany({ where: { userId, removedAt: null }, data: { removedAt: now } }),
};
