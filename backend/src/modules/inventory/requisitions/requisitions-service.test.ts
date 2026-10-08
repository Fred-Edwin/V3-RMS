import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../utils/errors';
import {
  D, BARISTA, KITCHEN, OTHER_SITE, SITE, kitchenHead, makeAddition, makeLine, makeRequisition, makeSection, manager, readyRequisition,
} from './requisitions-fixtures';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  verifyOwn: vi.fn(),
  nextNumber: vi.fn(),
  publish: vi.fn(),
  repo: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('../../../config/database', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('../counting/_shared/count-pin', () => ({ countPin: { verifyOwn: mocks.verifyOwn } }));
vi.mock('../_shared/reference-counter', () => ({ referenceCounterRepository: { nextNumber: mocks.nextNumber } }));
vi.mock('./requisitions-events', () => ({ requisitionNotices: { publish: mocks.publish, subscribe: vi.fn() } }));
vi.mock('./requisitions-repository', () => {
  const names = [
    'findStaff', 'listHeads', 'findFile', 'findByStartKey', 'findEventByKey', 'findOpenForCycle', 'findSite', 'listActiveDepartments', 'listTaggedItems',
    'findTaggedItemIds', 'findDepartmentLocation', 'readStock', 'findCategoryNames', 'hasDispatch', 'lockCycle', 'createRequisition', 'createSection',
    'createLines', 'updateSection', 'updateLine', 'removeLines', 'removeSectionLines', 'setStatus', 'setUrgent', 'freezeForApproval', 'createAddition',
    'setAdditionStatus', 'freezeAdditionLines', 'appendEvent', 'findAllInAt', 'readSectionFacts',
  ];
  for (const n of names) mocks.repo[n] = vi.fn();
  return { requisitionsRepository: mocks.repo };
});

import { requisitionsService } from './requisitions-service';
import { buildPrint } from './requisitions-print';

type Actor = Parameters<typeof requisitionsService.getFile>[0];
const actorOf = (id: string, role: Actor['role'], siteId: string | null, extra: Partial<Actor> = {}): Actor => ({ id, role, siteId, ...extra });
const staffOf = (id: string, role: Actor['role'], siteId: string | null, departmentId: string | null = null, head = false) => ({
  id, name: `${role} person`, role, siteId, isDepartmentHead: head, departmentId,
});

const branchManager = actorOf('mgr-1', 'MANAGER', SITE);
const kitchen = actorOf('head-k', 'CHEF', SITE, { isDepartmentHead: true, departmentTag: 'KITCHEN' });
const barista = actorOf('head-b', 'BARISTA', SITE, { isDepartmentHead: true, departmentTag: 'BARISTA' });
const director = actorOf('dir-1', 'DIRECTOR', null);
const sysAdmin = actorOf('adm-1', 'SYSTEM_ADMIN', null);
const attendant = actorOf('att-1', 'STORE_ATTENDANT', 'hub');
const otherManager = actorOf('mgr-2', 'MANAGER', OTHER_SITE);

const STAFF: Record<string, ReturnType<typeof staffOf>> = {
  'mgr-1': staffOf('mgr-1', 'MANAGER', SITE),
  'mgr-2': staffOf('mgr-2', 'MANAGER', OTHER_SITE),
  'head-k': staffOf('head-k', 'CHEF', SITE, KITCHEN, true),
  'head-b': staffOf('head-b', 'BARISTA', SITE, BARISTA, true),
  'dir-1': staffOf('dir-1', 'DIRECTOR', null),
  'adm-1': staffOf('adm-1', 'SYSTEM_ADMIN', null),
  'att-1': staffOf('att-1', 'STORE_ATTENDANT', 'hub'),
  member: staffOf('member', 'WAITER', SITE, KITCHEN, false),
};
const member = actorOf('member', 'WAITER', SITE);

const KEY = 'idem-key-0001';
const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  return 'NO_ERROR';
};
const moneyKeys = (value: unknown, found = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => moneyKeys(v, found));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/value|cost|price|kes/i.test(k)) found.add(k);
      moneyKeys(v, found);
    }
  }
  return found;
};

let current = readyRequisition();
const serve = (rec: typeof current) => {
  current = rec;
  mocks.repo['findFile']!.mockImplementation(async () => current);
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(mocks.repo)) fn.mockReset();
  mocks.transaction.mockImplementation(async (fn: (tx: object) => unknown) => fn({}));
  mocks.verifyOwn.mockResolvedValue(undefined);
  mocks.nextNumber.mockResolvedValue(113);
  mocks.repo['findStaff']!.mockImplementation(async (id: string) => STAFF[id] ?? null);
  mocks.repo['listHeads']!.mockResolvedValue([]);
  mocks.repo['findCategoryNames']!.mockResolvedValue(new Map());
  mocks.repo['hasDispatch']!.mockResolvedValue(false);
  mocks.repo['findEventByKey']!.mockResolvedValue(false);
  mocks.repo['findAllInAt']!.mockResolvedValue(new Date('2026-10-08T07:30:00Z'));
  mocks.repo['findTaggedItemIds']!.mockImplementation(async (_s: string, _d: string, ids: string[]) => new Set(ids.filter((i) => i.startsWith('i'))));
  mocks.repo['listTaggedItems']!.mockResolvedValue([]);
  mocks.repo['findDepartmentLocation']!.mockResolvedValue(null);
  mocks.repo['readSectionFacts']!.mockImplementation(async () => ({
    status: current.status,
    sections: current.sections.map((s) => ({ status: s.status, departmentActive: true })),
  }));
  mocks.repo['createRequisition']!.mockResolvedValue({ id: 'req-1' });
  mocks.repo['createSection']!.mockImplementation(async () => ({ id: `sec-${Math.random()}` }));
  mocks.repo['createAddition']!.mockResolvedValue({ id: 'add-1' });
  mocks.repo['updateSection']!.mockResolvedValue(true);
  mocks.repo['setStatus']!.mockResolvedValue(true);
  serve(readyRequisition());
});

