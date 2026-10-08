/**
 * The settings repository against the REAL database: the Director's write leaves the range's "updated at" alone, the range write
 * leaves the alert amount alone, and the preview's read runs. Opt-in (`RUN_DB_TESTS=1`). It edits the hub's one thresholds row and
 * puts it back in `finally`.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { settingsRepository } from './settings-repository';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('settings repository against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('range and alert writes do not disturb each other, and the range keeps its own stamp', async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true }, select: { id: true } });
    const manager = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER' }, select: { id: true } });
    const director = await prisma.user.findFirstOrThrow({ where: { role: 'DIRECTOR' }, select: { id: true } });
    const original = await prisma.countingThresholds.findUnique({ where: { siteId: hub.id } });

    try {
      const saved = await settingsRepository.saveRange(hub.id, { rangeKes: 410, rangePercent: new Prisma.Decimal('6.25'), flagRepeatShortfalls: false, updatedById: manager.id });
      expect(saved).toMatchObject({ reasonRequiredKes: 410, flagRepeatShortfalls: false, updatedBy: { id: manager.id } });
      expect(saved.rangePercent.toString()).toBe('6.25');

      const later = new Date(saved.updatedAt.getTime() + 60_000);
      const alerted = await settingsRepository.saveDirectorAlert(hub.id, { alertKes: 7777, updatedById: director.id, at: later, keepRangeStamp: saved.updatedAt });
      expect(alerted.directorAlertKes).toBe(7777);
      expect(alerted.directorUpdatedBy?.id).toBe(director.id);
      expect(alerted.directorUpdatedAt?.toISOString()).toBe(later.toISOString());
      // The range is untouched, and so is its stamp.
      expect(alerted).toMatchObject({ reasonRequiredKes: 410, flagRepeatShortfalls: false });
      expect(alerted.updatedAt.toISOString()).toBe(saved.updatedAt.toISOString());

      expect(await settingsRepository.signedLinesSince(hub.id, new Date('2000-01-01T00:00:00Z'))).toBeInstanceOf(Array);
    } finally {
      if (original) {
        const { id: _id, siteId: _siteId, createdAt: _created, ...data } = original;
        await prisma.countingThresholds.update({ where: { siteId: hub.id }, data });
      } else {
        await prisma.countingThresholds.deleteMany({ where: { siteId: hub.id } });
      }
    }
  });
});
