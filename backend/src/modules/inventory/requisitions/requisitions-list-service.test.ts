import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  repo: {} as Record<string, ReturnType<typeof vi.fn>>,
  list: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('../../../config/database', () => ({ prisma: {} }));
vi.mock('../counting/_shared/count-pin', () => ({ countPin: { verifyOwn: vi.fn() } }));
vi.mock('../_shared/reference-counter', () => ({ referenceCounterRepository: { nextNumber: vi.fn() } }));
vi.mock('./requisitions-events', () => ({ requisitionNotices: { publish: vi.fn(), subscribe: vi.fn() } }));
vi.mock('./requisitions-repository', () => {
  for (const n of ['findStaff', 'listHeads', 'findFile', 'findCategoryNames', 'hasDispatch', 'findDepartment', 'findDepartmentLocation', 'listTaggedItems', 'readStock']) mocks.repo[n] = vi.fn();
  return { requisitionsRepository: mocks.repo };
});
vi.mock('./requisitions-list-repository', () => {
  for (const n of ['listFacts', 'findFiles', 'listBranches', 'listTodayForDepartment', 'listEvents', 'findLineLabels', 'listSectionDepartmentIds']) mocks.list[n] = vi.fn();
  return { requisitionsListRepository: mocks.list };
});

import {
  historyMineSchema,
  homeSchema,
  listRequisitionsQuerySchema,
  listRequisitionsSchema,
  activitySchema,
  documentsSchema,
  type ListRequisitionsQuery,
} from './_shared/requisitions-contract';
import { BARISTA, KITCHEN, SITE, kitchenHead, makeAddition, makeLine, makeRequisition, makeSection, manager, readyRequisition } from './requisitions-fixtures';
import type { FactsRecord } from './requisitions-list-repository';
import { requisitionsListService } from './requisitions-list-service';

type Actor = Parameters<typeof requisitionsListService.list>[0];
const actorOf = (id: string, role: Actor['role'], siteId: string | null, extra: Partial<Actor> = {}): Actor => ({ id, role, siteId, ...extra });
const staff = (id: string, role: Actor['role'], siteId: string | null, departmentId: string | null = null, head = false) => ({ id, name: `${role} person`, role, siteId, isDepartmentHead: head, departmentId });

const branchManager = actorOf('mgr-1', 'MANAGER', SITE);
const otherManager = actorOf('mgr-2', 'MANAGER', 'site-krt');
const director = actorOf('dir-1', 'DIRECTOR', null);
const storeManager = actorOf('sm-1', 'STORE_MANAGER', 'hub');
const attendant = actorOf('att-1', 'STORE_ATTENDANT', 'hub');
const accountant = actorOf('acc-1', 'ACCOUNTANT', 'hub');
const kitchen = actorOf('head-k', 'CHEF', SITE, { isDepartmentHead: true });
const member = actorOf('member', 'WAITER', SITE);
const STAFF: Record<string, ReturnType<typeof staff>> = {
  'mgr-1': staff('mgr-1', 'MANAGER', SITE),
  'mgr-2': staff('mgr-2', 'MANAGER', 'site-krt'),
  'dir-1': staff('dir-1', 'DIRECTOR', null),
  'sm-1': staff('sm-1', 'STORE_MANAGER', 'hub'),
  'att-1': staff('att-1', 'STORE_ATTENDANT', 'hub'),
  'acc-1': staff('acc-1', 'ACCOUNTANT', 'hub'),
  'head-k': staff('head-k', 'CHEF', SITE, KITCHEN, true),
  member: staff('member', 'WAITER', SITE, KITCHEN, false),
};

const BRANCH_UUID = 'b0000000-0000-4000-8000-000000000002';
const DEPT_UUID = 'd0000000-0000-4000-8000-000000000001';
const query = (over: Record<string, unknown> = {}): ListRequisitionsQuery => listRequisitionsQuerySchema.parse(over);