describe('start (R11)', () => {
  const input = { cycle: 'AFTERNOON' as const, idempotencyKey: KEY };
  beforeEach(() => {
    mocks.repo['findSite']!.mockResolvedValue({ id: SITE, name: 'Nyeri Town', code: 'NYR', type: 'BRANCH' });
    mocks.repo['findByStartKey']!.mockResolvedValue(null);
    mocks.repo['findOpenForCycle']!.mockResolvedValue(null);
    mocks.repo['listActiveDepartments']!.mockResolvedValue([
      { id: KITCHEN, name: 'Kitchen', key: 'KITCHEN', itemCount: 4 },
      { id: 'dept-garden', name: 'Garden', key: null, itemCount: 0 },
    ]);
  });

  it('numbers the requisition from the branch counter and writes the event', async () => {
    const result = await requisitionsService.start(branchManager, input);
    expect(mocks.nextNumber).toHaveBeenCalledWith(expect.anything(), SITE, 'REQ');
    expect(mocks.repo['createRequisition']).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reference: 'REQ-NYR-0113', siteId: SITE, type: 'AFTERNOON', openedById: 'mgr-1' }));
    expect(mocks.repo['appendEvent']).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'STARTED', actorId: 'mgr-1' }));
    expect(result.replayed).toBe(false);
  });

  it('refuses a second open requisition for the cycle (409 REQUISITION_ALREADY_OPEN)', async () => {
    mocks.repo['findOpenForCycle']!.mockResolvedValue({ id: 'req-9', reference: 'REQ-NYR-0100' });
    expect(await codeOf(requisitionsService.start(branchManager, input))).toBe('REQUISITION_ALREADY_OPEN');
    expect(mocks.repo['createRequisition']).not.toHaveBeenCalled();
  });

  it('serialises on the branch and cycle before it looks for an open one', async () => {
    await requisitionsService.start(branchManager, input);
    const lock = mocks.repo['lockCycle']!.mock.invocationCallOrder[0] ?? 0;
    const look = mocks.repo['findOpenForCycle']!.mock.invocationCallOrder[0] ?? 0;
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(look);
  });

  it('a department with no tagged items starts Skipped by rule; the others Not started', async () => {
    await requisitionsService.start(branchManager, input);
    const statuses = mocks.repo['createSection']!.mock.calls.map((c) => (c[1] as { departmentId: string; status: string }).status);
    expect(statuses).toEqual(['NOT_STARTED', 'SKIPPED']);
    const garden = mocks.repo['createSection']!.mock.calls.map((c) => c[1] as { departmentId: string; departmentTag: string | null }).find((s) => s.departmentId === 'dept-garden');
    expect(garden?.departmentTag).toBeNull(); // dual-write: an added department has no legacy key
  });

  it('dual-writes departmentTag with departmentId on the original five', async () => {
    await requisitionsService.start(branchManager, input);
    const kitchenSection = mocks.repo['createSection']!.mock.calls.map((c) => c[1] as { departmentId: string; departmentTag: string | null }).find((s) => s.departmentId === KITCHEN);
    expect(kitchenSection?.departmentTag).toBe('KITCHEN');
  });

  it('a repeated key returns the first result with replayed true and creates nothing', async () => {
    mocks.repo['findByStartKey']!.mockResolvedValue({ id: 'req-1' });
    const result = await requisitionsService.start(branchManager, input);
    expect(result.replayed).toBe(true);
    expect(mocks.repo['createRequisition']).not.toHaveBeenCalled();
  });

  it('a department head may start; a member and the Attendant may not', async () => {
    expect(await codeOf(requisitionsService.start(kitchen, input))).toBe('NO_ERROR');
    expect(await codeOf(requisitionsService.start(member, input))).toBe('AUTHORIZATION_ERROR');
    expect(await codeOf(requisitionsService.start(attendant, input))).toBe('AUTHORIZATION_ERROR');
  });

  it('pre-fills only the starter head\'s own section', async () => {
    mocks.repo['listTaggedItems']!.mockResolvedValue([{ id: 'i1', name: 'Milk', usageUnit: 'L', currentCost: D(100), category: null }]);
    mocks.repo['findDepartmentLocation']!.mockResolvedValue({ id: 'loc-k' });
    mocks.repo['readStock']!.mockResolvedValue({ level: new Map([['i1', D(36)]]), onHand: new Map([['i1', D(9)]]) });
    mocks.repo['createSection']!.mockImplementation(async (_tx: unknown, d: { departmentId: string }) => ({ id: `sec-${d.departmentId}` }));
    await requisitionsService.start(kitchen, input);
    const [, sectionId, lines] = mocks.repo['createLines']!.mock.calls[0] as [unknown, string, Array<{ requestedQty: Prisma.Decimal; suggestedQty: Prisma.Decimal | null }>];
    expect(sectionId).toBe(`sec-${KITCHEN}`);
    expect(lines[0]?.requestedQty.toString()).toBe('27'); // restock level 36 minus on hand 9
    expect(lines[0]?.suggestedQty?.toString()).toBe('27');
  });

  it('refuses when the branch has no code yet', async () => {
    mocks.repo['findSite']!.mockResolvedValue({ id: SITE, name: 'Nyeri Town', code: null, type: 'BRANCH' });
    expect(await codeOf(requisitionsService.start(branchManager, input))).toBe('BRANCH_CODE_MISSING');
  });
});

