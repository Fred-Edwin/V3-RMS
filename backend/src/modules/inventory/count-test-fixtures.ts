import { Prisma } from '@prisma/client';
import type { CountLineWithItem, CountWithRelations } from './count-repository';

export const hubOrgId = '11111111-1111-4111-8111-111111111111';
export const centralStoreId = '55555555-5555-4555-8555-555555555555';
export const countId = 'c0000000-0000-4000-8000-000000000001';

export const attendant = { id: 'sa1', role: 'STORE_ATTENDANT' as const, organizationId: hubOrgId };
export const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
export const centralStore = {
  id: centralStoreId,
  organizationId: hubOrgId,
  type: 'CENTRAL_STORE',
  departmentTag: null,
  name: 'Central Store',
};

const D = (v: string | number) => new Prisma.Decimal(v);

export const line = (n: number, overrides: Partial<CountLineWithItem> = {}): CountLineWithItem => ({
  id: `a000000${n}-0000-4000-8000-000000000000`,
  stockCountId: countId,
  inventoryItemId: `b000000${n}-0000-4000-8000-000000000000`,
  countedQty: null,
  firstCountedQty: null,
  expectedQty: null,
  unitCost: null,
  decision: 'PENDING',
  reason: null,
  reasonNote: null,
  reasonRequired: false,
  queryNote: null,
  createdAt: new Date('2026-09-12T04:00:00Z'),
  updatedAt: new Date('2026-09-12T04:00:00Z'),
  inventoryItem: {
    id: `b000000${n}-0000-4000-8000-000000000000`,
    name: `Item ${n}`,
    usageUnit: 'kg',
    categoryId: null,
    currentCost: D(100),
  },
  transactions: [],
  ...overrides,
});

export const count = (
  lines: CountLineWithItem[],
  overrides: Partial<CountWithRelations> = {},
): CountWithRelations => ({
  id: countId,
  organizationId: hubOrgId,
  locationId: centralStoreId,
  kind: 'DAILY',
  countDate: new Date('2026-09-12T00:00:00Z'),
  status: 'DRAFT',
  reference: 'CNT-2026-0912',
  counterId: 'sa1',
  counterSignedAt: null,
  verifierId: null,
  verifiedAt: null,
  returnNote: null,
  returnedAt: null,
  returnedById: null,
  directorNotified: false,
  createdAt: new Date('2026-09-12T04:00:00Z'),
  updatedAt: new Date('2026-09-12T04:08:00Z'),
  counter: { id: 'd0000000-0000-4000-8000-0000000000a1', name: 'Sarah Achieng' },
  verifier: null,
  returnedBy: null,
  lines,
  ...overrides,
});

export { D };
