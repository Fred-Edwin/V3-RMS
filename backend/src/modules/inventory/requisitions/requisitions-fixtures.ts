import { Prisma } from '@prisma/client';
import type { LineRecord, RequisitionRecord, SectionRecord, AdditionRecord } from './requisitions-repository';

/** Typed in-memory records for the requisition tests (no database). Shared by the service, view and print tests. */
export const D = (n: number | string): Prisma.Decimal => new Prisma.Decimal(n);

export const SITE = 'site-nyr';
export const OTHER_SITE = 'site-krt';
export const KITCHEN = 'dept-kitchen';
export const BARISTA = 'dept-barista';

export const who = (id: string, name: string, role: string) => ({ id, name, role: role as RequisitionRecord['openedBy']['role'] });
export const manager = who('mgr-1', 'Mary Njeri', 'MANAGER');
export const kitchenHead = who('head-k', 'Grace Wanjiru', 'CHEF');

export const makeLine = (id: string, itemId: string, name: string, requested: number, extra: Partial<LineRecord> = {}): LineRecord => ({
  id,
  requisitionSectionId: 'sec-k',
  inventoryItemId: itemId,
  parAtRequest: D(36),
  requestedQty: D(requested),
  approvedQty: null,
  addedFromNote: false,
  editedById: null,
  editReason: null,
  deletedAt: null,
  suggestedQty: D(requested),
  onHandAtRequest: D(9),
  unitCostAtApproval: null,
  additionId: null,
  item: { id: itemId, name, usageUnit: 'kg', currentCost: D(100), category: { id: 'cat-1', name: 'Dairy', parentCategoryId: null } },
  ...extra,
});

export const makeSection = (id: string, departmentId: string, name: string, status: SectionRecord['status'], lines: LineRecord[], extra: Partial<SectionRecord> = {}): SectionRecord => ({
  id,
  requisitionId: 'req-1',
  departmentTag: departmentId === KITCHEN ? 'KITCHEN' : 'BARISTA',
  status,
  submittedById: status === 'SUBMITTED' ? kitchenHead.id : null,
  submittedAt: status === 'SUBMITTED' ? new Date('2026-10-08T07:00:00Z') : null,
  returnedNote: null,
  managerNote: null,
  departmentId,
  skippedById: null,
  skippedAt: null,
  department: { id: departmentId, name, status: 'ACTIVE', key: departmentId === KITCHEN ? 'KITCHEN' : 'BARISTA' },
  submittedBy: status === 'SUBMITTED' ? kitchenHead : null,
  skippedBy: null,
  lines,
  ...extra,
});

export const makeAddition = (id: string, departmentId: string, status: AdditionRecord['status'] = 'PENDING'): AdditionRecord => ({
  id,
  requisitionId: 'req-1',
  departmentId,
  addedById: kitchenHead.id,
  addedAt: new Date('2026-10-08T09:00:00Z'),
  sentPinSignedAt: new Date('2026-10-08T09:00:00Z'),
  status,
  approvedById: null,
  approvedAt: null,
  department: { id: departmentId, name: 'Kitchen', status: 'ACTIVE', key: 'KITCHEN' },
  addedBy: kitchenHead,
  approvedBy: null,
});

export const makeRequisition = (status: RequisitionRecord['status'], sections: SectionRecord[], extra: Partial<RequisitionRecord> = {}): RequisitionRecord => ({
  id: 'req-1',
  siteId: SITE,
  type: 'AFTERNOON',
  note: null,
  status,
  openedById: kitchenHead.id,
  openedAt: new Date('2026-10-08T06:00:00Z'),
  approvedById: null,
  approvedAt: null,
  reference: 'REQ-NYR-0112',
  urgent: false,
  urgentAt: null,
  urgentEscalatedAt: null,
  urgentNote: null,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  closedAt: null,
  approvedAsId: null,
  idempotencyKey: null,
  site: { id: SITE, name: 'Nyeri Town', code: 'NYR' },
  openedBy: kitchenHead,
  approvedBy: null,
  cancelledBy: null,
  sections,
  additions: [],
  ...extra,
});

/** Kitchen sent (2 lines), Barista sent (1 line): Ready to approve. */
export const readyRequisition = (): RequisitionRecord =>
  makeRequisition('PENDING_APPROVAL', [
    makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [makeLine('l1', 'i1', 'Milk', 30), makeLine('l2', 'i2', 'Eggs', 12)]),
    makeSection('sec-b', BARISTA, 'Barista', 'SUBMITTED', [makeLine('l3', 'i3', 'Coffee beans', 5, { requisitionSectionId: 'sec-b' })]),
  ]);