describe('saveLines (R12): section lines validation, reopen on edit', () => {
  const lines = (...ids: string[]) => ({ lines: ids.map((itemId) => ({ itemId, requestedQty: '4' })) });

  it('refuses an item not tagged to the department (422 ITEM_NOT_IN_DEPARTMENT)', async () => {
    serve(makeRequisition('OPEN', [makeSection('sec-k', KITCHEN, 'Kitchen', 'DRAFT', [])]));
    expect(await codeOf(requisitionsService.saveLines(kitchen, 'req-1', KITCHEN, lines('i1', 'x-bad')))).toBe('ITEM_NOT_IN_DEPARTMENT');
    expect(mocks.repo['createLines']).not.toHaveBeenCalled();
  });

  it('a Sent section reopens as a Draft and the requisition leaves Ready to approve', async () => {
    mocks.repo['findTaggedItemIds']!.mockResolvedValue(new Set(['i1', 'i2']));
    await requisitionsService.saveLines(kitchen, 'req-1', KITCHEN, lines('i1', 'i2'));
    expect(mocks.repo['updateSection']).toHaveBeenCalledWith(expect.anything(), SITE, 'sec-k', expect.objectContaining({ status: 'DRAFT', submittedAt: null, submittedById: null }));
    expect(mocks.repo['readSectionFacts']).toHaveBeenCalled(); // the status is recomputed in the same transaction
  });

  it('writes a new line without a suggested number, updates a changed quantity, and removes a dropped line', async () => {
    mocks.repo['findTaggedItemIds']!.mockResolvedValue(new Set(['i1', 'i9']));
    mocks.repo['listTaggedItems']!.mockResolvedValue([{ id: 'i9', name: 'Cream', usageUnit: 'L', currentCost: D(10), category: null }]);
    await requisitionsService.saveLines(kitchen, 'req-1', KITCHEN, { lines: [{ itemId: 'i1', requestedQty: '31' }, { itemId: 'i9', requestedQty: '2' }] });
    expect(mocks.repo['updateLine']).toHaveBeenCalledWith(expect.anything(), SITE, 'l1', { requestedQty: D(31) });
    expect(mocks.repo['removeLines']).toHaveBeenCalledWith(expect.anything(), SITE, ['l2']);
    const [, , created] = mocks.repo['createLines']!.mock.calls[0] as [unknown, string, Array<{ inventoryItemId: string; suggestedQty: unknown }>];
    expect(created).toEqual([expect.objectContaining({ inventoryItemId: 'i9', suggestedQty: null })]);
  });

  it('a head of another department is told it is not theirs (403 NOT_YOUR_DEPARTMENT)', async () => {
    expect(await codeOf(requisitionsService.saveLines(barista, 'req-1', KITCHEN, lines('i1')))).toBe('NOT_YOUR_DEPARTMENT');
  });

  it('the Branch Manager may fill a section herself', async () => {
    mocks.repo['findTaggedItemIds']!.mockResolvedValue(new Set(['i1']));
    expect(await codeOf(requisitionsService.saveLines(branchManager, 'req-1', KITCHEN, lines('i1')))).toBe('NO_ERROR');
  });

  it('refuses once the requisition is signed (409 ALREADY_APPROVED) and once it is cancelled (409 CANCELLED)', async () => {
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    expect(await codeOf(requisitionsService.saveLines(kitchen, 'req-1', KITCHEN, lines('i1')))).toBe('ALREADY_APPROVED');
    serve(makeRequisition('CANCELLED', readyRequisition().sections));
    expect(await codeOf(requisitionsService.saveLines(kitchen, 'req-1', KITCHEN, lines('i1')))).toBe('CANCELLED');
  });

  it('refuses a Skipped section', async () => {
    serve(makeRequisition('OPEN', [makeSection('sec-k', KITCHEN, 'Kitchen', 'SKIPPED', [])]));
    expect(await codeOf(requisitionsService.saveLines(kitchen, 'req-1', KITCHEN, lines('i1')))).toBe('SECTION_NOT_OPEN');
  });
});

