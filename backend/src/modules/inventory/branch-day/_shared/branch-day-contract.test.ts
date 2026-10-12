/**
 * Contract drift guard for Branch day (BD1 to BD21): the shared sample payloads parse against the frozen Zod schemas, bad inputs are
 * refused, the head's blind count carries nothing to count against, no response a head or member can reach carries money, and the front
 * end's fixtures are byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './branch-day-contract.fixtures.json';
import {
  acceptOpeningInputSchema,
  activityQuerySchema,
  BRANCH_DAY_ERROR_CODES,
  closeDayInputSchema,
  closeDayResultSchema,
  closeSummarySchema,
  correctCountInputSchema,
  correctCountResultSchema,
  countQuerySchema,
  countViewSchema,
  dayActivitySchema,
  dayDocumentsSchema,
  dayEntriesSchema,
  dayFileSchema,
  daySheetSchema,
  DAY_COUNT_BLIND_KEYS,
  DAY_MONEY_KEYS,
  departmentFiguresSchema,
  entriesQuerySchema,
  errorBodySchema,
  historyQuerySchema,
  historySchema,
  homeSchema,
  myDaySchema,
  myHistoryQuerySchema,
  myHistorySchema,
  openingResultSchema,
  openingViewSchema,
  recountOpeningInputSchema,
  recountPreviewInputSchema,
  recountPreviewSchema,
  saveCountInputSchema,
  saveCountResultSchema,
  sheetQuerySchema,
  signCountInputSchema,
  signCountResultSchema,
  todayQuerySchema,
  todaySchema,
} from './branch-day-contract';

const F = fixtures as Record<string, unknown>;

describe('branch day contract fixtures', () => {
  it.each([
    ['homeMorning', homeSchema],
    ['homeEvening', homeSchema],
    ['homeSent', homeSchema],
    ['openingView', openingViewSchema],
    ['acceptOpeningInput', acceptOpeningInputSchema],
    ['openingResult', openingResultSchema],
    ['recountPreviewInput', recountPreviewInputSchema],
    ['recountPreview', recountPreviewSchema],
    ['recountOpeningInput', recountOpeningInputSchema],
    ['countView', countViewSchema],
    ['countViewOnBehalf', countViewSchema],
    ['saveCountInput', saveCountInputSchema],
    ['saveCountResult', saveCountResultSchema],
    ['signCountInput', signCountInputSchema],
    ['signCountResult', signCountResultSchema],
    ['myHistoryQuery', myHistoryQuerySchema],
    ['myHistory', myHistorySchema],
    ['myDay', myDaySchema],
    ['todayQuery', todayQuerySchema],
    ['todayBlocked', todaySchema],
    ['todayDeliveryBlocked', todaySchema],
    ['todayClosed', todaySchema],
    ['todayHub', todaySchema],
    ['todayNoDay', todaySchema],
    ['departmentFigures', departmentFiguresSchema],
    ['closeSummary', closeSummarySchema],
    ['closeDayInput', closeDayInputSchema],
    ['closeDayResult', closeDayResultSchema],
    ['historyQuery', historyQuerySchema],
    ['history', historySchema],
    ['historyHub', historySchema],
    ['dayFile', dayFileSchema],
    ['activityQuery', activityQuerySchema],
    ['dayActivity', dayActivitySchema],
    ['dayDocuments', dayDocumentsSchema],
    ['entriesQuery', entriesQuerySchema],
    ['dayEntries', dayEntriesSchema],
    ['correctCountInput', correctCountInputSchema],
    ['correctCountResult', correctCountResultSchema],
    ['sheetQuery', sheetQuerySchema],
    ['daySheet', daySheetSchema],
    ['errorInvalidPin', errorBodySchema],
    ['errorNotYourDepartment', errorBodySchema],
    ['errorDayAlreadyClosed', errorBodySchema],
    ['errorDayNotReady', errorBodySchema],
    ['errorDayNotClosed', errorBodySchema],
    ['errorAlreadyCounted', errorBodySchema],
    ['errorCountIncomplete', errorBodySchema],
    ['errorOpeningAlreadyChecked', errorBodySchema],
    ['errorCorrectionWindowPassed', errorBodySchema],
    ['errorCorrectionNoChange', errorBodySchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('every error fixture uses a code the contract lists', () => {
    const errorFixtures = Object.keys(F).filter((name) => name.startsWith('error'));
    expect(errorFixtures).toHaveLength(10);
    for (const name of errorFixtures) {
      const code = (F[name] as { error: { code: string } }).error.code;
      expect(BRANCH_DAY_ERROR_CODES as readonly string[]).toContain(code);
    }
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'branch-day-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(join(__dirname, '../../../../../../frontend/features/inventory/branch-day/_shared/types/branch-day-contract.fixtures.json'), 'utf8');
    expect(theirs).toBe(mine);
  });
});

describe('bad inputs are refused', () => {
  it('a PIN must be four digits and every signing write carries an idempotency key', () => {
    expect(closeDayInputSchema.safeParse({ pin: '12', idempotencyKey: 'close-day-0044' }).success).toBe(false);
    expect(closeDayInputSchema.safeParse({ pin: '1234' }).success).toBe(false);
    expect(signCountInputSchema.safeParse({ pin: '1234', idempotencyKey: 'short' }).success).toBe(false);
    expect(acceptOpeningInputSchema.safeParse({ idempotencyKey: 'open-accept-0044-barista', pin: '1234' }).success).toBe(false); // accepting takes no PIN
  });

  it('a correction names the department, the item and a reason, and its figure cannot be negative', () => {
    const base = F.correctCountInput as Record<string, unknown>;
    expect(correctCountInputSchema.safeParse({ ...base, closingQty: '-1' }).success).toBe(false);
    expect(correctCountInputSchema.safeParse({ ...base, reason: 'FORGOT' }).success).toBe(false);
    expect(correctCountInputSchema.safeParse({ ...base, departmentId: undefined }).success).toBe(false);
    expect(correctCountInputSchema.safeParse({ ...base, note: 'x'.repeat(201) }).success).toBe(false);
    expect(correctCountInputSchema.safeParse({ ...base, note: undefined }).success).toBe(true);
  });

  it('a count needs at least one line and a counted figure is a non-negative decimal string', () => {
    expect(saveCountInputSchema.safeParse({ lines: [] }).success).toBe(false);
    expect(saveCountInputSchema.safeParse({ lines: [{ itemId: '80000000-0000-4000-8000-000000000101', countedQty: -2 }] }).success).toBe(false);
    expect(recountPreviewInputSchema.safeParse({ lines: [{ itemId: '80000000-0000-4000-8000-000000000101', countedQty: null }] }).success).toBe(false);
    expect(saveCountInputSchema.safeParse({ lines: [{ itemId: '80000000-0000-4000-8000-000000000101', countedQty: null }] }).success).toBe(true);
  });

  it('the strict inputs refuse a department id they should not take from a head', () => {
    // A department head names no department of their own: the optional `departmentId` is for the Branch Manager (the service refuses a head naming another).
    expect(countQuerySchema.safeParse({ departmentId: 'not-a-uuid' }).success).toBe(false);
    expect(closeDayInputSchema.safeParse({ pin: '1234', idempotencyKey: 'close-day-0044', departmentId: '30000000-0000-4000-8000-000000000001' }).success).toBe(false);
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

/** What a department head or member can reach: no money anywhere. */
const HEAD_RESPONSES = [
  'homeMorning',
  'homeEvening',
  'homeSent',
  'openingView',
  'openingResult',
  'recountPreview',
  'countView',
  'countViewOnBehalf',
  'saveCountResult',
  'signCountResult',
  'myHistory',
  'myDay',
];
/** The blind evening count: nothing to count against. */
const BLIND_COUNT = ['countView', 'countViewOnBehalf', 'saveCountResult', 'signCountResult'];
const MONEY = /value|kes|cost|price/i;

