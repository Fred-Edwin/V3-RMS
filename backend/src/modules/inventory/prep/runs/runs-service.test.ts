import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { prepRunRepository, type PrepRunRow } from '../_shared/prep-run-repository';
import { serializeRunDetail } from '../_shared/prep-run-serializer';
import recordRouter from '../record/record-routes';
import runsRouter from './runs-routes';
import { runsService } from './runs-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../_shared/prep-run-repository', () => ({ prepRunRepository: { list: vi.fn(), findById: vi.fn() } }));
vi.mock('../record/record-service', () => ({ recordService: {} }));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const HUB = 'hub-1';
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const otherAttendant = { id: 'att2', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const manager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;

const row = (over: Partial<PrepRunRow> = {}): PrepRunRow =>
  ({
    id: 'run-1', siteId: HUB, reference: 'PREP-0007', outputItemId: 'o', actualYield: D(30), outputUnitCost: D(121), totalInputCost: D(3630),
    yieldVarianceLabel: 'low yield', notifiedStoreManager: false, locationId: 'l', createdById: 'att', createdAt: new Date('2026-10-07T05:00:00Z'),
    status: 'RECORDED', replacesRunId: null, closedAt: null, closedById: null, correctionReason: null, cancelReason: null, reasonNote: null, yieldReason: null,
    expectedYield: D(38), expectedSource: 'RECIPE', recipeVersionId: 'v', stockFlag: true, needsLook: true, reviewedAt: null, reviewedById: null, idempotencyKey: 'k',
    outputItem: { id: 'o', name: 'Marinated chicken', usageUnit: 'portions' },
    createdBy: { id: 'att', name: 'Sarah Achieng', role: 'STORE_ATTENDANT' },
    closedBy: null, reviewedBy: null, replacesRun: null, replacedByRun: null, recipeVersion: { version: 1 },
    inputLines: [{ id: 'i', prepRunId: 'run-1', inputItemId: 'c', quantity: D(10), unitCostAtRunTime: D(430), lineCost: D(4300), lineOrder: 0, onHandAtRunTime: D(4), inputItem: { id: 'c', name: 'chicken', usageUnit: 'kg' } }],
    ...over,
  }) as PrepRunRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(prepRunRepository.list).mockResolvedValue({ items: [row()], total: 1 });
  vi.mocked(prepRunRepository.findById).mockResolvedValue(row());
});

describe('list (#8)', () => {
  it('gives the manager costs and flags and the Attendant neither', async () => {
    const m = await runsService.list(manager, { page: 1, perPage: 25 });
    expect(m.items[0]).toMatchObject({ reference: 'PREP-0007', outputUnitCost: '121', needsLook: true, mine: false, by: { initials: 'SA', roleLabel: 'Store Attendant' } });
    expect(m.items[0]?.vsUsual).toMatchObject({ label: 'LOW', text: '−8 portions · low yield' });
    expect(m.items[0]?.inputsPreview).toEqual({ firstLabel: '10 kg chicken', moreCount: 0 });

    const a = await runsService.list(attendant, { page: 1, perPage: 25 });
    expect(a.items[0]).toMatchObject({ mine: true });
    expect(JSON.stringify(a)).not.toMatch(/needsLook|reviewedBy|reviewedAt|outputUnitCost/);
  });

  it('honours needsLook only for a caller who may read flags', async () => {
    await runsService.list(attendant, { page: 1, perPage: 25, needsLook: true });
    expect(vi.mocked(prepRunRepository.list).mock.calls[0]![1].needsLook).toBeUndefined();
    await runsService.list(manager, { page: 1, perPage: 25, needsLook: true });
    expect(vi.mocked(prepRunRepository.list).mock.calls[1]![1].needsLook).toBe(true);
  });

  it('reads the date filters as Nairobi days and "mine" as the caller', async () => {
    await runsService.list(attendant, { page: 2, perPage: 10, from: '2026-10-07', to: '2026-10-07', mine: true });
    const f = vi.mocked(prepRunRepository.list).mock.calls[0]![1];
    expect(f.from?.toISOString()).toBe('2026-10-06T21:00:00.000Z');
    expect(f.to?.toISOString()).toBe('2026-10-07T21:00:00.000Z');
    expect(f.mineUserId).toBe('att');
    expect(vi.mocked(prepRunRepository.list).mock.calls[0]![0]).toBe(HUB);
  });
});

