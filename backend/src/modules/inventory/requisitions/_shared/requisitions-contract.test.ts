/**
 * Contract drift guard for the Requisitions rebuild: the shared sample payloads parse against the frozen Zod schemas, bad
 * inputs are refused, the printed requisition carries no money, a head's payloads carry none either, and the front end's
 * copy of the fixtures is byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './requisitions-contract.fixtures.json';
import {
  addAdditionInputSchema,
  addAdditionResultSchema,
  activitySchema,
  approveAdditionInputSchema,
  approveAdditionResultSchema,
  approveInputSchema,
  approveResultSchema,
  approveSummarySchema,
  badgesSchema,
  cancelInputSchema,
  cancelResultSchema,
  changeQuantityInputSchema,
  changeQuantityResultSchema,
  documentsSchema,
  errorBodySchema,
  historyMineSchema,
  homeSchema,
  listRequisitionsQuerySchema,
  listRequisitionsSchema,
  nudgeResultSchema,
  printSchema,
  recallSectionResultSchema,
  requisitionFileSchema,
  saveLinesInputSchema,
  sectionEditSchema,
  sendSectionInputSchema,
  sendSectionResultSchema,
  setUrgentInputSchema,
  setUrgentResultSchema,
  skipSectionResultSchema,
  skipSectionsInputSchema,
  trackerStepSchema,
  nextStepSchema,
  parseCancelReason,
  CANCEL_PRESETS,
  startRequisitionInputSchema,
  startRequisitionResultSchema,
  REQUISITION_ERROR_CODES,
} from './requisitions-contract';

const F = fixtures as Record<string, unknown>;

describe('requisitions contract fixtures', () => {
  it.each([
    ['listManager', listRequisitionsSchema],
    ['listHubCollecting', listRequisitionsSchema],
    ['listAttendant', listRequisitionsSchema],
    ['badgesManager', badgesSchema],
    ['badgesStore', badgesSchema],
    ['fileManager', requisitionFileSchema],
    ['fileHeadApproved', requisitionFileSchema],
    ['activity', activitySchema],
    ['documents', documentsSchema],
    ['print', printSchema],
    ['home', homeSchema],
    ['homeNoneOpen', homeSchema],
    ['sectionEdit', sectionEditSchema],
    ['historyMine', historyMineSchema],
    ['approveSummary', approveSummarySchema],
    ['listQuery', listRequisitionsQuerySchema],
    ['startInput', startRequisitionInputSchema],
    ['startInputUrgent', startRequisitionInputSchema],
    ['startResult', startRequisitionResultSchema],
    ['saveLinesInput', saveLinesInputSchema],
    ['sendSectionInput', sendSectionInputSchema],
    ['sendSectionResult', sendSectionResultSchema],
    ['recallSectionResult', recallSectionResultSchema],
    ['setUrgentInput', setUrgentInputSchema],
    ['setUrgentResult', setUrgentResultSchema],
    ['changeQuantityInput', changeQuantityInputSchema],
    ['changeQuantityResult', changeQuantityResultSchema],
    ['nudgeResult', nudgeResultSchema],
    ['skipSectionsInput', skipSectionsInputSchema],
    ['skipSectionResult', skipSectionResultSchema],
    ['approveInput', approveInputSchema],
    ['approveResult', approveResultSchema],
    ['cancelInput', cancelInputSchema],
    ['cancelInputOther', cancelInputSchema],
    ['cancelResult', cancelResultSchema],
    ['addAdditionInput', addAdditionInputSchema],
    ['addAdditionResult', addAdditionResultSchema],
    ['approveAdditionInput', approveAdditionInputSchema],
    ['approveAdditionResult', approveAdditionResultSchema],
    ['errorAlreadyOpen', errorBodySchema],
    ['errorInvalidPin', errorBodySchema],
    ['errorAdditionLocked', errorBodySchema],
    ['errorReasonRequired', errorBodySchema],
    ['errorSectionNotSent', errorBodySchema],
    ['errorSectionAlreadySent', errorBodySchema],
    ['errorNotApproved', errorBodySchema],
    ['errorSectionNotOpen', errorBodySchema],
    ['errorAdditionNotPending', errorBodySchema],
    ['errorBranchCodeMissing', errorBodySchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('every error fixture uses a code the contract lists', () => {
    const errorFixtures = Object.keys(F).filter((name) => name.startsWith('error'));
    expect(errorFixtures).toHaveLength(10);
    for (const name of errorFixtures) {
      const code = (F[name] as { error: { code: string } }).error.code;
      expect(REQUISITION_ERROR_CODES as readonly string[]).toContain(code);
    }
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'requisitions-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(
      join(__dirname, '../../../../../../frontend/features/inventory/requisitions/_shared/types/requisitions-contract.fixtures.json'),
      'utf8',
    );
    expect(theirs).toBe(mine);
  });
});

/** Every key anywhere in a payload. */
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

