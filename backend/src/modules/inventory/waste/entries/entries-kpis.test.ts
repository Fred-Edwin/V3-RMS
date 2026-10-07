import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { WasteLogRow } from '../_shared/waste-row';
import { buildWasteKpis } from './entries-kpis';

const TODAY = new Date('2026-10-12T21:00:00Z'); // 13 Oct 00:00 Nairobi

const person = (id: string, name: string, role: string) => ({ id, name, role });
const peter = person('u-peter', 'Peter Kariuki', 'STORE_ATTENDANT');
const sam = person('u-sam', 'Sam Mwangi', 'STORE_MANAGER');

const log = (n: number, item: string, qty: number, cost: number, over: Record<string, unknown> = {}) =>
  ({
    id: `log-${n}`,
    inventoryItemId: `item-${item}`,
    quantity: new Prisma.Decimal(qty),
    unitCost: new Prisma.Decimal(cost),
    reason: 'EXPIRY',
    createdAt: new Date('2026-10-13T08:00:00Z'),
    reversedAt: null,
    reversedBy: null,
    inventoryItem: { id: `item-${item}`, name: item, usageUnit: 'kg' },
    loggedBy: peter,
    ...over,
  }) as unknown as WasteLogRow;

const kpi = (cells: ReturnType<typeof buildWasteKpis>, key: string) => cells.find((c) => c.key === key)!;

describe('buildWasteKpis', () => {
  const earlier = new Date('2026-10-10T08:00:00Z');
  const last7 = [
    log(1, 'Chicken', 3, 420), // today: 1,260
    log(2, 'Milk', 6, 95, { reason: 'SPOILAGE' }), // today: 570
    log(3, 'Chicken', 2, 420, { createdAt: earlier }), // earlier: 840
    log(4, 'Chicken', 1, 420, { createdAt: earlier, reason: 'SPOILAGE' }), // 420
    log(5, 'Milk', 6, 95, { reversedAt: new Date('2026-10-13T08:10:00Z'), reversedBy: peter }), // reversed: counts for nothing
  ];
  const reversedLast7 = [last7[4]!];

  it('counts today and the 7 days from the entries still standing', () => {
    const cells = buildWasteKpis({ last7, reversedLast7, todayStart: TODAY });
    expect(kpi(cells, 'today')).toMatchObject({ value: '1,830', caption: 'KES · 2 entries', tone: 'NEUTRAL' });
    expect(kpi(cells, 'last7')).toMatchObject({ value: '3,090', caption: 'KES · 4 entries' });
  });

  it('names the item with the most value and its commonest reason', () => {
    const most = kpi(buildWasteKpis({ last7, reversedLast7, todayStart: TODAY }), 'most');
    expect(most).toMatchObject({ value: 'Chicken', caption: 'KES 2,520 · mostly expired', tone: 'WARN' });
  });

  it('builds the reversed text from who reversed and when', () => {
    const one = kpi(buildWasteKpis({ last7, reversedLast7, todayStart: TODAY }), 'reversed');
    expect(one).toMatchObject({ value: '1', caption: 'By the Attendant, same day' });

    const two = [last7[4]!, { ...last7[4]!, id: 'log-6' }];
    expect(kpi(buildWasteKpis({ last7, reversedLast7: two, todayStart: TODAY }), 'reversed').caption).toBe('Both by the Attendant, same day');

    const mixed = [last7[4]!, { ...last7[4]!, id: 'log-7', reversedBy: sam as never, reversedAt: new Date('2026-10-14T08:00:00Z') }];
    expect(kpi(buildWasteKpis({ last7, reversedLast7: mixed, todayStart: TODAY }), 'reversed').caption).toBe('Both by the Attendant and the Store Manager');
  });

  it('is quiet when nothing was wasted or reversed', () => {
    const cells = buildWasteKpis({ last7: [], reversedLast7: [], todayStart: TODAY });
    expect(kpi(cells, 'today')).toMatchObject({ value: '0', caption: 'KES · 0 entries' });
    expect(kpi(cells, 'most')).toMatchObject({ value: '—', tone: 'NEUTRAL' });
    expect(kpi(cells, 'reversed')).toMatchObject({ value: '0', caption: 'Nothing reversed' });
  });
});