/** A facts record for the tab derivation: the sections' statuses and the old dispatch rows. */
const facts = (
  id: string,
  status: FactsRecord['status'],
  sections: Array<[string, FactsRecord['sections'][number]['status'], 'KITCHEN' | 'BARISTA']> = [],
  dispatches: FactsRecord['dispatches'] = [],
  extra: Partial<FactsRecord> = {},
): FactsRecord => ({
  id,
  status,
  openedAt: new Date('2026-10-08T06:00:00Z'),
  urgent: false,
  urgentAt: null,
  sections: sections.map(([departmentId, s, key]) => ({ departmentId, status: s, department: { key, status: 'ACTIVE' as const }, lines: [{ id: `${departmentId}-line` }] })),
  additions: [],
  dispatches,
  ...extra,
});

/** A live dispatch of a department as the list reads it; signed an hour ago, so it is On the way and not yet Waiting. */
const dsp = (departmentId: string, status: FactsRecord['dispatches'][number]['status'], discrepancyOpen = false): FactsRecord['dispatches'][number] => ({
  departmentId,
  status,
  signedAt: new Date(Date.now() - 60 * 60_000),
  discrepancies: discrepancyOpen ? [{ id: 'd1' }] : [],
});

const KB = (k: FactsRecord['sections'][number]['status'], b: FactsRecord['sections'][number]['status']): Array<[string, typeof k, 'KITCHEN' | 'BARISTA']> => [
  [KITCHEN, k, 'KITCHEN'],
  [BARISTA, b, 'BARISTA'],
];

const FACTS: FactsRecord[] = [
  facts('r-collect-1', 'OPEN', KB('DRAFT', 'SUBMITTED')),
  facts('r-collect-2', 'OPEN', KB('NOT_STARTED', 'NOT_STARTED')),
  facts('r-approve', 'PENDING_APPROVAL', KB('SUBMITTED', 'SUBMITTED')),
  facts('r-pack', 'APPROVED', KB('SUBMITTED', 'SUBMITTED')),
  facts('r-transit', 'APPROVED', KB('SUBMITTED', 'SUBMITTED'), [dsp(KITCHEN, 'ON_THE_WAY'), dsp(BARISTA, 'ON_THE_WAY')]),
  facts('r-disc', 'APPROVED', KB('SUBMITTED', 'SUBMITTED'), [dsp(KITCHEN, 'CONFIRMED'), dsp(BARISTA, 'CONFIRMED', true)]),
  facts('r-done', 'APPROVED', KB('SUBMITTED', 'SUBMITTED'), [dsp(KITCHEN, 'CONFIRMED'), dsp(BARISTA, 'CLOSED')]),
  facts('r-add', 'APPROVED', KB('SUBMITTED', 'SUBMITTED'), [dsp(KITCHEN, 'ON_THE_WAY'), dsp(BARISTA, 'ON_THE_WAY')], { additions: [{ id: 'a1', departmentId: KITCHEN }] }),
  facts('r-cancelled', 'CANCELLED', KB('DRAFT', 'NOT_STARTED')),
];

/** Walks a payload and turns every id-ish string into a UUID, so the frozen contract schemas can parse the fixtures. */
const UUIDS = new Map<string, string>();
const uuidOf = (s: string): string => {
  if (!UUIDS.has(s)) UUIDS.set(s, `00000000-0000-4000-8000-${String(UUIDS.size + 1).padStart(12, '0')}`);
  return UUIDS.get(s) as string;
};
const withUuids = (value: unknown, key = ''): unknown => {
  if (Array.isArray(value)) return value.map((v) => withUuids(v, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withUuids(v, k)]));
  return typeof value === 'string' && (key === 'id' || /Id$/.test(key)) ? uuidOf(value) : value;
};

const records = (ids: string[]) => ids.map((id) => ({ ...readyRequisition(), id, reference: `REQ-NYR-${id}` }));