describe('sendSection (R13)', () => {
  const draft = () => makeRequisition('OPEN', [makeSection('sec-k', KITCHEN, 'Kitchen', 'DRAFT', [makeLine('l1', 'i1', 'Milk', 30)]), makeSection('sec-b', BARISTA, 'Barista', 'SUBMITTED', [makeLine('l3', 'i3', 'Beans', 5)])]);

  it('marks the section Sent, verifies the sender\'s own PIN, and tells the manager once everything is in', async () => {
    serve(draft());
    mocks.repo['readSectionFacts']!.mockResolvedValue({ status: 'OPEN', sections: [{ status: 'SUBMITTED', departmentActive: true }, { status: 'SUBMITTED', departmentActive: true }] });
    await requisitionsService.sendSection(kitchen, 'req-1', KITCHEN, '1234', KEY);
    expect(mocks.verifyOwn).toHaveBeenCalledWith(kitchen, '1234');
    expect(mocks.repo['updateSection']).toHaveBeenCalledWith(expect.anything(), SITE, 'sec-k', expect.objectContaining({ status: 'SUBMITTED', submittedById: 'head-k' }));
    expect(mocks.repo['setStatus']).toHaveBeenCalledWith(expect.anything(), SITE, 'req-1', 'PENDING_APPROVAL');
    expect(mocks.repo['appendEvent']).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'SENT', idempotencyKey: KEY }));
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'SECTION_SENT', departmentId: KITCHEN, readyToApprove: true }));
  });

  it('a section with no lines cannot be sent (409 SECTION_EMPTY) and the PIN is not even asked', async () => {
    serve(makeRequisition('OPEN', [makeSection('sec-k', KITCHEN, 'Kitchen', 'DRAFT', [])]));
    expect(await codeOf(requisitionsService.sendSection(kitchen, 'req-1', KITCHEN, '1234', KEY))).toBe('SECTION_EMPTY');
    expect(mocks.verifyOwn).not.toHaveBeenCalled();
  });

  it('a wrong PIN stops the send and writes nothing', async () => {
    serve(draft());
    mocks.verifyOwn.mockRejectedValue(new AppError(401, 'INVALID_PIN', 'That PIN is not right.'));
    expect(await codeOf(requisitionsService.sendSection(kitchen, 'req-1', KITCHEN, '0000', KEY))).toBe('INVALID_PIN');
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('a repeated key returns the first result (replayed) without a PIN or a write', async () => {
    mocks.repo['findEventByKey']!.mockResolvedValue(true);
    const result = await requisitionsService.sendSection(kitchen, 'req-1', KITCHEN, '1234', KEY);
    expect(result.replayed).toBe(true);
    expect(mocks.verifyOwn).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('a section already Sent is refused', async () => {
    expect(await codeOf(requisitionsService.sendSection(kitchen, 'req-1', KITCHEN, '1234', KEY))).toBe('SECTION_ALREADY_SENT');
  });
});

describe('recallSection (R14): only before approval', () => {
  it('takes a Sent section back to Draft and reopens the requisition', async () => {
    await requisitionsService.recallSection(kitchen, 'req-1', KITCHEN);
    expect(mocks.repo['updateSection']).toHaveBeenCalledWith(expect.anything(), SITE, 'sec-k', { status: 'DRAFT', submittedAt: null, submittedById: null });
    expect(mocks.repo['appendEvent']).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'RECALLED' }));
  });
  it('is refused after approval (409 ALREADY_APPROVED)', async () => {
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    expect(await codeOf(requisitionsService.recallSection(kitchen, 'req-1', KITCHEN))).toBe('ALREADY_APPROVED');
  });
  it('is the head\'s own action: the manager and another head cannot recall', async () => {
    expect(await codeOf(requisitionsService.recallSection(branchManager, 'req-1', KITCHEN))).toBe('NOT_YOUR_DEPARTMENT');
    expect(await codeOf(requisitionsService.recallSection(barista, 'req-1', KITCHEN))).toBe('NOT_YOUR_DEPARTMENT');
  });
});

