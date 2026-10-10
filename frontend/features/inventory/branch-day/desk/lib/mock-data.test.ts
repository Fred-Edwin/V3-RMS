import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../_shared/hooks/use-permissions', () => ({
  usePermissionsStore: { getState: () => ({ capabilities: ['catalog.see_costs', 'branch_day.read', 'branch_day.close', 'branch_day.count_on_behalf', 'branch_day.correct'] }) },
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

  it('corrects one count: both figures kept, the totals follow, a new sheet version, an Activity row', async () => {
    resetMockWorld('closed');
    const pastry = '30000000-0000-4000-8000-000000000003';
    const flour = (await mockBranchDay.figures('70000000-0000-4000-8000-000000000044', pastry)).department.lines[0];
    expect(flour).toMatchObject({ itemName: 'Flour 25kg', closingQty: '1', usedQty: '3' });
    const input = { departmentId: pastry, itemId: flour?.itemId ?? '', closingQty: '2', reason: 'COUNTED_WRONGLY' as const, note: 'A bag was in the dry store.', pin: MOCK_PIN, idempotencyKey: 'c1' };

    await expect(mockBranchDay.correct('70000000-0000-4000-8000-000000000044', { ...input, pin: '0000' })).rejects.toMatchObject({ code: 'INVALID_PIN' });
    await expect(mockBranchDay.correct('70000000-0000-4000-8000-000000000044', { ...input, closingQty: '1' })).rejects.toMatchObject({ code: 'CORRECTION_NO_CHANGE' });
    const result = await mockBranchDay.correct('70000000-0000-4000-8000-000000000044', input);
    expect(result.usedValueKes).toBe('48060.00');
    expect(result.day.status).toBe('CORRECTED');
    expect(result.entry).toMatchObject({ kind: 'CORRECTION', quantity: '1', reference: 'DAY-NYR-0044' });
    expect(result.line.correction).toMatchObject({ fromClosingQty: '1', toClosingQty: '2', fromUsedQty: '3', toUsedQty: '2' });
    expect((await mockBranchDay.correct('70000000-0000-4000-8000-000000000044', input)).replayed).toBe(true);

    const docs = (await mockBranchDay.documents('70000000-0000-4000-8000-000000000044')).documents;
    expect(docs.map((d) => [d.version, d.kind, d.latest])).toEqual([[2, 'AFTER_CORRECTION', true], [1, 'AT_THE_CLOSE', false]]);
    const activity = await mockBranchDay.activity('70000000-0000-4000-8000-000000000044', 100);
    expect(activity.entries[0]).toMatchObject({ type: 'COUNT_CORRECTED', sentence: 'Corrected a count: Flour 25kg (Pastry), closing stock 1 → 2' });
    expect(activity.entries.map((e) => e.type)).toContain('DAY_CLOSED');
    expect(activity.total).toBe(activity.entries.length);

    // Version 1 prints as signed (no correction), version 2 includes it.
    const v1 = await mockBranchDay.sheet('70000000-0000-4000-8000-000000000044', 1);
    const v2 = await mockBranchDay.sheet('70000000-0000-4000-8000-000000000044', 2);
    expect(v1.corrections).toHaveLength(0);
    expect(v1.totals.usedValueKes).toBe('50060.00');
    expect(v2.corrections).toHaveLength(1);
    expect(v2.totals.usedValueKes).toBe('48060.00');
    expect(v2.departments[2]?.lines[0]?.correction).toMatchObject({ fromClosingQty: '1', toClosingQty: '2' });
    expect(v2.pageCount).toBe(6);
  });

  it('refuses a correction on an open day', async () => {
    await expect(mockBranchDay.correct('70000000-0000-4000-8000-000000000044', { departmentId: 'x', itemId: 'y', closingQty: '2', reason: 'OTHER', pin: MOCK_PIN, idempotencyKey: 'k' })).rejects.toMatchObject({ code: 'DAY_NOT_CLOSED' });
    await expect(mockBranchDay.sheet('70000000-0000-4000-8000-000000000044')).rejects.toMatchObject({ code: 'DAY_NOT_CLOSED' });
  });

  it('lists History newest first, filters by day number, status and range, and pages', async () => {
    const all = await mockBranchDay.history({ pageSize: 25 });
    expect(all.rows[0]?.reference).toBe('DAY-NYR-0044');
    expect(all.rows[0]?.status).toBe('OPEN');
    expect(all.rows.every((r) => r.branch.name === 'Nyeri Town')).toBe(true);
    const found = await mockBranchDay.history({ q: '0042', pageSize: 25 });
    expect(found.rows.map((r) => r.reference)).toEqual(['DAY-NYR-0042']);
    const closed = await mockBranchDay.history({ status: 'CLOSED', pageSize: 25 });
    expect(closed.rows.every((r) => r.status === 'CLOSED')).toBe(true);
    const paged = await mockBranchDay.history({ pageSize: 25, page: 2 });
    expect(paged.rows).toHaveLength(0);
    expect(paged.page.total).toBe(all.page.total);
  });

  it('writes no usage entry for an item that used nothing', async () => {
    resetMockWorld('ready');
    const closed = await mockBranchDay.close('x', { pin: MOCK_PIN, idempotencyKey: 'z' });
    // 43 items, four of which used nothing (Baking powder, Vanilla essence, Dish soap, Hand towels) plus three at Service: 36 entries.
    expect(closed.entryCount).toBeLessThan(43);
    expect(closed.entryCount).toBe(36);
  });
});