beforeEach(() => {
  for (const group of [mocks.repo, mocks.list]) for (const fn of Object.values(group)) fn.mockReset();
  mocks.repo['findStaff']!.mockImplementation(async (id: string) => STAFF[id] ?? null);
  mocks.repo['listHeads']!.mockResolvedValue([]);
  mocks.repo['findCategoryNames']!.mockResolvedValue(new Map());
  mocks.repo['hasDispatch']!.mockResolvedValue(false);
  mocks.list['listFacts']!.mockResolvedValue(FACTS);
  mocks.list['findFiles']!.mockImplementation(async (_scope: unknown, ids: string[]) => records(ids));
  mocks.list['listBranches']!.mockResolvedValue([{ id: SITE, name: 'Nyeri Town', code: 'NYR' }]);
});

describe('R1 the list: tabs, counts, rows', () => {
  it('counts every tab from the derived stage and gives the rows of the asked tab', async () => {
    const result = await requisitionsListService.list(branchManager, query({ tab: 'to-approve' }));
    expect(result.tabCounts).toEqual({ collecting: 2, 'to-approve': 2, 'to-pack': 1, 'on-the-way': 1, 'to-confirm': 0, discrepancies: 1, closed: 2 });
    expect(result.tab).toBe('to-approve');
    expect(mocks.list['findFiles']).toHaveBeenCalledWith({ siteId: SITE }, ['r-approve', 'r-add']);
    expect(result.rows.map((r) => r.tab)).toEqual(['to-approve', 'to-approve']);
  });

  it.each([
    ['collecting', ['r-collect-1', 'r-collect-2']],
    ['to-pack', ['r-pack']],
    ['on-the-way', ['r-transit']],
    ['to-confirm', []],
    ['discrepancies', ['r-disc']],
    ['closed', ['r-done', 'r-cancelled']],
  ])('tab %s holds %j', async (tab, ids) => {
    const result = await requisitionsListService.list(branchManager, query({ tab }));
    expect(mocks.list['findFiles']).toHaveBeenCalledWith(expect.anything(), ids);
    expect(result.page.total).toBe(ids.length);
  });

  it('an omitted tab is the caller\'s own: To approve for an approver, To pack for the store, Collecting for a head', async () => {
    expect((await requisitionsListService.list(branchManager, query())).tab).toBe('to-approve');
    expect((await requisitionsListService.list(director, query())).tab).toBe('to-approve');
    expect((await requisitionsListService.list(storeManager, query())).tab).toBe('to-pack');
    expect((await requisitionsListService.list(attendant, query())).tab).toBe('to-pack');
    expect((await requisitionsListService.list(kitchen, query())).tab).toBe('collecting');
    expect((await requisitionsListService.list(accountant, query())).tab).toBe('collecting');
  });

  it('pages the matching rows and reports the total across pages', async () => {
    mocks.list['listFacts']!.mockResolvedValue(Array.from({ length: 60 }, (_, i) => facts(`c${String(i).padStart(2, '0')}`, 'OPEN', KB('DRAFT', 'DRAFT'))));
    const page2 = await requisitionsListService.list(branchManager, query({ tab: 'collecting', page: 2, pageSize: 25 }));
    const ids = mocks.list['findFiles']!.mock.calls[0]?.[1] as string[];
    expect(ids).toHaveLength(25);
    expect(ids[0]).toBe('c25');
    expect(page2.page).toEqual({ page: 2, pageSize: 25, total: 60 });
    expect(page2.tabCounts.collecting).toBe(60);
  });

  it('a page past the end is empty, not an error', async () => {
    const result = await requisitionsListService.list(branchManager, query({ tab: 'collecting', page: 9 }));
    expect(result.rows).toEqual([]);
    expect(result.page.total).toBe(2);
  });

  it('the output parses against the frozen contract', async () => {
    for (const who of [branchManager, director, storeManager, kitchen]) {
      const result = await requisitionsListService.list(who, query({ tab: 'to-approve' }));
      const parsed = listRequisitionsSchema.safeParse(withUuids(result));
      expect(parsed.error?.issues ?? []).toEqual([]);
    }
  });
});