describe('approve (R19): the signer and the path for Director and System Admin', () => {
  const approveCall = (who: Actor) => requisitionsService.approve(who, 'req-1', { pin: '1234' }, KEY);

  it('the Branch Manager signs: frozen costs, approved status, no separate "signed as" record', async () => {
    await approveCall(branchManager);
    expect(mocks.verifyOwn).toHaveBeenCalledWith(branchManager, '1234');
    expect(mocks.repo['freezeForApproval']).toHaveBeenCalledWith(expect.anything(), SITE, 'req-1');
    expect(mocks.repo['setStatus']).toHaveBeenCalledWith(expect.anything(), SITE, 'req-1', 'APPROVED', expect.objectContaining({ approvedById: 'mgr-1', approvedAsId: null }));
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'APPROVED', signedAs: 'BRANCH_MANAGER' }));
  });

  it('the Director may approve any branch with their own PIN, and the record shows who', async () => {
    await approveCall(director);
    expect(mocks.verifyOwn).toHaveBeenCalledWith(director, '1234');
    expect(mocks.repo['setStatus']).toHaveBeenCalledWith(expect.anything(), SITE, 'req-1', 'APPROVED', expect.objectContaining({ approvedById: 'dir-1', approvedAsId: 'dir-1' }));
    expect(mocks.repo['appendEvent']).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'APPROVED', toValue: 'DIRECTOR', actorId: 'dir-1' }));
  });

  it('the System Admin approves with their own PIN', async () => {
    await approveCall(sysAdmin);
    expect(mocks.repo['setStatus']).toHaveBeenCalledWith(expect.anything(), SITE, 'req-1', 'APPROVED', expect.objectContaining({ approvedAsId: 'adm-1' }));
  });

  it('a Branch Manager of ANOTHER branch cannot approve (scope: the file is not theirs)', async () => {
    mocks.repo['findFile']!.mockImplementation(async (_id: string, scope: { siteId?: string }) => (scope.siteId && scope.siteId !== SITE ? null : current));
    expect(await codeOf(approveCall(otherManager))).toBe('NOT_FOUND');
  });

  it.each([
    ['a department head', kitchen],
    ['the Attendant', attendant],
    ['a member', member],
  ])('%s may not approve', async (_n, who) => {
    expect(['AUTHORIZATION_ERROR', 'NOT_YOUR_DEPARTMENT']).toContain(await codeOf(approveCall(who)));
    expect(mocks.repo['setStatus']).not.toHaveBeenCalled();
  });

  it('refuses a requisition still collecting (409 NOT_READY_TO_APPROVE)', async () => {
    serve(makeRequisition('OPEN', readyRequisition().sections));
    expect(await codeOf(approveCall(branchManager))).toBe('NOT_READY_TO_APPROVE');
  });
  it('refuses a signed one (409 ALREADY_APPROVED) and a cancelled one (409 CANCELLED)', async () => {
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    expect(await codeOf(approveCall(branchManager))).toBe('ALREADY_APPROVED');
    serve(makeRequisition('CANCELLED', readyRequisition().sections));
    expect(await codeOf(approveCall(branchManager))).toBe('CANCELLED');
  });
  it('a wrong PIN writes nothing', async () => {
    mocks.verifyOwn.mockRejectedValue(new AppError(401, 'INVALID_PIN', 'That PIN is not right.'));
    expect(await codeOf(approveCall(branchManager))).toBe('INVALID_PIN');
    expect(mocks.repo['setStatus']).not.toHaveBeenCalled();
  });
  it('a repeated key returns the first result (replayed) and signs nothing again', async () => {
    mocks.repo['findEventByKey']!.mockResolvedValue(true);
    serve(makeRequisition('APPROVED', readyRequisition().sections, { approvedAt: new Date(), approvedBy: manager, approvedById: manager.id }));
    const result = await approveCall(branchManager);
    expect(result.replayed).toBe(true);
    expect(mocks.repo['freezeForApproval']).not.toHaveBeenCalled();
  });
});

describe('cancel (R20): before approval only', () => {
  const cancelCall = (who: Actor) => requisitionsService.cancel(who, 'req-1', { reason: 'Wrong day', pin: '1234' }, KEY);
  it('cancels with a reason and a PIN; the file stays', async () => {
    await cancelCall(branchManager);
    expect(mocks.repo['setStatus']).toHaveBeenCalledWith(expect.anything(), SITE, 'req-1', 'CANCELLED', expect.objectContaining({ cancelReason: 'Wrong day', cancelledById: 'mgr-1' }));
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'CANCELLED', reason: 'Wrong day' }));
  });
  it('is refused after approval', async () => {
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    expect(await codeOf(cancelCall(branchManager))).toBe('ALREADY_APPROVED');
  });
  it('is the manager\'s: a head and the Director cannot cancel', async () => {
    expect(await codeOf(cancelCall(kitchen))).toBe('AUTHORIZATION_ERROR');
    expect(await codeOf(cancelCall(director))).toBe('AUTHORIZATION_ERROR');
  });
});

