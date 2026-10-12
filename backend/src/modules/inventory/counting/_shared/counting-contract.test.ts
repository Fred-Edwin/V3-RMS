/**
 * Contract drift guard for the Counting rebuild: the shared sample payloads parse against the frozen Zod schemas, bad
 * inputs are refused, the Attendant's payloads carry no stock figure, and the front end's copy of the payloads is
 * byte-identical (its own test checks them against the hand-written mirror types).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './counting-contract.fixtures.json';
import {
  addItemsInputSchema,
  addItemsListSchema,
  approveInputSchema,
  approvePreviewSchema,
  blankSheetSchema,
  checkInputSchema,
  checkResultSchema,
  COUNT_STOCK_FIGURE_KEYS,
  countDetailSchema,
  countRecordPrintSchema,
  countSettingsSchema,
  countsHomeSchema,
  countsListQuerySchema,
  countsListSchema,
  countsSummarySchema,
  decisionInputSchema,
  flaggedListSchema,
  layoutInputSchema,
  moveItemInputSchema,
  myCountsListSchema,
  myCountsQuerySchema,
  repeatShortfallListSchema,
  saveLinesInputSchema,
  saveLinesResultSchema,
  sectionItemsSchema,
  sectionOrderInputSchema,
  seenInputSchema,
  settingsPreviewSchema,
  setupViewSchema,
  signInputSchema,
  signPreviewSchema,
  startCountInputSchema,
  startOptionsSchema,
  updateDirectorAlertInputSchema,
  updateSettingsInputSchema,
} from './counting-contract';

const F = fixtures as Record<string, unknown>;

describe('counting contract fixtures', () => {
  it.each([
    ['attendantCountDetail', countDetailSchema],
    ['managerCountDetail', countDetailSchema],
    ['countsSummaryManager', countsSummarySchema],
    ['countsList', countsListSchema],
    ['countsHome', countsHomeSchema],
    ['myCountsList', myCountsListSchema],
    ['flaggedList', flaggedListSchema],
    ['repeatShortfallList', repeatShortfallListSchema],
    ['countRecordPrint', countRecordPrintSchema],
    ['blankSheet', blankSheetSchema],
    ['startOptionsAttendant', startOptionsSchema],
    ['startCountInput', startCountInputSchema],
    ['recountStartInput', startCountInputSchema],
    ['saveLinesInput', saveLinesInputSchema],
    ['saveLinesResultAttendant', saveLinesResultSchema],
    ['saveLinesResultManager', saveLinesResultSchema],
    ['checkInput', checkInputSchema],
    ['checkResult', checkResultSchema],
    ['signPreviewAttendant', signPreviewSchema],
    ['signPreviewManager', signPreviewSchema],
    ['signInput', signInputSchema],
    ['sectionOrderInput', sectionOrderInputSchema],
    ['setupView', setupViewSchema],
    ['sectionItems', sectionItemsSchema],
    ['layoutInput', layoutInputSchema],
    ['addItemsList', addItemsListSchema],
    ['addItemsInput', addItemsInputSchema],
    ['moveItemInput', moveItemInputSchema],
    ['countSettings', countSettingsSchema],
    ['settingsPreview', settingsPreviewSchema],
    ['updateSettingsInput', updateSettingsInputSchema],
    ['updateDirectorAlertInput', updateDirectorAlertInputSchema],
    ['decisionInputWriteOff', decisionInputSchema],
    ['decisionInputMovement', decisionInputSchema],
    ['decisionInputAcceptGroup', decisionInputSchema],
    ['approvePreview', approvePreviewSchema],
    ['approveInput', approveInputSchema],
    ['seenInput', seenInputSchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'counting-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(
      join(__dirname, '../../../../../../frontend/features/inventory/counting/_shared/types/counting-contract.fixtures.json'),
      'utf8',
    );
    expect(theirs).toBe(mine);
  });
});

describe('the blind rule in the Attendant payloads', () => {
  const stockKeys = new Set<string>(COUNT_STOCK_FIGURE_KEYS);
  const leaks = (value: object): string[] => Object.keys(value).filter((k) => stockKeys.has(k));

  it('an Attendant count detail has no stock-figure key at the top or on any line', () => {
    const detail = fixtures.attendantCountDetail;
    expect(leaks(detail)).toEqual([]);
    for (const line of detail.lines) expect(leaks(line)).toEqual([]);
  });

  it('an Attendant save result and sign preview carry no figure', () => {
    expect(leaks(fixtures.saveLinesResultAttendant)).toEqual([]);
    expect(leaks(fixtures.signPreviewAttendant)).toEqual([]);
  });

  it('the home and My counts payloads carry no stock-figure key', () => {
    const home = fixtures.countsHome;
    for (const o of [home, home.sections, fixtures.myCountsList, ...fixtures.myCountsList.rows]) expect(leaks(o)).toEqual([]);
  });

  it('the Manager detail carries the figures the Attendant must never get', () => {
    expect(leaks(fixtures.managerCountDetail).length).toBeGreaterThan(0);
    expect(leaks(fixtures.managerCountDetail.lines[0]!)).toEqual(expect.arrayContaining(['expectedQty', 'difference', 'result', 'story']));
  });

  it('the section-end check names items and the typed number only', () => {
    for (const item of fixtures.checkResult.items) {
      expect(Object.keys(item).sort()).toEqual(['counted', 'itemName', 'lineId', 'sectionName', 'unit']);
    }
  });
});

describe('inputs that must be refused', () => {
  it('starting a count needs at least one section, item or recount line', () => {
    expect(startCountInputSchema.safeParse({ idempotencyKey: 'abcdefgh' }).success).toBe(false);
  });

  it('a counted number is never negative', () => {
    const bad = { lines: [{ lineId: 'a0000000-0000-4000-8000-000000000004', countedQty: '-1', skipped: false }] };
    expect(saveLinesInputSchema.safeParse(bad).success).toBe(false);
  });

  it('a PIN is 4 to 8 digits', () => {
    expect(signInputSchema.safeParse({ ...fixtures.signInput, pin: '123' }).success).toBe(false);
    expect(signInputSchema.safeParse({ ...fixtures.signInput, pin: '12ab' }).success).toBe(false);
  });

  it('"Other" needs a note', () => {
    const noNote = { lineIds: ['a0000000-0000-4000-8000-000000000001'], decision: { kind: 'WRITE_OFF', cause: 'OTHER' } };
    expect(decisionInputSchema.safeParse(noNote).success).toBe(false);
    expect(decisionInputSchema.safeParse({ ...noNote, decision: { kind: 'WRITE_OFF', cause: 'OTHER', note: 'Bag split' } }).success).toBe(true);
  });

  it('a decision names lines or a group, not both and not neither', () => {
    const both = { lineIds: ['a0000000-0000-4000-8000-000000000001'], group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } };
    expect(decisionInputSchema.safeParse(both).success).toBe(false);
    expect(decisionInputSchema.safeParse({ decision: { kind: 'ACCEPTED' } }).success).toBe(false);
  });

  it('the pager only allows 25, 50 or 100 rows', () => {
    expect(countsListQuerySchema.safeParse({ pageSize: '50' }).success).toBe(true);
    expect(countsListQuerySchema.safeParse({ pageSize: '30' }).success).toBe(false);
    expect(countsListQuerySchema.parse({}).pageSize).toBe(50);
  });

  it('My counts takes waiting, approved or all, Nairobi days, and the numbered pager', () => {
    expect(myCountsQuerySchema.parse({}).status).toBe('all');
    expect(myCountsQuerySchema.safeParse({ status: 'inProgress' }).success).toBe(false);
    expect(myCountsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-09', pageSize: '25' }).success).toBe(true);
    expect(myCountsQuerySchema.safeParse({ from: '9 Oct' }).success).toBe(false);
    expect(myCountsQuerySchema.safeParse({ pageSize: '30' }).success).toBe(false);
  });

  it('the range percent stays between 0 and 100', () => {
    expect(updateSettingsInputSchema.safeParse({ rangeKes: 500, rangePercent: '101', flagRepeatShortfalls: true }).success).toBe(false);
  });
});
