import { describe, expect, it } from 'vitest';
import fixtures from './waste-contract.fixtures.json';
import {
  BRANCH_WASTE_BLIND_KEYS,
  BRANCH_WASTE_ERROR_CODES,
  type BranchWasteDetail,
  type BranchWasteEntry,
  type BranchWasteList,
  type LogBranchWasteResult,
  type MyBranchWasteList,
  type LogWasteResult,
  type WasteEntry,
  type WasteItems,
  type WasteList,
} from './waste-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror types and their key sets are pinned. */
const keysOf = (o: object): string[] => Object.keys(o).sort();

describe('waste contract mirror', () => {
  it('entry keys', () => {
    const entry = (fixtures.wasteListManager as WasteList).rows[0] as WasteEntry;
    expect(keysOf(entry)).toEqual(['at', 'can', 'id', 'itemId', 'itemName', 'loggedBy', 'note', 'quantity', 'reason', 'reasonText', 'reversal', 'status', 'unit', 'valueKes']);
    expect(keysOf(entry.can)).toEqual(['reverse']);
  });

  it('a reversed entry carries who, when and why', () => {
    const reversed = (fixtures.wasteListManager as WasteList).rows[1] as WasteEntry;
    expect(reversed.status).toBe('REVERSED');
    expect(keysOf(reversed.reversal as object)).toEqual(['at', 'by', 'note', 'reason', 'reasonText']);
    expect(reversed.can.reverse).toBe(false);
  });

  it('the Attendant payloads carry no stock figure', () => {
    const items = fixtures.wasteItems as WasteItems;
    for (const o of [...items.often, ...items.items]) expect(keysOf(o)).not.toContain('onHand');
    expect(keysOf(fixtures.logWasteResultAttendant as LogWasteResult)).toEqual(['entries', 'replayed', 'totalValueKes']);
    expect(keysOf(fixtures.wasteListAttendant as WasteList)).toEqual(['bannerText', 'chips', 'page', 'rows']);
  });

  it('the Manager list has the KPI strip and the chips', () => {
    const list = fixtures.wasteListManager as WasteList;
    expect(keysOf(list)).toEqual(['chips', 'kpis', 'page', 'people', 'rows']);
    expect(keysOf(list.chips)).toEqual(['last7', 'reversed', 'today']);
  });
});

const keysDeep = (value: unknown, out: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
};

describe('branch waste contract mirror', () => {
  it('a branch entry is the Central Store entry plus department and branch', () => {
    const entry = (fixtures.branchWasteListManager as BranchWasteList).rows[0] as BranchWasteEntry;
    expect(keysOf(entry)).toEqual(['at', 'branch', 'can', 'department', 'id', 'itemId', 'itemName', 'loggedBy', 'note', 'quantity', 'reason', 'reasonText', 'reversal', 'status', 'unit', 'valueKes']);
    expect(keysOf(entry.branch)).toEqual(['code', 'id', 'name']);
    expect(keysOf(entry.department)).toEqual(['id', 'name']);
  });

  it('response key sets', () => {
    expect(keysOf(fixtures.branchWasteListManager as BranchWasteList)).toEqual(['departments', 'kpis', 'page', 'rows']);
    expect(keysOf(fixtures.allBranchesWasteDirector as BranchWasteList)).toEqual(['branches', 'departments', 'kpis', 'page', 'rows']);
    expect(keysOf(fixtures.myBranchWasteList as MyBranchWasteList)).toEqual(['bannerText', 'department', 'page', 'rows']);
    expect(keysOf(fixtures.logBranchWasteResultMember as LogBranchWasteResult)).toEqual(['entries', 'replayed']);
    expect(keysOf(fixtures.branchWasteDetailManager as BranchWasteDetail)).toEqual(['entry', 'ledger']);
    expect(keysOf(fixtures.branchWasteDetailMember as BranchWasteDetail)).toEqual(['entry']);
  });

  it.each(['branchWasteItemsMember', 'logBranchWasteResultMember', 'myBranchWasteList', 'branchWasteDetailMember'] as const)('%s carries no money or stock key', (name) => {
    const keys = keysDeep(fixtures[name]);
    for (const blind of BRANCH_WASTE_BLIND_KEYS) expect(keys.has(blind), `${name} has ${blind}`).toBe(false);
  });

  it('the department list shows other people’s entries with Reverse only on the caller’s own', () => {
    const list = fixtures.myBranchWasteList as MyBranchWasteList;
    expect(new Set(list.rows.map((r) => r.loggedBy.id)).size).toBeGreaterThan(1);
    expect(list.rows.filter((r) => r.can.reverse).every((r) => r.loggedBy.id === 'u-grace')).toBe(true);
  });

  it('a reversed entry reads 0 and the any-branch list offers no Reverse', () => {
    const manager = fixtures.branchWasteListManager as BranchWasteList;
    expect(manager.rows.find((r) => r.status === 'REVERSED')?.valueKes).toBe('0.00');
    expect((fixtures.allBranchesWasteDirector as BranchWasteList).rows.every((r) => !r.can.reverse)).toBe(true);
  });

  it('the error fixtures use the six codes', () => {
    const names = ['errorItemNotInDepartment', 'errorBranchItemRetired', 'errorNotYourDepartment', 'errorBranchNotYourEntry', 'errorBranchWindowPassed', 'errorBranchAlreadyReversed'] as const;
    const codes = names.map((n) => (fixtures[n] as { error: { code: string } }).error.code);
    expect([...codes].sort()).toEqual([...BRANCH_WASTE_ERROR_CODES].sort());
  });
});
