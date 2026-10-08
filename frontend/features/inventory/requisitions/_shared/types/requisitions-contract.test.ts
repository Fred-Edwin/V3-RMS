import { describe, expect, it } from 'vitest';
import fixtures from './requisitions-contract.fixtures.json';
import type {
  Activity,
  AddAdditionResult,
  ApproveResult,
  ApproveSummary,
  Badges,
  Documents,
  Home,
  ListRequisitions,
  Print,
  RequisitionFile,
  RequisitionLine,
  SectionEdit,
  SendSectionResult,
} from './requisitions-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror types and their key sets are pinned. */
const keysOf = (o: object): string[] => Object.keys(o).sort();
const allKeys = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
};
const MONEY = /value|kes|cost|price/i;

describe('requisitions contract mirror', () => {
  it('list keys', () => {
    const list = fixtures.listManager as ListRequisitions;
    expect(keysOf(list)).toEqual(['page', 'rows', 'tab', 'tabCounts', 'waitingForYou']);
    expect(keysOf(list.rows[0]!)).toEqual([
      'additionWaiting', 'branch', 'cycle', 'cycleLabel', 'id', 'lineCount', 'openedAt', 'reference', 'rowAction', 'sections', 'status', 'statusText', 'tab', 'urgent', 'urgentOverHour', 'valueKes',
    ]);
    expect(keysOf(fixtures.listHubCollecting as ListRequisitions)).toContain('branches');
    expect(keysOf(list.tabCounts)).toEqual(['closed', 'collecting', 'discrepancies', 'on-the-way', 'to-approve', 'to-confirm', 'to-pack']);
  });

  it('file keys, and the Next step card carries one action', () => {
    const file = fixtures.fileManager as RequisitionFile;
    expect(keysOf(file)).toEqual([
      'additions', 'approvedAt', 'approvedBy', 'branch', 'can', 'cancelled', 'closedAt', 'cycle', 'cycleLabel', 'dispatches', 'id', 'lineCount', 'nextStep', 'openedAt', 'openedBy',
      'reference', 'sections', 'status', 'statusText', 'tracker', 'urgent', 'urgentAt', 'urgentOverHour', 'valueKes',
    ]);
    expect(keysOf(file.nextStep)).toEqual(['action', 'actionLabel', 'departmentId', 'text', 'title']);
    expect(file.tracker.map((s) => s.key)).toEqual(['STARTED', 'ALL_IN', 'APPROVED', 'PACKED', 'DELIVERED', 'CLOSED']);
  });

  it('line keys', () => {
    const line = (fixtures.fileManager as RequisitionFile).sections[0]!.lines[0] as RequisitionLine;
    expect(keysOf(line)).toEqual([
      'additionId', 'approvedQty', 'categoryPath', 'changeReason', 'changedByManager', 'changedFromSuggested', 'id', 'itemId', 'itemName', 'level', 'onHand', 'requestedQty', 'suggestedQty', 'unit', 'valueKes',
    ]);
  });

  it('money is absent, not null, for a head and the Attendant; the print has none', () => {
    expect(allKeys(fixtures.fileHeadApproved as RequisitionFile).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.home as Home).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.sectionEdit as SectionEdit).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.listAttendant as ListRequisitions).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.print as Print).filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('badges differ by role', () => {
    expect(keysOf(fixtures.badgesManager as Badges)).toEqual(['requisitions', 'toApprove']);
    expect(keysOf(fixtures.badgesStore as Badges)).toEqual(['requisitions', 'toPack']);
  });

  it('write results carry the common part', () => {
    const common = ['replayed', 'reference', 'requisitionId', 'status', 'statusText'];
    expect(keysOf(fixtures.sendSectionResult as SendSectionResult)).toEqual([...common, 'readyToApprove', 'section'].sort());
    expect(keysOf(fixtures.approveResult as ApproveResult)).toEqual([...common, 'approvedAt', 'approvedBy', 'valueKes'].sort());
    expect(keysOf(fixtures.addAdditionResult as AddAdditionResult)).toEqual([...common, 'addition'].sort());
  });

  it('the rest are typed', () => {
    const typed: [Activity, Documents, ApproveSummary] = [fixtures.activity as Activity, fixtures.documents as Documents, fixtures.approveSummary as ApproveSummary];
    expect(typed[0].events.length).toBeGreaterThan(0);
    expect(typed[1].documents[0]!.version).toBe(1);
    expect(typed[2].signingAs).toBe('BRANCH_MANAGER');
  });
});
