import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { kpiCellSchema } from '../../_shared/wire';
import { buildBranchWasteKpis, reversedCaption, shortName, type KpiLog } from './branch-kpis';

const TODAY = new Date('2026-10-13T00:00:00Z');
const KITCHEN = { id: 'd-kitchen', name: 'Kitchen' };
const BARISTA = { id: 'd-barista', name: 'Barista' };

const log = (over: Partial<KpiLog> & { value?: number; dept?: { id: string; name: string } } = {}): KpiLog => {
  const { value, dept = KITCHEN, ...rest } = over;
  return {
    createdAt: new Date('2026-10-13T08:00:00Z'),
    reversedAt: null,
    quantity: new Prisma.Decimal(2),
    unitCost: new Prisma.Decimal(value ? value / 2 : 100),
    reason: 'EXPIRY',
    siteId: 'nyeri',
    inventoryItemId: 'beef',
    inventoryItem: { name: 'Beef stew' },
    location: { departmentId: dept.id, department: dept },
    reversedBy: null,
    ...rest,
  };
};

const reversal = (by: { id: string; name: string; departmentId: string | null }, dept = KITCHEN): KpiLog =>
  log({ dept, reversedAt: new Date('2026-10-13T09:00:00Z'), reversedBy: by });

describe('buildBranchWasteKpis', () => {
  it('builds the four cells, each a valid KpiCell, in the order Today, Last 7 days, Most wasted, Reversed', () => {
    const cells = buildBranchWasteKpis({ last7: [log()], reversedLast7: [], todayStart: TODAY, scope: 'ONE_BRANCH' });
    expect(cells.map((c) => c.key)).toEqual(['today', 'last7', 'most', 'reversed']);
    for (const cell of cells) expect(() => kpiCellSchema.parse(cell)).not.toThrow();
  });

  it('Today counts what stands since the Nairobi day began; Last 7 days counts every standing entry', () => {
    const cells = buildBranchWasteKpis({
      last7: [log({ value: 400 }), log({ value: 1000, createdAt: new Date('2026-10-10T08:00:00Z') })],
      reversedLast7: [],
      todayStart: TODAY,
      scope: 'ONE_BRANCH',
    });
    expect(cells[0]).toMatchObject({ value: '400', caption: 'KES · 1 entry' });
    expect(cells[1]).toMatchObject({ value: '1,400', caption: 'KES · 2 entries' });
  });

  it('a reversed entry counts for nothing in Today, Last 7 days and Most wasted', () => {
    const reversed = log({ value: 5000, reversedAt: new Date('2026-10-13T09:00:00Z'), reversedBy: { id: 'u', name: 'Grace Wanjiru', departmentId: KITCHEN.id } });
    const cells = buildBranchWasteKpis({ last7: [reversed, log({ value: 200, inventoryItemId: 'milk', inventoryItem: { name: 'Milk' } })], reversedLast7: [reversed], todayStart: TODAY, scope: 'ONE_BRANCH' });
    expect(cells[0]?.value).toBe('200');
    expect(cells[1]?.value).toBe('200');
    expect(cells[2]?.value).toBe('Milk');
  });

  it('Most wasted names the item with the most value, its department (one branch) and its commonest reason', () => {
    const cells = buildBranchWasteKpis({
      last7: [
        log({ value: 3000, reason: 'EXPIRY' }),
        log({ value: 600, reason: 'EXPIRY' }),
        log({ value: 300, reason: 'SPOILAGE', inventoryItemId: 'milk', inventoryItem: { name: 'Milk' }, dept: BARISTA }),
      ],
      reversedLast7: [],
      todayStart: TODAY,
      scope: 'ONE_BRANCH',
    });
    expect(cells[2]).toMatchObject({ value: 'Beef stew', caption: 'KES 3,600 · Kitchen · mostly expired', tone: 'WARN' });
  });

  it('across branches, Today adds the branch count and Most wasted leaves the department out (W8)', () => {
    const cells = buildBranchWasteKpis({ last7: [log({ siteId: 'nyeri' }), log({ siteId: 'karatina' })], reversedLast7: [], todayStart: TODAY, scope: 'MANY_BRANCHES' });
    expect(cells[0]?.caption).toBe('KES · 2 entries · 2 branches');
    expect(cells[2]?.caption).toBe('KES 400 · mostly expired');
  });

  it('an empty week reads plainly', () => {
    const cells = buildBranchWasteKpis({ last7: [], reversedLast7: [], todayStart: TODAY, scope: 'ONE_BRANCH' });
    expect(cells.map((c) => c.value)).toEqual(['0', '0', '—', '0']);
    expect(cells[2]).toMatchObject({ caption: 'Nothing wasted in 7 days', tone: 'NEUTRAL' });
    expect(cells[3]?.caption).toBe('Nothing reversed');
  });
});

describe('reversedCaption: phrased from the data', () => {
  const own = { id: 'u-grace', name: 'Grace Wanjiru', departmentId: KITCHEN.id };
  const outsider = { id: 'u-bm', name: 'Beatrice Kamau', departmentId: null };

  it('one, two, or more reversals all by the entry’s own department', () => {
    expect(reversedCaption([reversal(own)])).toBe('By its own department');
    expect(reversedCaption([reversal(own), reversal(own)])).toBe('Both by their own department');
    expect(reversedCaption([reversal(own), reversal(own), reversal(own)])).toBe('Each by its own department');
  });

  it('names the people from outside the department', () => {
    expect(reversedCaption([reversal(outsider)])).toBe('1 by Beatrice K.');
  });

  it('counts the own-department ones first when both kinds are there', () => {
    expect(reversedCaption([reversal(own), reversal(outsider)])).toBe('1 by their own department · 1 by Beatrice K.');
  });

  it('a reversal by someone of another department of the branch is not “own”', () => {
    expect(reversedCaption([reversal({ id: 'u-d', name: 'David Mutua', departmentId: BARISTA.id })])).toBe('1 by David M.');
  });
});

describe('shortName', () => {
  it('is the first name and the initial of the last', () => {
    expect(shortName('Grace Wanjiru')).toBe('Grace W.');
    expect(shortName('Grace Njeri Wanjiru')).toBe('Grace W.');
    expect(shortName('Grace')).toBe('Grace');
  });
});
