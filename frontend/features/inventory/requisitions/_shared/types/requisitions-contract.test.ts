import { describe, expect, it } from 'vitest';
import fixtures from './requisitions-contract.fixtures.json';
import { parseCancelReason, REQUISITION_ERROR_CODES } from './requisitions-contract';
import type {
  Activity,
  AddAdditionResult,
  ApproveResult,
  ApproveSummary,
  Badges,
  Documents,
  HistoryMine,
  Home,
  ListRequisitions,
  Print,
  RequisitionFile,
  RequisitionLine,
  SectionEdit,
  SendSectionResult,
  SkipSectionResult,
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
      'additionWaiting', 'allInAt', 'branch', 'cancelReason', 'cancelledAt', 'closedAt', 'cycle', 'cycleLabel', 'id', 'lineCount', 'openedAt', 'reference', 'rowAction', 'sections', 'sentAt', 'status',
      'statusText', 'tab', 'urgent', 'urgentAt', 'urgentNote', 'urgentOverHour', 'valueKes',
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
    expect(keysOf(file.nextStep)).toEqual(['action', 'departmentId', 'facts']);
    expect(keysOf(file.nextStep.facts)).toEqual(['additionsWaiting', 'sectionsIn', 'sectionsTotal']);
    expect(file.tracker.map((s) => s.key)).toEqual(['STARTED', 'ALL_IN', 'APPROVED', 'PACKED', 'DELIVERED', 'CLOSED']);
    for (const step of file.tracker) expect(keysOf(step)).toEqual(['at', 'by', 'count', 'key', 'state']);
  });

  it('Amendment 2: Home, section edit, history rows and print carry the new fields', () => {
    const home = fixtures.home as Home;
    expect(keysOf(home)).toEqual(['department', 'earlierToday', 'open', 'openByCycle', 'suggestedCycle', 'suggestedLineCount']);
    expect(keysOf(home.openByCycle)).toEqual(['AFTERNOON', 'EXTRA', 'MORNING']);
    expect(keysOf(home.open!)).toContain('openedAt');
    expect(keysOf(home.earlierToday[0]!)).toContain('sentAt');
    expect(keysOf(fixtures.sectionEdit as SectionEdit)).toContain('openedAt');
    const moments = ['allInAt', 'cancelReason', 'cancelledAt', 'closedAt', 'sentAt', 'urgentAt', 'urgentNote'];
    for (const row of (fixtures.historyMine as HistoryMine).rows) expect(keysOf(row)).toEqual(expect.arrayContaining(moments));
    const print = fixtures.print as Print;
    expect(keysOf(print)).toEqual(expect.arrayContaining(['startedAt', 'generatedAt']));
    expect(keysOf(print.pages[0]!)).toEqual(expect.arrayContaining(['askedBy', 'askedAt', 'deliverTo']));
    expect(keysOf(print.pages[0]!.additions[0]!)).toContain('approvedAt');
  });

  it('Amendment 2: skip result is a list; cancel reasons are "preset — note"; error codes are mirrored', () => {
    expect((fixtures.skipSectionResult as SkipSectionResult).sections).toHaveLength(2);
    expect(fixtures.skipSectionsInput.departmentIds).toHaveLength(2);
    for (const input of [fixtures.cancelInput, fixtures.cancelInputOther]) expect(parseCancelReason(input.reason)).not.toBeNull();
    expect(parseCancelReason('Other')?.note).toBe('');
    expect(parseCancelReason('Raised by mistake')).toBeNull();
    for (const code of ['SECTION_NOT_SENT', 'SECTION_ALREADY_SENT', 'NOT_APPROVED', 'SECTION_NOT_OPEN', 'ADDITION_NOT_PENDING', 'BRANCH_CODE_MISSING']) {
      expect(REQUISITION_ERROR_CODES as readonly string[]).toContain(code);
    }
    for (const name of Object.keys(fixtures).filter((n) => n.startsWith('error'))) {
      expect(REQUISITION_ERROR_CODES as readonly string[]).toContain((fixtures as unknown as Record<string, { error: { code: string } }>)[name]!.error.code);
    }
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
    expect(keysOf(fixtures.badgesStore as Badges)).toEqual(['dispatch', 'requisitions', 'toPack']);
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