describe('money and blind rules in the payloads', () => {
  it('the printed requisition has no money anywhere', () => {
    expect(allKeys(fixtures.print).filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('a head sees no money and the Attendant list carries none', () => {
    expect(allKeys(fixtures.fileHeadApproved).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.home).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.sectionEdit).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.historyMine).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.listAttendant).filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('a money field is absent, not null, without the capability', () => {
    expect(Object.keys(fixtures.listAttendant.rows[0]!)).not.toContain('valueKes');
    expect(Object.keys(fixtures.listManager.rows[0]!)).toContain('valueKes');
  });

  it('the Attendant list carries no stock figures and only the Branch Manager list has the badges for approval', () => {
    expect(allKeys(fixtures.listAttendant)).not.toContain('onHand');
    expect(Object.keys(fixtures.badgesManager)).toContain('toApprove');
    expect(Object.keys(fixtures.badgesStore)).not.toContain('toApprove');
  });

  it('a head file holds one department only', () => {
    expect(fixtures.fileHeadApproved.sections).toHaveLength(1);
  });
});

describe('inputs that must be refused', () => {
  it('the cycle is Morning, Afternoon or Extra (the old Evening and Ad hoc are never written)', () => {
    expect(startRequisitionInputSchema.safeParse({ ...fixtures.startInput, cycle: 'EVENING' }).success).toBe(false);
    expect(startRequisitionInputSchema.safeParse({ ...fixtures.startInput, cycle: 'AD_HOC' }).success).toBe(false);
    expect(startRequisitionInputSchema.safeParse({ ...fixtures.startInput, cycle: 'EXTRA' }).success).toBe(true);
  });

  it('starting needs an idempotency key and refuses unknown keys', () => {
    expect(startRequisitionInputSchema.safeParse({ cycle: 'MORNING' }).success).toBe(false);
    expect(startRequisitionInputSchema.safeParse({ ...fixtures.startInput, branchId: 'x' }).success).toBe(false);
  });

  it('a draft line has a quantity above zero and an item appears once', () => {
    const item = '10000000-0000-4000-8000-000000000001';
    expect(saveLinesInputSchema.safeParse({ lines: [{ itemId: item, requestedQty: '0' }] }).success).toBe(false);
    expect(saveLinesInputSchema.safeParse({ lines: [{ itemId: item, requestedQty: '1' }, { itemId: item, requestedQty: '2' }] }).success).toBe(false);
  });

  it('the PIN is four digits and every signing body is strict', () => {
    expect(sendSectionInputSchema.safeParse({ pin: '12' }).success).toBe(false);
    expect(approveInputSchema.safeParse({ pin: 'abcd' }).success).toBe(false);
    expect(approveInputSchema.safeParse({ pin: '1234', extra: 1 }).success).toBe(false);
    expect(approveInputSchema.safeParse({}).success).toBe(false);
  });

  it('a cancel needs a reason and a PIN', () => {
    expect(cancelInputSchema.safeParse({ pin: '1234' }).success).toBe(false);
    expect(cancelInputSchema.safeParse({ reason: 'ab', pin: '1234' }).success).toBe(false);
  });

  it('a changed quantity may be zero but not negative; the department of an addition is never sent', () => {
    expect(changeQuantityInputSchema.safeParse({ approvedQty: '0' }).success).toBe(true);
    expect(changeQuantityInputSchema.safeParse({ approvedQty: '-1' }).success).toBe(false);
    expect(addAdditionInputSchema.safeParse({ ...fixtures.addAdditionInput, departmentId: 'x' }).success).toBe(false);
    expect(addAdditionInputSchema.safeParse({ lines: [], pin: '1234' }).success).toBe(false);
  });

  it('the list defaults to 50 rows, page 1, and refuses an unknown tab', () => {
    expect(listRequisitionsQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 50 });
    expect(listRequisitionsQuerySchema.safeParse({ tab: 'returned' }).success).toBe(false);
  });
});

/** Amendment 2 (docs/features/inventory/requisitions-amendment-2.md): every new field is in the fixtures and every new rule is pinned. */
describe('Amendment 2', () => {
  const MOMENT_KEYS = ['allInAt', 'urgentAt', 'sentAt', 'closedAt', 'cancelledAt', 'cancelReason', 'urgentNote'];

  it('R1 query: cycle, departmentId and urgent are read from the query string', () => {
    expect(listRequisitionsQuerySchema.parse(fixtures.listQuery)).toMatchObject({ cycle: 'AFTERNOON', departmentId: fixtures.listQuery.departmentId, urgent: true });
    expect(listRequisitionsQuerySchema.parse({ urgent: 'false' }).urgent).toBe(false);
    expect(listRequisitionsQuerySchema.safeParse({ urgent: 'yes' }).success).toBe(false);
    expect(listRequisitionsQuerySchema.safeParse({ cycle: 'EVENING' }).success).toBe(false);
    expect(listRequisitionsQuerySchema.safeParse({ departmentId: 'kitchen' }).success).toBe(false);
  });

  it('R1 rows and R9 history rows carry the seven moments', () => {
    for (const row of [...fixtures.listManager.rows, ...fixtures.listHubCollecting.rows, ...fixtures.listAttendant.rows, ...fixtures.historyMine.rows]) {
      for (const key of MOMENT_KEYS) expect(Object.keys(row), key).toContain(key);
    }
    expect(fixtures.historyMine.rows.some((r) => r.cancelledAt !== null && r.cancelReason !== null)).toBe(true);
    expect(fixtures.listHubCollecting.rows.some((r) => r.urgentAt !== null && r.urgentNote !== null)).toBe(true);
  });

  it('R7 Home carries suggestedLineCount, openedAt, openByCycle and sentAt on earlier rows', () => {
    for (const home of [fixtures.home, fixtures.homeNoneOpen]) {
      expect(Object.keys(home)).toEqual(expect.arrayContaining(['suggestedLineCount', 'openByCycle']));
      expect(Object.keys(home.openByCycle).sort()).toEqual(['AFTERNOON', 'EXTRA', 'MORNING']);
    }
    expect(fixtures.home.open && Object.keys(fixtures.home.open)).toContain('openedAt');
    expect(fixtures.home.earlierToday.every((r) => 'sentAt' in r)).toBe(true);
  });

  it('R8 SectionEdit carries openedAt', () => {
    expect(Object.keys(fixtures.sectionEdit)).toContain('openedAt');
  });

  it('the urgent note is optional and at most 200 characters (R11, R15)', () => {
    expect(startRequisitionInputSchema.safeParse({ ...fixtures.startInput, urgentNote: 'x'.repeat(200) }).success).toBe(true);
    expect(startRequisitionInputSchema.safeParse({ ...fixtures.startInput, urgentNote: 'x'.repeat(201) }).success).toBe(false);
    expect(setUrgentInputSchema.safeParse({ urgent: true, urgentNote: 'x'.repeat(201) }).success).toBe(false);
    expect(setUrgentInputSchema.safeParse({ urgent: false }).success).toBe(true);
  });

  it('R18 skip takes a list of departments, once each', () => {
    const [a, b] = fixtures.skipSectionsInput.departmentIds;
    expect(skipSectionsInputSchema.safeParse({ departmentIds: [] }).success).toBe(false);
    expect(skipSectionsInputSchema.safeParse({ departmentIds: [a, a] }).success).toBe(false);
    expect(skipSectionsInputSchema.safeParse({ departmentIds: [a, b] }).success).toBe(true);
    expect(fixtures.skipSectionResult.sections).toHaveLength(2);
  });

  it('R20 cancel reason is "preset — note"; Other needs a note; a bare preset is allowed', () => {
    expect(CANCEL_PRESETS).toEqual(['Asked for the wrong cycle', 'Asked twice by mistake', 'No longer needed', 'Other']);
    const pin = '1234';
    expect(cancelInputSchema.safeParse({ reason: 'No longer needed', pin }).success).toBe(true);
    expect(cancelInputSchema.safeParse({ reason: 'No longer needed — the Kitchen will start again', pin }).success).toBe(true);
    expect(cancelInputSchema.safeParse({ reason: 'Other', pin }).success).toBe(false);
    expect(cancelInputSchema.safeParse({ reason: 'Other — ', pin }).success).toBe(false);
    expect(cancelInputSchema.safeParse({ reason: 'Other — the van broke down', pin }).success).toBe(true);
    expect(cancelInputSchema.safeParse({ reason: 'Raised by mistake', pin }).success).toBe(false);
    expect(parseCancelReason('Asked twice by mistake — oops')).toEqual({ preset: 'Asked twice by mistake', note: 'oops' });
  });

  it('R6 print carries the new fields and still no money', () => {
    expect(Object.keys(fixtures.print)).toEqual(expect.arrayContaining(['startedAt', 'generatedAt']));
    const page = fixtures.print.pages[0]!;
    expect(Object.keys(page)).toEqual(expect.arrayContaining(['askedBy', 'askedAt', 'deliverTo']));
    expect(page.additions[0] && Object.keys(page.additions[0])).toEqual(expect.arrayContaining(['approvedBy', 'approvedAt']));
    expect(allKeys(fixtures.print).filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('the Next step card holds the action key and facts only; the tracker holds facts only', () => {
    for (const file of [fixtures.fileManager, fixtures.fileHeadApproved]) {
      expect(nextStepSchema.safeParse(file.nextStep).success).toBe(true);
      expect(Object.keys(file.nextStep).sort()).toEqual(['action', 'departmentId', 'facts']);
      for (const step of file.tracker) {
        expect(trackerStepSchema.safeParse(step).success).toBe(true);
        expect(Object.keys(step).sort()).toEqual(['at', 'by', 'count', 'key', 'state']);
      }
    }
  });

  it('the six requisition codes Amendment 2 adds are listed', () => {
    expect(REQUISITION_ERROR_CODES).toEqual(
      expect.arrayContaining(['SECTION_NOT_SENT', 'SECTION_ALREADY_SENT', 'NOT_APPROVED', 'SECTION_NOT_OPEN', 'ADDITION_NOT_PENDING', 'BRANCH_CODE_MISSING']),
    );
  });
});
