import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../_shared/purchasing-notify', () => ({ purchasingNotices: { dueToday: vi.fn(), overdue: vi.fn() } }));
vi.mock('./attendant-repository', () => ({ attendantRepository: { findSentDueOn: vi.fn() } }));

import { createDueNotifier } from './due-notices';

const HUB = 'hub-1';
// 08:00 Nairobi on Thu 8 Oct 2026.
const EIGHT = new Date('2026-10-08T05:00:00Z');

const harness = (hub: string | null = HUB) => {
  const findSentDueOn = vi.fn(async (_siteId: string, day: Date) => {
    const iso = day.toISOString().slice(0, 10);
    if (iso === '2026-10-08') return [{ id: 'd1', reference: 'LPO-0044', supplierName: 'Samrat', itemCount: 4 }, { id: 'd2', reference: null, supplierName: 'Unnumbered', itemCount: 1 }];
    if (iso === '2026-10-07') return [{ id: 'v1', reference: 'LPO-0043', supplierName: 'Kagumo', itemCount: 1 }];
    return [];
  });
  const dueToday = vi.fn(async () => undefined);
  const overdue = vi.fn(async () => undefined);
  return { findSentDueOn, dueToday, overdue, run: createDueNotifier({ hubId: async () => hub, findSentDueOn, dueToday, overdue }) };
};

describe('the 08:00 job for deliveries due and late (map rows 24 and 25)', () => {
  it('tells about the orders expected today and the ones that were expected yesterday, once each', async () => {
    const h = harness();
    await expect(h.run(EIGHT)).resolves.toEqual({ dueToday: 2, overdue: 1 });
    expect(h.findSentDueOn).toHaveBeenCalledWith(HUB, new Date('2026-10-08T00:00:00Z'));
    expect(h.findSentDueOn).toHaveBeenCalledWith(HUB, new Date('2026-10-07T00:00:00Z'));
    expect(h.dueToday).toHaveBeenCalledTimes(1); // the order with no number was never sent properly: it is skipped
    expect(h.dueToday).toHaveBeenCalledWith({ hubId: HUB, orderId: 'd1', reference: 'LPO-0044', supplierName: 'Samrat', itemCount: 4 });
    expect(h.overdue).toHaveBeenCalledWith({ hubId: HUB, orderId: 'v1', reference: 'LPO-0043', supplierName: 'Kagumo', daysLate: 1 });
  });

  it('counts the day in Nairobi time: at 00:30 Nairobi on the 9th (21:30 UTC on the 8th) "today" is the 9th', async () => {
    const h = harness();
    await h.run(new Date('2026-10-08T21:30:00Z'));
    expect(h.findSentDueOn).toHaveBeenCalledWith(HUB, new Date('2026-10-09T00:00:00Z'));
    expect(h.findSentDueOn).toHaveBeenCalledWith(HUB, new Date('2026-10-08T00:00:00Z'));
  });

  it('does nothing when there is no hub', async () => {
    const h = harness(null);
    await expect(h.run(EIGHT)).resolves.toEqual({ dueToday: 0, overdue: 0 });
    expect(h.findSentDueOn).not.toHaveBeenCalled();
  });

  it('does nothing on a day when nothing is due', async () => {
    const h = harness();
    await expect(h.run(new Date('2026-10-20T05:00:00Z'))).resolves.toEqual({ dueToday: 0, overdue: 0 });
    expect(h.dueToday).not.toHaveBeenCalled();
    expect(h.overdue).not.toHaveBeenCalled();
  });
});
