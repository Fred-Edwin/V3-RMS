import { Prisma, type CountStatus, type UserRole } from '@prisma/client';
import type { CountLineRecord, CountRecord } from './count-record-repository';

/** Test helpers for Counting: records shaped like `countRecordRepository.findById` returns them. Not imported by production code. */
export const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

export const hubId = '11111111-1111-4111-8111-111111111111';
export const storeId = '55555555-5555-4555-8555-555555555555';
export const countId = 'c0000000-0000-4000-8000-000000000001';
export const sectionId1 = '5e000000-0000-4000-8000-000000000001';

export const attendant = { id: 'u-linnet', role: 'STORE_ATTENDANT' as const, siteId: hubId, name: 'Linnet Wanjiru' };
export const otherAttendant = { id: 'u-peter', role: 'STORE_ATTENDANT' as const, siteId: hubId, name: 'Peter Kariuki' };
export const storeManager = { id: 'u-isabel', role: 'STORE_MANAGER' as const, siteId: hubId, name: 'Isabel Njoki' };
export const director = { id: 'u-grace', role: 'DIRECTOR' as const, siteId: hubId, name: 'Grace Wambui' };
export const accountant = { id: 'u-acc', role: 'ACCOUNTANT' as const, siteId: hubId, name: 'Amos Otieno' };
export const branchManager = { id: 'u-bm', role: 'MANAGER' as const, siteId: 'branch-1', name: 'Beth Mwangi' };
export const systemAdmin = { id: 'u-admin', role: 'SYSTEM_ADMIN' as const, siteId: null, name: 'Sam Admin' };

export const person = (u: { id: string; name: string; role: UserRole }) => ({ id: u.id, name: u.name, role: u.role });

const lineId = (n: number): string => `a000000${n}-0000-4000-8000-000000000000`;
const itemId = (n: number): string => `b000000${n}-0000-4000-8000-000000000000`;
export const lineIdOf = lineId;
export const itemIdOf = itemId;

type LineOverrides = Partial<Omit<CountLineRecord, 'inventoryItem'>> & { name?: string; unit?: string; currentCost?: Prisma.Decimal | number | string };

/** One line of a count. Defaults to an untouched OPEN line of "Item n" at KES 100 a unit. */
export const line = (n: number, overrides: LineOverrides = {}): CountLineRecord => {
  const { name, unit, currentCost, ...rest } = overrides;
  const at = new Date('2026-10-13T04:00:00Z');
  return {
    id: lineId(n),
    siteId: hubId,
    countId,
    inventoryItemId: itemId(n),
    sectionId: sectionId1,
    sectionName: 'Samrat',
    position: n,
    countedQty: null,
    skipped: false,
    recheck: 'NONE',
    firstCountedQty: null,
    recheckOffered: false,
    isOpen: true,
    expectedQty: null,
    unitCost: null,
    result: null,
    shortStreak: 0,
    decision: 'PENDING',
    cause: null,
    causeNote: null,
    movementKind: null,
    decidedById: null,
    decidedAt: null,
    directorFlagged: false,
    directorAlert: false,
    directorSeenAt: null,
    directorSeenById: null,
    createdAt: at,
    updatedAt: at,
    inventoryItem: { id: itemId(n), name: name ?? `Item ${n}`, usageUnit: unit ?? 'kg', currentCost: D(currentCost ?? 100) },
    decidedBy: null,
    directorSeenBy: null,
    transactions: [],
    ...rest,
  };
};

/** A line as the counter's sign froze it. */
export const signedLine = (
  n: number,
  counted: number | null,
  expected: number,
  result: NonNullable<CountLineRecord['result']>,
  overrides: LineOverrides = {},
): CountLineRecord =>
  line(n, {
    countedQty: counted === null ? null : D(counted),
    skipped: counted === null,
    expectedQty: D(expected),
    unitCost: D(overrides.currentCost ?? 100),
    result,
    isOpen: false,
    ...overrides,
  });

export const count = (lines: CountLineRecord[], overrides: Partial<CountRecord> = {}): CountRecord => {
  const start = new Date('2026-10-13T04:05:00Z');
  return {
    id: countId,
    siteId: hubId,
    locationId: storeId,
    reference: 'CNT-2026-0007',
    status: 'OPEN' as CountStatus,
    counterId: attendant.id,
    startedAt: start,
    signedAt: null,
    approvedAt: null,
    approverId: null,
    selfSigned: false,
    recountOfLineId: null,
    expectedAsOf: null,
    rangeKes: null,
    rangePercent: null,
    directorAlertKes: null,
    flagRepeat: null,
    idempotencyKey: null,
    createdAt: start,
    updatedAt: new Date('2026-10-13T04:19:00Z'),
    counter: person(attendant),
    approver: null,
    scopeSections: [{ id: 'd0000000-0000-4000-8000-000000000001', countId, sectionId: sectionId1, sectionName: 'Samrat' }],
    recountOfLine: null,
    lines,
    ...overrides,
  };
};

/** The settings frozen on a signed count: KES 500, 5 %, repeat on, Director alert KES 5,000. */
export const frozen = { rangeKes: 500, rangePercent: D(5), directorAlertKes: 5000, flagRepeat: true } as const;
