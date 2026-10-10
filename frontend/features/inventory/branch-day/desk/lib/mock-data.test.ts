import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../_shared/hooks/use-permissions', () => ({
  usePermissionsStore: { getState: () => ({ capabilities: ['catalog.see_costs', 'branch_day.read', 'branch_day.close', 'branch_day.count_on_behalf'] }) },
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ user: { role: 'MANAGER' } }) } }));

import { MOCK_PIN, mockBranchDay, resetMockWorld } from './mock-data';

describe('Branch day desktop fixtures (Paper numbers)', () => {
  beforeEach(() => resetMockWorld('blocked'));

  it('balances every department to the figure Paper draws, so the branch total is 50,060', async () => {
    const today = await mockBranchDay.today({});
    const tiles = today.day?.departments ?? [];
    const used = Object.fromEntries(tiles.map((t) => [t.name, t.usedValueKes]));
    expect(used).toMatchObject({ Kitchen: '24380.00', Barista: '11940.00', Pastry: '8760.00', Service: '3120.00' });
    expect(used.Housekeeping).toBeNull();
    const summary = await mockBranchDay.closeSummary();
    expect(summary.usedValueKes).toBe('50060.00');
    expect(summary.departments.reduce((n, d) => n + d.itemCount, 0)).toBe(43);
  });

  it('puts Paper\'s Pastry rows and totals on step 6', async () => {
    resetMockWorld('ready');
    const f = await mockBranchDay.figures('x', '30000000-0000-4000-8000-000000000003');
    expect(f.department.lines).toHaveLength(8);
    expect(f.department.totals).toEqual({ usedValueKes: '8760.00', closingValueKes: '15840.00' });
    const flour = f.department.lines[0];
    expect(flour).toMatchObject({ itemName: 'Flour 25kg', openingQty: '4', closingQty: '1', usedQty: '3', yesterdayUsedQty: '1', usedValueKes: '6000.00', closingValueKes: '2000.00' });
    expect(f.branchUsedValueKes).toBe('50060.00');
  });

  it('blocks the close until Housekeeping counts, in the order Paper draws', async () => {
    const today = await mockBranchDay.today({});
    expect(today.day?.blockers.map((b) => b.kind)).toEqual(['DELIVERIES_CONFIRMED', 'DEPARTMENT_NOT_COUNTED', 'OPENING_NOT_CHECKED']);
    expect(today.day?.summary).toEqual({ todo: 1, toKnow: 1 });
    expect(today.day?.canClose).toBe(false);
    await expect(mockBranchDay.close('x', { pin: MOCK_PIN, idempotencyKey: 'k1' })).rejects.toMatchObject({ code: 'DAY_NOT_READY' });
  });

  it('counts for a department blind, refuses a wrong PIN, then closes once and replays', async () => {
    const id = '30000000-0000-4000-8000-000000000005';
    const view = await mockBranchDay.count(id);
    expect(view.lines.every((l) => l.countedQty === null)).toBe(true);
    for (const l of view.lines) await mockBranchDay.saveCount(id, { lines: [{ itemId: l.itemId, countedQty: '5' }] });
    await expect(mockBranchDay.signCount(id, { pin: '0000', idempotencyKey: 'a' })).rejects.toMatchObject({ code: 'INVALID_PIN' });
    const signed = await mockBranchDay.signCount(id, { pin: MOCK_PIN, idempotencyKey: 'b' });
    expect(signed.onBehalf).toBe(true);
    await expect(mockBranchDay.signCount(id, { pin: MOCK_PIN, idempotencyKey: 'c' })).rejects.toMatchObject({ code: 'ALREADY_COUNTED' });

    await expect(mockBranchDay.close('x', { pin: '0000', idempotencyKey: 'd' })).rejects.toMatchObject({ code: 'INVALID_PIN' });
    const closed = await mockBranchDay.close('x', { pin: MOCK_PIN, idempotencyKey: 'e' });
    expect(closed.day.status).toBe('CLOSED');
    expect(closed.entries).toHaveLength(5);
    expect(closed.entries.every((e) => e.reference === 'DAY-NYR-0044')).toBe(true);
    const again = await mockBranchDay.close('x', { pin: MOCK_PIN, idempotencyKey: 'e' });
    expect(again.replayed).toBe(true);
    await expect(mockBranchDay.close('x', { pin: MOCK_PIN, idempotencyKey: 'other' })).rejects.toMatchObject({ code: 'DAY_ALREADY_CLOSED' });
  });

  it('writes no usage entry for an item that used nothing', async () => {
    resetMockWorld('ready');
    const closed = await mockBranchDay.close('x', { pin: MOCK_PIN, idempotencyKey: 'z' });
    // 43 items, four of which used nothing (Baking powder, Vanilla essence, Dish soap, Hand towels) plus three at Service: 36 entries.
    expect(closed.entryCount).toBeLessThan(43);
    expect(closed.entryCount).toBe(36);
  });
});
