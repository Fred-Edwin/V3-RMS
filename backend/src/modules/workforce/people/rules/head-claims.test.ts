import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { claimsFromHeadRows, isActiveOn, type HeadRow } from './head-claims';

const d = parseNairobiDate;
const row = (over: Partial<HeadRow> = {}): HeadRow => ({
  startsOn: d('2026-09-01'),
  endsOn: null,
  isActing: false,
  departmentInventoryTag: 'KITCHEN',
  ...over,
});

describe('head claims', () => {
  it('is active from the start day to the end day inclusive', () => {
    expect(isActiveOn(row(), d('2026-09-01'))).toBe(true);
    expect(isActiveOn(row(), d('2026-08-31'))).toBe(false);
    expect(isActiveOn(row({ endsOn: d('2026-10-31') }), d('2026-10-31'))).toBe(true);
    expect(isActiveOn(row({ endsOn: d('2026-10-31') }), d('2026-11-01'))).toBe(false);
  });

  it('claims the tag of a tagged department', () => {
    expect(claimsFromHeadRows([row()], d('2026-10-17'))).toEqual({ isDepartmentHead: true, departmentTag: 'KITCHEN' });
  });

  it('counts an acting head', () => {
    expect(claimsFromHeadRows([row({ isActing: true, departmentInventoryTag: 'BARISTA' })], d('2026-10-17'))).toEqual({
      isDepartmentHead: true,
      departmentTag: 'BARISTA',
    });
  });

  it('does not claim for a department with no inventory tag', () => {
    expect(claimsFromHeadRows([row({ departmentInventoryTag: null })], d('2026-10-17'))).toEqual({ isDepartmentHead: false, departmentTag: null });
  });

  it('does not claim once the row has ended or before it starts', () => {
    expect(claimsFromHeadRows([row({ endsOn: d('2026-10-01') })], d('2026-10-17')).isDepartmentHead).toBe(false);
    expect(claimsFromHeadRows([row({ startsOn: d('2026-11-01') })], d('2026-10-17')).isDepartmentHead).toBe(false);
    expect(claimsFromHeadRows([], d('2026-10-17')).isDepartmentHead).toBe(false);
  });
});
