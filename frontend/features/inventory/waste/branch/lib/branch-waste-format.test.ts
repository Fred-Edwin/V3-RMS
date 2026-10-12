import { describe, expect, it } from 'vitest';
import fixtures from '../../_shared/types/waste-contract.fixtures.json';
import type { BranchWasteEntry } from '../../_shared/types/waste-contract';
import { entryMeta, groupByDay, quantityIsUnreadable, quantityIsValid } from './branch-waste-format';

const rows = fixtures.myBranchWasteList.rows as unknown as BranchWasteEntry[];

describe('branch waste format', () => {
  it('says "you" on the caller\'s own rows and a short name on the others', () => {
    const own = rows.find((r) => r.loggedBy.id === 'u-grace')!;
    const other = rows.find((r) => r.loggedBy.id === 'u-joseph')!;
    expect(entryMeta(own, 'u-grace')).toMatch(/ · Spoiled · \d\d:\d\d · you$/);
    expect(entryMeta(other, 'u-grace')).toMatch(/ · Expired · \d\d:\d\d · Joseph M\.$/);
  });

  it('groups rows by Nairobi day in order, today first with its "Today" prefix', () => {
    const groups = groupByDay(rows, '2026-10-07');
    expect(groups).toHaveLength(1);
    expect(groups[0]!.heading).toBe('Today · Wed 7 Oct');
    expect(groups[0]!.rows).toHaveLength(rows.length);
    expect(groupByDay(rows, '2026-10-09')[0]!.heading).toBe('Wed 7 Oct');
  });

  it('accepts only a quantity above zero', () => {
    expect(quantityIsValid('2')).toBe(true);
    expect(quantityIsValid('0.5')).toBe(true);
    expect(quantityIsValid('0')).toBe(false);
    expect(quantityIsValid('0.')).toBe(false);
    expect(quantityIsValid('')).toBe(false);
    expect(quantityIsUnreadable('.')).toBe(true);
    expect(quantityIsUnreadable('2.')).toBe(false);
  });
});