describe('get (#10)', () => {
  it('404s an unknown run', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(null);
    await expect(runsService.get(manager, 'x')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('never leaks the silent flag, stock or costs to an Attendant, and shows them to a manager', async () => {
    const a = await runsService.get(attendant, 'run-1');
    expect(JSON.stringify(a)).not.toMatch(/stockFlag|exceedsStock|stockExceeded|exceedsText|needsLook|flags|onHand|unitCost|lineCost|totalInputCost/);
    const m = await runsService.get(manager, 'run-1');
    expect(m.flags).toMatchObject({ yield: 'LOW', stockExceeded: true });
    expect(m.inputs[0]).toMatchObject({ onHand: '4', exceedsStock: true, lineCost: '4300' });
    expect(m.expected.text).toBe('about 38 portions');
    expect(m.timeline[0]?.text).toBe('Recorded as PREP-0007 · Sarah Achieng');
  });

  it('the Accountant reads flags and costs but can do nothing', async () => {
    const r = await runsService.get(accountant, 'run-1');
    expect(r.flags).toBeDefined();
    expect(r.can).toEqual({ correct: false, cancel: false, review: false, lockedReason: null });
  });
});

describe('what the caller can do (24-hour rule)', () => {
  const created = new Date('2026-10-07T05:00:00Z');
  const at = (hours: number) => new Date(created.getTime() + hours * 3600_000);

  it('the Attendant may fix their own run for 24 hours, with the window end shown', () => {
    const d = serializeRunDetail(row({ createdAt: created }), { id: 'att', role: 'STORE_ATTENDANT' }, at(3));
    expect(d.can).toMatchObject({ correct: true, cancel: true, review: false, lockedReason: null });
    expect(d.windowEndsAt).toBe(at(24).toISOString());
  });

  it('after 24 hours the run is locked: "Ask the Store Manager"', () => {
    const d = serializeRunDetail(row({ createdAt: created }), { id: 'att', role: 'STORE_ATTENDANT' }, at(25));
    expect(d.can).toMatchObject({ correct: false, cancel: false, lockedReason: 'Ask the Store Manager' });
    expect(d.windowEndsAt).toBeNull();
  });

  it('someone else’s run is read-only for an Attendant', () => {
    const d = serializeRunDetail(row({ createdAt: created }), { id: 'att2', role: 'STORE_ATTENDANT' }, at(1));
    expect(d.can).toEqual({ correct: false, cancel: false, review: false, lockedReason: null });
    expect(otherAttendant).toBeDefined();
  });

  it('the Store Manager may fix and review any run at any age', () => {
    const d = serializeRunDetail(row({ createdAt: created }), { id: 'sm', role: 'STORE_MANAGER' }, at(500));
    expect(d.can).toEqual({ correct: true, cancel: true, review: true, lockedReason: null });
  });

  it('a cancelled run can be fixed by nobody', () => {
    const d = serializeRunDetail(row({ status: 'CANCELLED', createdAt: created }), { id: 'sm', role: 'STORE_MANAGER' }, at(1));
    expect(d.can).toMatchObject({ correct: false, cancel: false, review: false });
  });
});

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } };
const ROLES = ['SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'STORE_MANAGER', 'STORE_ATTENDANT', 'DEPARTMENT_HEAD'];
const allowedRoles = (router: unknown, method: string, path: string): string[] => {
  const layer = ((router as { stack: unknown[] }).stack as Layer[]).find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`route not found: ${method} ${path}`);
  const guard = layer.route.stack[0]!.handle;
  return ROLES.filter((role) => {
    const next = vi.fn() as unknown as NextFunction;
    try {
      guard({ user: { id: 'u', role, siteId: HUB } } as Request, {} as Response, next);
    } catch {
      return false;
    }
    return vi.mocked(next).mock.calls.length === 1;
  }).sort();
};

describe('route capability gates (the prep-access grid)', () => {
  const READERS = ['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_ATTENDANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'];
  const RECORDERS = ['STORE_ATTENDANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'];
  it('reads (#8, #10) need prep.read', () => {
    expect(allowedRoles(runsRouter, 'get', '/inventory/prep/runs')).toEqual(READERS);
    expect(allowedRoles(runsRouter, 'get', '/inventory/prep/runs/:id')).toEqual(READERS);
  });
  it('record routes (#4–#7) need prep.record', () => {
    expect(allowedRoles(recordRouter, 'get', '/inventory/prep/outputs')).toEqual(RECORDERS);
    expect(allowedRoles(recordRouter, 'get', '/inventory/prep/prep-again')).toEqual(RECORDERS);
    expect(allowedRoles(recordRouter, 'post', '/inventory/prep/runs/check')).toEqual(RECORDERS);
    expect(allowedRoles(recordRouter, 'post', '/inventory/prep/runs')).toEqual(RECORDERS);
  });
});