describe('additions (R21, R22)', () => {
  const approved = () =>
    makeRequisition('APPROVED', readyRequisition().sections, { approvedAt: new Date('2026-10-08T08:00:00Z'), approvedBy: manager, approvedById: manager.id });
  const addCall = (who: Actor = kitchen) => requisitionsService.addAddition(who, 'req-1', { lines: [{ itemId: 'i5', requestedQty: '3' }], pin: '1234' }, KEY);

  it('a head adds to an approved requisition: a PENDING addition, its lines tied to it, signed with their PIN', async () => {
    serve(approved());
    mocks.repo['findFile']!.mockImplementation(async () => ({ ...current, additions: [makeAddition('add-1', KITCHEN)] }));
    mocks.repo['findTaggedItemIds']!.mockResolvedValue(new Set(['i5']));
    await addCall();
    expect(mocks.verifyOwn).toHaveBeenCalledWith(kitchen, '1234');
    expect(mocks.repo['createAddition']).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ departmentId: KITCHEN, addedById: 'head-k' }));
    const [, , lines] = mocks.repo['createLines']!.mock.calls[0] as [unknown, string, Array<{ additionId: string }>];
    expect(lines[0]?.additionId).toBe('add-1');
  });

  it('is locked once the department\'s dispatch is signed (409 ADDITION_LOCKED)', async () => {
    serve(approved());
    mocks.repo['hasDispatch']!.mockResolvedValue(true);
    expect(await codeOf(addCall())).toBe('ADDITION_LOCKED');
  });

  it('before approval there is nothing to add to', async () => {
    expect(await codeOf(addCall())).toBe('NOT_APPROVED');
  });

  it('refuses an item not tagged to the department', async () => {
    serve(approved());
    mocks.repo['findTaggedItemIds']!.mockResolvedValue(new Set());
    expect(await codeOf(addCall())).toBe('ITEM_NOT_IN_DEPARTMENT');
  });

  it('only a department head adds (the manager does not)', async () => {
    serve(approved());
    expect(await codeOf(addCall(branchManager))).toBe('NOT_YOUR_DEPARTMENT');
  });

  it('the Director approves an addition with their own PIN; the Block 2 hand-off runs', async () => {
    serve({ ...approved(), additions: [makeAddition('add-1', KITCHEN)] });
    await requisitionsService.approveAddition(director, 'req-1', 'add-1', { pin: '1234' }, KEY);
    expect(mocks.verifyOwn).toHaveBeenCalledWith(director, '1234');
    expect(mocks.repo['setAdditionStatus']).toHaveBeenCalledWith(expect.anything(), SITE, 'add-1', expect.objectContaining({ status: 'APPROVED', approvedById: 'dir-1' }));
    expect(mocks.repo['freezeAdditionLines']).toHaveBeenCalledWith(expect.anything(), SITE, 'add-1');
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADDITION_APPROVED', additionId: 'add-1' }));
  });

  it('an addition already decided cannot be approved again', async () => {
    serve({ ...approved(), additions: [makeAddition('add-1', KITCHEN, 'APPROVED')] });
    expect(await codeOf(requisitionsService.approveAddition(branchManager, 'req-1', 'add-1', { pin: '1234' }, KEY))).toBe('ADDITION_NOT_PENDING');
  });
});

describe('changeQuantity (R16)', () => {
  const lineId = 'l1';
  it('before approval the reason is optional, and the head is told', async () => {
    serve(makeRequisition('PENDING_APPROVAL', readyRequisition().sections));
    await requisitionsService.changeQuantity(branchManager, 'req-1', lineId, { approvedQty: '24' });
    expect(mocks.repo['updateLine']).toHaveBeenCalledWith(expect.anything(), SITE, lineId, expect.objectContaining({ approvedQty: D(24), editedById: 'mgr-1' }));
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'QUANTITY_CHANGED', from: '30', to: '24', itemName: 'Milk' }));
  });
  it('after approval a reason is required (422 REASON_REQUIRED)', async () => {
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    expect(await codeOf(requisitionsService.changeQuantity(branchManager, 'req-1', lineId, { approvedQty: '24' }))).toBe('REASON_REQUIRED');
    expect(await codeOf(requisitionsService.changeQuantity(branchManager, 'req-1', lineId, { approvedQty: '24', reason: 'Short on stock' }))).toBe('NO_ERROR');
  });
  it('after the department is packed it is locked (409 DEPARTMENT_PACKED)', async () => {
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    mocks.repo['hasDispatch']!.mockResolvedValue(true);
    expect(await codeOf(requisitionsService.changeQuantity(branchManager, 'req-1', lineId, { approvedQty: '24', reason: 'x' }))).toBe('DEPARTMENT_PACKED');
  });
  it('records the event with from, to and reason', async () => {
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    await requisitionsService.changeQuantity(branchManager, 'req-1', lineId, { approvedQty: '24', reason: 'Short on stock' });
    expect(mocks.repo['appendEvent']).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'QUANTITY_CHANGED', fromValue: '30', toValue: '24', reason: 'Short on stock', lineId }));
  });
  it('is the manager\'s: a head and the Director cannot', async () => {
    expect(await codeOf(requisitionsService.changeQuantity(kitchen, 'req-1', lineId, { approvedQty: '1' }))).toBe('AUTHORIZATION_ERROR');
    expect(await codeOf(requisitionsService.changeQuantity(director, 'req-1', lineId, { approvedQty: '1' }))).toBe('AUTHORIZATION_ERROR');
  });
  it('an unknown line is not found', async () => {
    expect(await codeOf(requisitionsService.changeQuantity(branchManager, 'req-1', 'nope', { approvedQty: '1' }))).toBe('NOT_FOUND');
  });
});