describe('R1 filters', () => {
  it('turns the Nairobi dates into instants (to is inclusive) and passes search, cycle, department, urgent and status through', async () => {
    await requisitionsListService.list(
      director,
      query({ q: 'milk', from: '2026-10-01', to: '2026-10-07', cycle: 'EXTRA', departmentId: DEPT_UUID, urgent: 'true', status: 'APPROVED', branchId: BRANCH_UUID }),
    );
    expect(mocks.list['listFacts']).toHaveBeenCalledWith(
      { anyBranch: true },
      {
        branchId: BRANCH_UUID,
        q: 'milk',
        fromAt: new Date('2026-09-30T21:00:00.000Z'),
        toAt: new Date('2026-10-07T21:00:00.000Z'),
        status: 'APPROVED',
        cycle: 'EXTRA',
        departmentId: DEPT_UUID,
        urgent: true,
      },
    );
  });

  it('urgent=false is passed as false, not dropped', async () => {
    await requisitionsListService.list(director, query({ urgent: 'false' }));
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ anyBranch: true }, { urgent: false });
  });

  it('a hub role gets the branch picker and may narrow by branch', async () => {
    const result = await requisitionsListService.list(storeManager, query({ branchId: BRANCH_UUID }));
    expect(result.branches).toEqual([{ id: SITE, name: 'Nyeri Town', code: 'NYR' }]);
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ anyBranch: true }, { branchId: BRANCH_UUID });
  });

  it('a Branch Manager is held to their own branch: no picker, and a branchId in the query changes nothing', async () => {
    const result = await requisitionsListService.list(branchManager, query({ branchId: BRANCH_UUID }));
    expect(result.branches).toBeUndefined();
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ siteId: SITE }, {});
    expect(mocks.list['listBranches']).not.toHaveBeenCalled();
  });

  it('a Branch Manager of another branch reads their own branch, never this one', async () => {
    await requisitionsListService.list(otherManager, query());
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ siteId: 'site-krt' }, {});
  });
});

