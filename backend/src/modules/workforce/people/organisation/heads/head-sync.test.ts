import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { toDateColumn, type NairobiDate } from '../../../_shared/time/nairobi-time';

const repo = vi.hoisted(() => ({
  rowsOfUser: vi.fn(),
  readClaims: vi.fn(),
  removeRow: vi.fn(),
  endRow: vi.fn(),
  endActingRow: vi.fn(),
  activeRowsOfEmployee: vi.fn(),
}));
const gateway = vi.hoisted(() => ({ setHeadClaims: vi.fn() }));
vi.mock('./heads-repository', () => ({ headsRepository: repo }));
vi.mock('../../people-account-gateway', () => ({ accountGateway: gateway }));

import { claimsOf, endAllHeadRows, endRowToday, headChangedEvent, syncHeadClaims } from './head-sync';

const tx = {} as Prisma.TransactionClient;
const day = (d: string) => d as NairobiDate;
const today = day('2026-10-20');
const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  departmentId: 'd1',
  employeeId: 'e1',
  isActing: false,
  startsOn: toDateColumn(day('2026-10-01')),
  endsOn: null,
  department: { siteId: 's1', key: 'KITCHEN', name: 'Kitchen' },
  employee: { id: 'e1', name: 'Ann', userId: 'u1' },
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('claimsOf', () => {
  it('names the department the tag came from', () => {
    expect(claimsOf([row() as never], today)).toEqual({ isDepartmentHead: true, departmentTag: 'KITCHEN', departmentId: 'd1' });
  });
  it('an untagged department gives no claim', () => {
    expect(claimsOf([row({ department: { siteId: 's1', key: null, name: 'Bakery' } }) as never], today)).toEqual({ isDepartmentHead: false, departmentTag: null, departmentId: null });
  });
  it('an acting head whose cover has ended gives no claim', () => {
    expect(claimsOf([row({ isActing: true, endsOn: toDateColumn(day('2026-10-19')) }) as never], today).isDepartmentHead).toBe(false);
  });
});

describe('syncHeadClaims', () => {
  it('writes when the claim differs and not when it is already right', async () => {
    repo.rowsOfUser.mockResolvedValue([row()]);
    repo.readClaims.mockResolvedValue({ isDepartmentHead: false, departmentTag: null, departmentId: null });
    expect(await syncHeadClaims(tx, 'c1', 'u1', today)).toBe(true);
    expect(gateway.setHeadClaims).toHaveBeenCalledWith(tx, 'u1', { isDepartmentHead: true, departmentTag: 'KITCHEN', departmentId: 'd1' });

    gateway.setHeadClaims.mockClear();
    repo.readClaims.mockResolvedValue({ isDepartmentHead: true, departmentTag: 'KITCHEN', departmentId: 'd1' });
    expect(await syncHeadClaims(tx, 'c1', 'u1', today)).toBe(false); // idempotent
    expect(gateway.setHeadClaims).not.toHaveBeenCalled();
  });

  it('clears the claim but leaves the legacy department alone', async () => {
    repo.rowsOfUser.mockResolvedValue([]);
    repo.readClaims.mockResolvedValue({ isDepartmentHead: true, departmentTag: 'KITCHEN', departmentId: 'd1' });
    await syncHeadClaims(tx, 'c1', 'u1', today);
    expect(gateway.setHeadClaims).toHaveBeenCalledWith(tx, 'u1', { isDepartmentHead: false, departmentTag: null, departmentId: undefined });
  });

  it('does nothing for a login that does not exist', async () => {
    repo.rowsOfUser.mockResolvedValue([]);
    repo.readClaims.mockResolvedValue(null);
    expect(await syncHeadClaims(tx, 'c1', 'gone', today)).toBe(false);
  });
});

describe('ending a row', () => {
  it('a row that started today is removed', async () => {
    await endRowToday(tx, row({ startsOn: toDateColumn(today) }) as never, today, 'a1', 'REPLACED');
    expect(repo.removeRow).toHaveBeenCalled();
    expect(repo.endRow).not.toHaveBeenCalled();
  });
  it('an older row gets yesterday as its last day', async () => {
    await endRowToday(tx, row() as never, today, 'a1', 'REPLACED');
    expect(repo.endRow).toHaveBeenCalledWith(tx, 'r1', toDateColumn(day('2026-10-19')), 'a1', 'REPLACED');
  });
  it('an acting row with an end date is only moved earlier', async () => {
    await endRowToday(tx, row({ isActing: true, endsOn: toDateColumn(day('2026-10-25')) }) as never, today, 'a1', 'REPLACED');
    expect(repo.endActingRow).toHaveBeenCalled();
    expect(repo.endRow).not.toHaveBeenCalled();
  });
});

describe('endAllHeadRows (exit and transfer)', () => {
  it('ends every row, syncs the claim and returns one event per row', async () => {
    repo.activeRowsOfEmployee.mockResolvedValue([row()]);
    repo.rowsOfUser.mockResolvedValue([]);
    repo.readClaims.mockResolvedValue({ isDepartmentHead: true, departmentTag: 'KITCHEN', departmentId: 'd1' });
    const result = await endAllHeadRows(tx, { id: 'e1', userId: 'u1', companyId: 'c1' }, today, 'a1', 'EXIT', new Date('2026-10-20T06:00:00Z'));
    expect(result.rows).toHaveLength(1);
    expect(result.events).toEqual([
      expect.objectContaining({ name: 'department.head_changed', payload: { siteId: 's1', departmentId: 'd1', departmentTag: 'KITCHEN', previousHeadUserId: 'u1', newHeadUserId: null, effectiveOn: today } }),
    ]);
    expect(gateway.setHeadClaims).toHaveBeenCalled();
  });
  it('a person with no head rows changes nothing', async () => {
    repo.activeRowsOfEmployee.mockResolvedValue([]);
    repo.rowsOfUser.mockResolvedValue([]);
    repo.readClaims.mockResolvedValue({ isDepartmentHead: false, departmentTag: null, departmentId: null });
    const result = await endAllHeadRows(tx, { id: 'e1', userId: 'u1', companyId: 'c1' }, today, null, 'EXIT', new Date());
    expect(result.events).toEqual([]);
    expect(gateway.setHeadClaims).not.toHaveBeenCalled();
  });
});

describe('headChangedEvent', () => {
  it('carries exactly the contract payload', () => {
    const event = headChangedEvent({ id: 'd1', siteId: 's1', key: 'SERVICE' }, { previousUserId: 'a', newUserId: 'b', effectiveOn: today }, new Date('2026-10-20T06:00:00Z'));
    expect(event).toEqual({ name: 'department.head_changed', occurredAt: '2026-10-20T06:00:00.000Z', payload: { siteId: 's1', departmentId: 'd1', departmentTag: 'SERVICE', previousHeadUserId: 'a', newHeadUserId: 'b', effectiveOn: today } });
  });
});