describe('nudge, skip and urgent', () => {
  const collecting = () => makeRequisition('OPEN', [makeSection('sec-k', KITCHEN, 'Kitchen', 'DRAFT', [makeLine('l1', 'i1', 'Milk', 3)]), makeSection('sec-b', BARISTA, 'Barista', 'SUBMITTED', [makeLine('l3', 'i3', 'Beans', 5)])]);

  it('the manager nudges a department that has not sent; the head is told', async () => {
    serve(collecting());
    await requisitionsService.nudge(branchManager, 'req-1', KITCHEN);
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'NUDGED', departmentId: KITCHEN }));
  });
  it('a department that already sent is not nudged', async () => {
    serve(collecting());
    expect(await codeOf(requisitionsService.nudge(branchManager, 'req-1', BARISTA))).toBe('SECTION_ALREADY_SENT');
  });
  it('"send without this section" skips it, drops its lines and recomputes the status', async () => {
    serve(collecting());
    await requisitionsService.skip(branchManager, 'req-1', KITCHEN);
    expect(mocks.repo['removeSectionLines']).toHaveBeenCalledWith(expect.anything(), SITE, 'sec-k');
    expect(mocks.repo['updateSection']).toHaveBeenCalledWith(expect.anything(), SITE, 'sec-k', expect.objectContaining({ status: 'SKIPPED', skippedById: 'mgr-1' }));
  });
  it('a head cannot nudge or skip', async () => {
    serve(collecting());
    expect(await codeOf(requisitionsService.nudge(kitchen, 'req-1', BARISTA))).toBe('AUTHORIZATION_ERROR');
    expect(await codeOf(requisitionsService.skip(kitchen, 'req-1', BARISTA))).toBe('AUTHORIZATION_ERROR');
  });
  it('urgent is set before approval and the manager hears at once; setting it again changes nothing', async () => {
    serve(collecting());
    await requisitionsService.setUrgent(branchManager, 'req-1', { urgent: true });
    expect(mocks.repo['setUrgent']).toHaveBeenCalledWith(expect.anything(), SITE, 'req-1', expect.objectContaining({ urgent: true }));
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'URGENT_SET' }));
    mocks.repo['setUrgent']!.mockClear();
    serve({ ...collecting(), urgent: true, urgentAt: new Date() });
    await requisitionsService.setUrgent(branchManager, 'req-1', { urgent: true });
    expect(mocks.repo['setUrgent']).not.toHaveBeenCalled();
  });
  it('a head may set urgent for a requisition their department is part of; after approval nobody may', async () => {
    serve(collecting());
    expect(await codeOf(requisitionsService.setUrgent(kitchen, 'req-1', { urgent: true }))).toBe('NO_ERROR');
    serve(makeRequisition('APPROVED', readyRequisition().sections));
    expect(await codeOf(requisitionsService.setUrgent(branchManager, 'req-1', { urgent: true }))).toBe('ALREADY_APPROVED');
  });
});