describe('R1 who sees what', () => {
  const rowsFor = async (who: Actor) => (await requisitionsListService.list(who, query({ tab: 'to-approve' }))).rows;

  it('the Branch Manager and the Director see money; the Store Manager and Accountant too', async () => {
    for (const who of [branchManager, director, storeManager, accountant]) expect((await rowsFor(who))[0]).toHaveProperty('valueKes');
  });

  it('the Store Attendant sees rows with no money key at all', async () => {
    const rows = await rowsFor(attendant);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(JSON.stringify(row)).not.toMatch(/value|cost|price|kes/i);
  });

  it('a head sees their own department only, with no money, and only requisitions that include it', async () => {
    const result = await requisitionsListService.list(kitchen, query({ tab: 'to-approve' }));
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ siteId: SITE }, { headDepartmentId: KITCHEN });
    for (const row of result.rows) {
      expect(row.sections.map((s) => s.departmentId)).toEqual([KITCHEN]);
      expect(row.lineCount).toBe(2); // Kitchen's two lines, not Barista's third
      expect(JSON.stringify(row)).not.toMatch(/value|cost|price|kes/i);
    }
  });

  it('a department member with no head rights and no read right is refused', async () => {
    await expect(requisitionsListService.list(member, query())).rejects.toMatchObject({ statusCode: 403 });
  });

  it('carries the seven moments and the urgent flags on each row', async () => {
    const urgent = { ...readyRequisition(), id: 'r-approve', urgent: true, urgentAt: new Date('2026-10-08T06:30:00Z'), urgentNote: 'Wedding' };
    mocks.list['findFiles']!.mockResolvedValue([urgent]);
    const [row] = (await requisitionsListService.list(branchManager, query({ tab: 'to-approve' }), new Date('2026-10-08T08:00:00Z'))).rows;
    expect(row).toMatchObject({ allInAt: '2026-10-08T07:00:00.000Z', urgentAt: '2026-10-08T06:30:00.000Z', urgentNote: 'Wedding', sentAt: null, closedAt: null, cancelledAt: null, cancelReason: null, urgent: true, urgentOverHour: true });
  });

  it('the row action: approvers open and approve, the manager nudges the first department still to send, nobody else gets one', async () => {
    const approve = readyRequisition();
    const collecting = makeRequisition('OPEN', [makeSection('sec-k', KITCHEN, 'Kitchen', 'DRAFT', [makeLine('l1', 'i1', 'Milk', 3)]), makeSection('sec-b', BARISTA, 'Barista', 'SUBMITTED', [makeLine('l3', 'i3', 'Beans', 5)])]);
    mocks.list['findFiles']!.mockResolvedValue([approve]);
    expect((await requisitionsListService.list(branchManager, query({ tab: 'to-approve' }))).rows[0]?.rowAction).toEqual({ action: 'APPROVE_AND_SIGN', label: 'Open and approve', departmentId: null });
    expect((await requisitionsListService.list(director, query({ tab: 'to-approve' }))).rows[0]?.rowAction?.action).toBe('APPROVE_AND_SIGN');
    expect((await requisitionsListService.list(storeManager, query({ tab: 'to-approve' }))).rows[0]?.rowAction).toBeNull();
    mocks.list['findFiles']!.mockResolvedValue([collecting]);
    expect((await requisitionsListService.list(branchManager, query({ tab: 'collecting' }))).rows[0]?.rowAction).toEqual({ action: 'NUDGE', label: 'Nudge Kitchen', departmentId: KITCHEN });
    expect((await requisitionsListService.list(director, query({ tab: 'collecting' }))).rows[0]?.rowAction).toBeNull();
    expect((await requisitionsListService.list(otherManager, query({ tab: 'collecting' }))).rows[0]?.rowAction).toBeNull(); // not their branch
  });

  it('an addition waiting shows on the row and gives the approver "Open and approve"', async () => {
    const rec = makeRequisition('APPROVED', readyRequisition().sections, { additions: [makeAddition('add-1', KITCHEN)] });
    mocks.list['findFiles']!.mockResolvedValue([rec]);
    const [row] = (await requisitionsListService.list(branchManager, query({ tab: 'to-approve' }))).rows;
    expect(row).toMatchObject({ additionWaiting: true, rowAction: { action: 'APPROVE_ADDITION' } });
  });
});