describe('blind and money rules', () => {
  it.each(HEAD_RESPONSES)('%s carries no money', (name) => {
    expect(allKeys(F[name]).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(F[name]).filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k))).toEqual([]);
  });

  it.each(BLIND_COUNT)('%s carries no opening, received, waste, used, yesterday or expected figure', (name) => {
    expect(allKeys(F[name]).filter((k) => (DAY_COUNT_BLIND_KEYS as readonly string[]).includes(k))).toEqual([]);
  });

  it('a past day a head reads shows quantities, never values', () => {
    const keys = allKeys(F.myDay);
    expect(keys).toEqual(expect.arrayContaining(['openingQty', 'receivedQty', 'wasteQty', 'closingQty', 'usedQty']));
    expect(keys.filter((k) => MONEY.test(k))).toEqual([]);
  });

  it('the manager screens carry money (cap catalog.see_costs), with the Used value and the Closing stock value', () => {
    expect(allKeys(F.departmentFigures)).toEqual(expect.arrayContaining(['usedValueKes', 'closingValueKes', 'unitCostKes']));
    expect(allKeys(F.todayBlocked)).toContain('usedValueKes');
    expect(allKeys(F.history)).toEqual(expect.arrayContaining(['usedValueKes', 'closingValueKes']));
  });

  it('Today for a hub role is read only: no close and no count on behalf', () => {
    for (const name of ['todayHub', 'todayNoDay']) {
      expect((F[name] as { can: { close: boolean; countOnBehalf: boolean } }).can).toEqual({ close: false, countOnBehalf: false });
    }
    expect((F.todayHub as { branches?: unknown[] }).branches).toHaveLength(2);
  });

  it('the day has no reopen, no gap, no reason prompt and no "unusual" flag anywhere in the contract', () => {
    const everything = JSON.stringify(F) + readFileSync(join(__dirname, 'branch-day-contract.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(everything).not.toMatch(/reopen|consumption|unusual|reasonRequired|threshold/i);
  });
});

describe('the Used today arithmetic in the fixtures', () => {
  it('Used today = opening + received − waste − closing, and Used value = Used today × unit cost, on every figure line', () => {
    const lines = (F.departmentFigures as { department: { lines: Array<Record<string, string | null>> } }).department.lines;
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      const used = Number(l.openingQty) + Number(l.receivedQty) - Number(l.wasteQty) - Number(l.closingQty);
      expect(Number(l.usedQty), String(l.itemName)).toBe(used);
      expect(Number(l.usedValueKes), String(l.itemName)).toBe(used * Number(l.unitCostKes));
      expect(Number(l.closingValueKes), String(l.itemName)).toBe(Number(l.closingQty) * Number(l.unitCostKes));
    }
  });

  it('a correction line keeps the signed figure and the corrected one', () => {
    const flour = (F.departmentFigures as { department: { lines: Array<{ itemName: string; correction: { fromClosingQty: string; toClosingQty: string; fromUsedQty: string; toUsedQty: string } | null }> } }).department.lines[0]!;
    expect(flour.correction).toMatchObject({ fromClosingQty: '1', toClosingQty: '2', fromUsedQty: '3', toUsedQty: '2' });
  });
});
