import { Prisma } from '@prisma/client';
import type { CountSettingsRecord } from './settings-repository';

/** A hub `counting_thresholds` row for tests: KES 300, 8.5 %, repeat off, Director alert KES 1,500, set by a Manager and a Director. */
export const countingThresholdsRow = (overrides: Partial<CountSettingsRecord> = {}): CountSettingsRecord => ({
  id: 'row-1',
  siteId: 'hub-1',
  reasonRequiredKes: 300,
  overnightAlertKes: null,
  directorAlertKes: 1500,
  rangePercent: new Prisma.Decimal('8.5'),
  flagRepeatShortfalls: false,
  updatedById: 'sm',
  directorUpdatedById: 'dir',
  directorUpdatedAt: new Date('2026-09-20T06:00:00Z'),
  createdAt: new Date('2026-09-01T06:00:00Z'),
  updatedAt: new Date('2026-10-01T06:00:00Z'),
  updatedBy: { id: 'sm', name: 'Isabel Njoki', role: 'STORE_MANAGER' },
  directorUpdatedBy: { id: 'dir', name: 'Grace Wambui', role: 'DIRECTOR' },
  ...overrides,
});