describe('waitingForYou (the dark badge) and R2 badges', () => {
  const live = [
    facts('w1', 'PENDING_APPROVAL', KB('SUBMITTED', 'SUBMITTED')),
    facts('w2', 'PENDING_APPROVAL', KB('SUBMITTED', 'SKIPPED')),
    facts('w3', 'APPROVED', KB('SUBMITTED', 'SUBMITTED')),
    facts('w4', 'APPROVED', KB('SUBMITTED', 'SUBMITTED'), [dsp(KITCHEN, 'ON_THE_WAY'), dsp(BARISTA, 'ON_THE_WAY')]),
    facts('w5', 'OPEN', KB('DRAFT', 'SUBMITTED')),
    facts('w6', 'OPEN', KB('SUBMITTED', 'DRAFT')),
  ];
  beforeEach(() => mocks.list['listFacts']!.mockResolvedValue(live));

  it('approvers wait on To approve: the Branch Manager and the Director', async () => {
    expect((await requisitionsListService.list(branchManager, query())).waitingForYou).toBe(2);
    expect((await requisitionsListService.list(director, query())).waitingForYou).toBe(2);
    expect(await requisitionsListService.badges(branchManager)).toEqual({ requisitions: 2, toApprove: 2 });
    expect(await requisitionsListService.badges(director)).toEqual({ requisitions: 2, toApprove: 2 });
  });

  it('the store waits on To pack: the Store Manager and the Attendant', async () => {
    expect((await requisitionsListService.list(storeManager, query())).waitingForYou).toBe(1);
    expect(await requisitionsListService.badges(storeManager)).toEqual({ requisitions: 1, toPack: 1 });
    expect(await requisitionsListService.badges(attendant)).toEqual({ requisitions: 1, toPack: 1 });
  });

  it('a head waits on their own unsent list while the requisition collects', async () => {
    expect((await requisitionsListService.list(kitchen, query())).waitingForYou).toBe(1); // w5: Kitchen is a Draft; w6 Kitchen already sent
    expect(await requisitionsListService.badges(kitchen)).toEqual({ requisitions: 1 });
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ siteId: SITE }, { statuses: ['OPEN', 'PENDING_APPROVAL', 'APPROVED'], headDepartmentId: KITCHEN });
  });

  it('the Accountant reads but is waited for by nothing', async () => {
    expect((await requisitionsListService.list(accountant, query())).waitingForYou).toBe(0);
    expect(await requisitionsListService.badges(accountant)).toEqual({ requisitions: 0 });
  });

  it('the badge count looks at live requisitions only, scoped to the caller\'s branch (siteId on the query)', async () => {
    await requisitionsListService.badges(branchManager);
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ siteId: SITE }, { statuses: ['OPEN', 'PENDING_APPROVAL', 'APPROVED'] });
    await requisitionsListService.badges(storeManager);
    expect(mocks.list['listFacts']).toHaveBeenLastCalledWith({ anyBranch: true }, { statuses: ['OPEN', 'PENDING_APPROVAL', 'APPROVED'] });
  });

  it('someone with no requisitions role at all is refused', async () => {
    await expect(requisitionsListService.badges(member)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('R4 activity and R5 documents', () => {
  const event = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
    id, type, at: new Date('2026-10-08T07:00:00Z'), sectionId: null, lineId: null, fromValue: null, toValue: null, reason: null, actorRoleLabel: 'Branch Manager',
    actor: { id: 'mgr-1', name: 'Mary Njeri' }, ...extra,
  });

  beforeEach(() => {
    mocks.repo['findFile']!.mockImplementation(async () => readyRequisition());
    mocks.list['findLineLabels']!.mockResolvedValue(new Map([['l1', { itemName: 'Milk', unit: 'L' }]]));
  });

  it('turns events into sentences with the record link on the ones that name the requisition', async () => {
    mocks.list['listEvents']!.mockResolvedValue([
      event('e1', 'STARTED', { toValue: 'AFTERNOON' }),
      event('e2', 'SENT', { sectionId: 'sec-k', actorRoleLabel: 'Chef' }),
      event('e3', 'QUANTITY_CHANGED', { sectionId: 'sec-k', lineId: 'l1', fromValue: '30', toValue: '24', reason: 'Short in store' }),
      event('e4', 'APPROVED', { fromValue: '3', toValue: 'BRANCH_MANAGER' }),
    ]);
    const result = await requisitionsListService.activity(branchManager, 'req-1');
    expect(result.events.map((e) => e.sentence)).toEqual([
      'Started REQ-NYR-0112 · Afternoon',
      "Sent Kitchen's list · signed with PIN",
      'Changed Milk in Kitchen from 30 L to 24 L · Short in store',
      'Approved REQ-NYR-0112 · 3 lines · signed with PIN',
    ]);
    expect(result.events[0]?.link).toEqual({ kind: 'REQUISITION', id: 'req-1', reference: 'REQ-NYR-0112' });
    expect(result.events[1]?.link).toBeNull();
    expect(result.events[1]?.actor).toMatchObject({ name: 'Mary Njeri', roleLabel: 'Chef', initials: 'MN' });
    expect(result.events[1]?.departmentId).toBe(KITCHEN);
    expect(activitySchema.safeParse(withUuids(result)).error?.issues ?? []).toEqual([]);
  });

  it('a head does not read another department\'s events; whole-requisition events stay', async () => {
    mocks.list['listEvents']!.mockResolvedValue([event('e1', 'SENT', { sectionId: 'sec-b' }), event('e2', 'SENT', { sectionId: 'sec-k' }), event('e3', 'URGENT_SET')]);
    const result = await requisitionsListService.activity(kitchen, 'req-1');
    expect(result.events.map((e) => e.id)).toEqual(['e2', 'e3']);
  });

  it('an event type the contract does not know is left out rather than breaking the tab', async () => {
    mocks.list['listEvents']!.mockResolvedValue([event('e1', 'SOMETHING_NEW'), event('e2', 'NUDGED', { sectionId: 'sec-k' })]);
    expect((await requisitionsListService.activity(branchManager, 'req-1')).events.map((e) => e.id)).toEqual(['e2']);
  });

  it('the events are read for the requisition\'s own branch only', async () => {
    mocks.list['listEvents']!.mockResolvedValue([]);
    await requisitionsListService.activity(branchManager, 'req-1');
    expect(mocks.list['listEvents']).toHaveBeenCalledWith('req-1', SITE);
  });

  it('documents: one at approval, one after each approved addition, a pending addition makes none', async () => {
    const rec = makeRequisition('APPROVED', readyRequisition().sections, {
      approvedAt: new Date('2026-10-08T08:00:00Z'),
      approvedBy: manager,
      additions: [
        { ...makeAddition('add-1', KITCHEN, 'APPROVED'), approvedAt: new Date('2026-10-08T09:00:00Z'), approvedBy: manager },
        makeAddition('add-2', KITCHEN, 'PENDING'),
      ],
    });
    rec.sections[0]?.lines.push(makeLine('l-add', 'i7', 'Salt', 2, { additionId: 'add-1' }), makeLine('l-add2', 'i8', 'Pepper', 2, { additionId: 'add-1' }));
    mocks.repo['findFile']!.mockResolvedValue(rec);
    const result = await requisitionsListService.documents(branchManager, 'req-1');
    expect(result.documents.map((d) => [d.version, d.label])).toEqual([[1, 'Requisition · approved'], [2, 'Requisition · with 2 added lines']]);
    expect(documentsSchema.safeParse(withUuids(result)).error?.issues ?? []).toEqual([]);
  });

  it('documents: none before approval', async () => {
    expect((await requisitionsListService.documents(branchManager, 'req-1')).documents).toEqual([]);
  });
});

describe('R7 home and R9 history (a head)', () => {
  const NOW = new Date('2026-10-08T12:00:00Z'); // 15:00 Nairobi: Afternoon
  const NOW_MORNING = new Date('2026-10-08T05:00:00Z'); // 08:00 Nairobi

  beforeEach(() => {
    mocks.repo['findDepartment']!.mockResolvedValue({ id: KITCHEN, name: 'Kitchen' });
    mocks.repo['findDepartmentLocation']!.mockResolvedValue({ id: 'loc-k' });
    mocks.repo['listTaggedItems']!.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]);
    mocks.repo['readStock']!.mockResolvedValue({
      level: new Map([['i1', new Prisma.Decimal(36)], ['i2', new Prisma.Decimal(10)]]),
      onHand: new Map([['i1', new Prisma.Decimal(9)], ['i2', new Prisma.Decimal(10)]]),
    });
  });

  it('suggests Morning before noon Nairobi time and Afternoon after; the count is the items below their restock level', async () => {
    mocks.list['listTodayForDepartment']!.mockResolvedValue([]);
    const afternoon = await requisitionsListService.home(kitchen, NOW);
    expect(afternoon).toMatchObject({ suggestedCycle: 'AFTERNOON', suggestedLineCount: 1, open: null, earlierToday: [], department: { id: KITCHEN, name: 'Kitchen' } });
    expect(afternoon.openByCycle).toEqual({ MORNING: null, AFTERNOON: null, EXTRA: null });
    expect((await requisitionsListService.home(kitchen, NOW_MORNING)).suggestedCycle).toBe('MORNING');
    expect(homeSchema.safeParse(withUuids(afternoon)).error?.issues ?? []).toEqual([]);
  });

  it('shows today\'s requisition for the suggested cycle as open, the others as earlier today, and a cancelled one holds nothing', async () => {
    const morning = { ...makeRequisition('APPROVED', readyRequisition().sections, { type: 'MORNING', id: 'req-m', reference: 'REQ-NYR-0100' }) };
    const afternoon = { ...makeRequisition('OPEN', [makeSection('sec-k', KITCHEN, 'Kitchen', 'DRAFT', [makeLine('l1', 'i1', 'Milk', 3)])], { type: 'AFTERNOON', id: 'req-a', reference: 'REQ-NYR-0101' }) };
    const cancelled = { ...makeRequisition('CANCELLED', readyRequisition().sections, { type: 'EXTRA', id: 'req-x', reference: 'REQ-NYR-0102' }) };
    mocks.list['listTodayForDepartment']!.mockResolvedValue([cancelled, afternoon, morning]);
    const home = await requisitionsListService.home(kitchen, NOW);
    expect(home.open).toMatchObject({ requisitionId: 'req-a', status: 'OPEN', section: { status: 'DRAFT' }, can: { edit: true } });
    expect(home.openByCycle).toEqual({ MORNING: { requisitionId: 'req-m', status: 'APPROVED' }, AFTERNOON: { requisitionId: 'req-a', status: 'OPEN' }, EXTRA: null });
    expect(home.earlierToday.map((r) => r.requisitionId)).toEqual(['req-m']);
    expect(home.earlierToday[0]).toMatchObject({ sectionStatus: 'SUBMITTED', lineCount: 2, sentAt: '2026-10-08T07:00:00.000Z' });
    expect(homeSchema.safeParse(withUuids(home)).error?.issues ?? []).toEqual([]);
  });

  it('only a department head has a home or a history', async () => {
    await expect(requisitionsListService.home(branchManager)).rejects.toMatchObject({ statusCode: 403 });
    await expect(requisitionsListService.history(branchManager, { page: 1, pageSize: 50 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('history: the head\'s department only, no money, with the moments, paged', async () => {
    mocks.list['listFacts']!.mockResolvedValue(Array.from({ length: 60 }, (_, i) => facts(`h${String(i).padStart(2, '0')}`, 'APPROVED', KB('SUBMITTED', 'SUBMITTED'))));
    const result = await requisitionsListService.history(kitchen, { page: 2, pageSize: 25, from: '2026-10-01', status: 'APPROVED' });
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ siteId: SITE }, { headDepartmentId: KITCHEN, fromAt: new Date('2026-09-30T21:00:00.000Z'), status: 'APPROVED' });
    expect((mocks.list['findFiles']!.mock.calls[0]?.[1] as string[])[0]).toBe('h25');
    expect(result.page).toEqual({ page: 2, pageSize: 25, total: 60 });
    expect(JSON.stringify(result)).not.toMatch(/value|cost|price|kes/i);
    expect(result.rows[0]).toMatchObject({ sectionStatus: 'SUBMITTED', lineCount: 2, sentAt: '2026-10-08T07:00:00.000Z', allInAt: '2026-10-08T07:00:00.000Z' });
    expect(historyMineSchema.safeParse(withUuids(result)).error?.issues ?? []).toEqual([]);
  });

  it('history of a head never reads another branch', async () => {
    mocks.list['listFacts']!.mockResolvedValue([]);
    await requisitionsListService.history(kitchen, { page: 1, pageSize: 50 });
    expect(mocks.list['listFacts']).toHaveBeenCalledWith({ siteId: SITE }, { headDepartmentId: KITCHEN });
    void kitchenHead;
  });
});