describe('money and blind views (the file, R3)', () => {
  it('the Branch Manager sees value per line, section and requisition', async () => {
    const file = await requisitionsService.getFile(branchManager, 'req-1');
    expect(file.valueKes).toBe('4700.00'); // (30 + 12 + 5) x 100
    expect(file.sections[0]?.valueKes).toBe('4200.00');
    expect(file.sections[0]?.lines[0]?.valueKes).toBe('3000.00');
  });
  it('the Director and the System Admin see money too', async () => {
    expect((await requisitionsService.getFile(director, 'req-1')).valueKes).toBe('4700.00');
    expect((await requisitionsService.getFile(sysAdmin, 'req-1')).valueKes).toBe('4700.00');
  });
  it('the Attendant reads the file with no money and no branch stock figures', async () => {
    const file = await requisitionsService.getFile(attendant, 'req-1');
    expect([...moneyKeys(file)]).toEqual([]);
    expect(file.sections[0]?.lines[0]).not.toHaveProperty('onHand');
    expect(file.sections[0]?.lines[0]).not.toHaveProperty('level');
  });
  it('a head sees only their own department, with stock figures for it and no money anywhere', async () => {
    const file = await requisitionsService.getFile(kitchen, 'req-1');
    expect(file.sections.map((s) => s.departmentName)).toEqual(['Kitchen']);
    expect(file.sections[0]?.lines[0]).toMatchObject({ onHand: '9', level: '36' });
    expect([...moneyKeys(file)]).toEqual([]);
    expect(file.lineCount).toBe(2);
  });
  it('a head cannot open a requisition that has no section for their department', async () => {
    serve(makeRequisition('OPEN', [makeSection('sec-b', BARISTA, 'Barista', 'DRAFT', [])]));
    expect(await codeOf(requisitionsService.getFile(kitchen, 'req-1'))).toBe('NOT_YOUR_DEPARTMENT');
  });
  it('a member holds no right and cannot read', async () => {
    expect(await codeOf(requisitionsService.getFile(member, 'req-1'))).toBe('AUTHORIZATION_ERROR');
  });
  it('frozen cost wins after approval: a later price change does not move the value', async () => {
    const lines = [makeLine('l1', 'i1', 'Milk', 10, { approvedQty: D(8), unitCostAtApproval: D(50) })];
    lines[0]!.item.currentCost = D(70);
    serve(makeRequisition('APPROVED', [makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', lines)]));
    expect((await requisitionsService.getFile(branchManager, 'req-1')).valueKes).toBe('400.00');
  });
  it('a pending addition adds no value until it is approved', async () => {
    const add = makeLine('la', 'i9', 'Cream', 4, { additionId: 'add-1' });
    serve({ ...makeRequisition('APPROVED', [makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [makeLine('l1', 'i1', 'Milk', 10), add])]), additions: [makeAddition('add-1', KITCHEN)] });
    const file = await requisitionsService.getFile(branchManager, 'req-1');
    expect(file.valueKes).toBe('1000.00');
    expect(file.additions[0]?.status).toBe('PENDING');
    expect(file.can.approve).toBe(false); // the file is already signed; the addition has its own approve
    expect(file.additions[0]?.can.approve).toBe(true);
  });
  it('the Director sees the approve action on a Ready-to-approve file', async () => {
    expect((await requisitionsService.getFile(director, 'req-1')).can.approve).toBe(true);
    expect((await requisitionsService.getFile(branchManager, 'req-1')).can.nudge).toBe(false); // not collecting
  });
});

describe('approve summary (R10)', () => {
  it('lists the departments, what the manager changed, and who would sign', async () => {
    const changed = makeLine('l1', 'i1', 'Milk', 30, { approvedQty: D(24), editedById: 'mgr-1', editReason: 'Short' });
    serve(makeRequisition('PENDING_APPROVAL', [makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [changed])]));
    const summary = await requisitionsService.getApproveSummary(director, 'req-1');
    expect(summary.signingAs).toBe('DIRECTOR');
    expect(summary.changes).toEqual([{ departmentName: 'Kitchen', itemName: 'Milk', from: '30', to: '24', reason: 'Short' }]);
    expect(summary.signatureLine).toBe('One signature covers the whole requisition.');
  });
  it('is for approvers only', async () => {
    expect(await codeOf(requisitionsService.getApproveSummary(kitchen, 'req-1'))).toBe('AUTHORIZATION_ERROR');
  });
});

describe('section edit screen (R8)', () => {
  it('returns the addable items, marks the ones already in, and shows stock only for the head\'s own department', async () => {
    mocks.repo['listTaggedItems']!.mockResolvedValue([
      { id: 'i1', name: 'Milk', usageUnit: 'L', currentCost: D(100), category: { id: 'c', name: 'Dairy', parentCategoryId: null } },
      { id: 'i7', name: 'Butter', usageUnit: 'kg', currentCost: D(100), category: null },
    ]);
    mocks.repo['findDepartmentLocation']!.mockResolvedValue({ id: 'loc-k' });
    mocks.repo['readStock']!.mockResolvedValue({ level: new Map([['i1', D(36)], ['i7', D(5)]]), onHand: new Map([['i1', D(9)], ['i7', D(8)]]) });
    const edit = await requisitionsService.getSection(kitchen, 'req-1', KITCHEN);
    expect(edit.addable.map((a) => [a.itemId, a.inSection, a.suggestedQty])).toEqual([['i1', true, '27'], ['i7', false, '0']]);
    expect(edit.addable[0]).toMatchObject({ onHand: '9', level: '36' });
    const asAttendant = await requisitionsService.getSection(attendant, 'req-1', KITCHEN);
    expect(asAttendant.addable[0]).not.toHaveProperty('onHand');
  });
  it('another department\'s head cannot open it', async () => {
    expect(await codeOf(requisitionsService.getSection(barista, 'req-1', KITCHEN))).toBe('NOT_YOUR_DEPARTMENT');
  });
});

describe('print data (R6) carries no money', () => {
  it('has no key that mentions value, cost, price or KES', () => {
    const rec = makeRequisition('APPROVED', readyRequisition().sections, { approvedAt: new Date(), approvedBy: manager, approvedById: manager.id });
    expect([...moneyKeys(buildPrint(rec))]).toEqual([]);
  });
  it('prints a cover plus one page per Sent department, marks a changed line, and puts approved additions on the page', () => {
    const changed = makeLine('l1', 'i1', 'Milk', 30, { approvedQty: D(24), editedById: 'mgr-1' });
    const added = makeLine('la', 'i9', 'Cream', 4, { additionId: 'add-1', approvedQty: D(4) });
    const rec = {
      ...makeRequisition('APPROVED', [makeSection('sec-k', KITCHEN, 'Kitchen', 'SUBMITTED', [changed, added]), makeSection('sec-b', BARISTA, 'Barista', 'SKIPPED', [])]),
      additions: [makeAddition('add-1', KITCHEN, 'APPROVED')],
    };
    const print = buildPrint(rec);
    expect(print.pages).toHaveLength(1);
    expect(print.pages[0]?.lines[0]).toMatchObject({ itemName: 'Milk', requestedQty: '30', approvedQty: '24', changed: true });
    expect(print.pages[0]?.additions[0]?.lines[0]).toMatchObject({ itemName: 'Cream' });
    expect(print.cover.departments).toEqual([expect.objectContaining({ departmentName: 'Kitchen', page: 2, lineCount: 2 })]);
    expect(print.cover.additionsCount).toBe(1);
  });
});

describe('tenancy', () => {
  it('every file read names the caller\'s branch, or any branch only for a hub reader', async () => {
    await requisitionsService.getFile(branchManager, 'req-1');
    await requisitionsService.getFile(kitchen, 'req-1');
    await requisitionsService.getFile(director, 'req-1');
    const scopes = mocks.repo['findFile']!.mock.calls.map((c) => c[1]);
    expect(scopes).toEqual([{ siteId: SITE }, { siteId: SITE }, { anyBranch: true }]);
  });
  it('writes update through the branch they belong to', async () => {
    await requisitionsService.recallSection(kitchen, 'req-1', KITCHEN);
    expect(mocks.repo['updateSection']!.mock.calls.every((c) => c[1] === SITE)).toBe(true);
  });
});
