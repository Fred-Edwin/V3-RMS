import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './branch-day-contract.fixtures.json';
import {
  BLOCKER_KINDS,
  BLOCKER_SEVERITIES,
  BRANCH_DAY_ERROR_CODES,
  CORRECTION_REASONS,
  COUNT_STATES,
  DAY_ACTIVITY_TYPES,
  DAY_COUNT_BLIND_KEYS,
  DAY_MONEY_KEYS,
  DAY_STATUSES,
  DELIVERY_STATES,
  HOME_ACTIONS,
  OPENING_STATES,
  SHEET_KINDS,
  SHEET_ROWS_PER_PAGE,
} from './branch-day-contract';
import type {
  CloseDayResult,
  CorrectCountResult,
  CountView,
  DayActivity,
  DayFile,
  DaySheet,
  DepartmentFigures,
  History,
  Home,
  MyDay,
  OpeningResult,
  Today,
} from './branch-day-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror types, key sets are pinned, and the blind and money rules hold. */
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

/** The values of a `export const NAME = [...] as const` array in the back end's contract file. */
const backendList = (name: string): string[] => {
  const source = readFileSync(join(__dirname, '../../../../../../backend/src/modules/inventory/branch-day/_shared/branch-day-contract.ts'), 'utf8');
  const match = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(source);
  expect(match, `${name} not found in the back-end contract`).not.toBeNull();
  return Array.from((match?.[1] ?? '').matchAll(/'([A-Za-z_]+)'/g)).map((m) => m[1] as string);
};

describe('branch day contract mirror', () => {
  it('the enums and error codes equal the back end lists', () => {
    expect([...DAY_STATUSES]).toEqual(backendList('DAY_STATUSES'));
    expect([...COUNT_STATES]).toEqual(backendList('COUNT_STATES'));
    expect([...OPENING_STATES]).toEqual(backendList('OPENING_STATES'));
    expect([...DELIVERY_STATES]).toEqual(backendList('DELIVERY_STATES'));
    expect([...CORRECTION_REASONS]).toEqual(backendList('CORRECTION_REASONS'));
    expect([...HOME_ACTIONS]).toEqual(backendList('HOME_ACTIONS'));
    expect([...BLOCKER_KINDS]).toEqual(backendList('BLOCKER_KINDS'));
    expect([...BLOCKER_SEVERITIES]).toEqual(backendList('BLOCKER_SEVERITIES'));
    expect([...DAY_ACTIVITY_TYPES]).toEqual(backendList('DAY_ACTIVITY_TYPES'));
    expect([...SHEET_KINDS]).toEqual(backendList('SHEET_KINDS'));
    expect([...BRANCH_DAY_ERROR_CODES]).toEqual(backendList('BRANCH_DAY_ERROR_CODES'));
    expect([...DAY_MONEY_KEYS]).toEqual(backendList('DAY_MONEY_KEYS'));
    expect([...DAY_COUNT_BLIND_KEYS]).toEqual(backendList('DAY_COUNT_BLIND_KEYS'));
  });

  it('the sheet constant equals the back end', () => {
    const source = readFileSync(join(__dirname, '../../../../../../backend/src/modules/inventory/branch-day/_shared/branch-day-contract.ts'), 'utf8');
    expect(/export const SHEET_ROWS_PER_PAGE = (\d+);/.exec(source)?.[1]).toBe(String(SHEET_ROWS_PER_PAGE));
  });

  it('the key sets of the main shapes', () => {
    const home = fixtures.homeEvening as Home;
    expect(keysOf(home)).toEqual(['action', 'branch', 'closed', 'count', 'day', 'delivery', 'department', 'itemCount', 'opening']);
    const today = fixtures.todayBlocked as Today;
    expect(keysOf(today)).toEqual(['branch', 'can', 'day']);
    expect(keysOf(today.day!)).toEqual(['blockers', 'canClose', 'closed', 'departments', 'head', 'summary', 'usedValueKes']);
    expect(keysOf(today.day!.departments[0]!)).toEqual(['countedAt', 'countedBy', 'departmentId', 'head', 'itemCount', 'name', 'onBehalf', 'opening', 'state', 'usedValueKes']);
    expect(keysOf(today.day!.blockers[0]!)).toEqual(['at', 'department', 'discrepancies', 'dispatch', 'kind', 'lastDepartment', 'severity']);
    const figures = fixtures.departmentFigures as DepartmentFigures;
    expect(keysOf(figures.department.lines[0]!)).toEqual([
      'closingQty', 'closingValueKes', 'correction', 'itemId', 'itemName', 'openingQty', 'receivedQty', 'unit', 'unitCostKes', 'usedQty', 'usedValueKes', 'wasteQty', 'yesterdayUsedQty',
    ]);
    const closed = fixtures.closeDayResult as CloseDayResult;
    expect(keysOf(closed)).toEqual(['closedAt', 'closedBy', 'day', 'document', 'entries', 'entryCount', 'replayed', 'usedValueKes']);
    const corrected = fixtures.correctCountResult as CorrectCountResult;
    expect(keysOf(corrected)).toEqual(['day', 'document', 'entry', 'line', 'replayed', 'usedValueKes']);
    const sheet = fixtures.daySheet as DaySheet;
    expect(keysOf(sheet)).toEqual([
      'branch', 'closedAt', 'closedBy', 'correctedAt', 'corrections', 'date', 'departments', 'kind', 'notes', 'pageCount', 'printedAt', 'qrUrl', 'reference', 'totals', 'version',
    ]);
    expect(keysOf(fixtures.dayFile as DayFile)).toEqual(['branch', 'can', 'day', 'lastCorrection', 'rail', 'tabCounts', 'tracker', 'usedValueKes']);
    expect(keysOf(fixtures.history as History)).toEqual(['page', 'rows']);
    expect(keysOf(fixtures.dayActivity as DayActivity)).toEqual(['entries', 'total']);
  });

  it('the opening view and result carry last night and what was accepted', () => {
    const result = fixtures.openingResult as OpeningResult;
    expect(result.view.check.state).toBe('RECOUNTED');
    expect(result.view.check.differences[0]!.difference).toBe('-1');
    expect(keysOf(result.view.lines[0]!)).toEqual(['acceptedQty', 'itemId', 'itemName', 'lastNightQty', 'unit']);
  });

  it('a head or member never receives money, and the blind count carries nothing to count against', () => {
    const heads = ['homeMorning', 'homeEvening', 'homeSent', 'openingView', 'openingResult', 'recountPreview', 'countView', 'countViewOnBehalf', 'saveCountResult', 'signCountResult', 'myHistory', 'myDay'];
    for (const name of heads) {
      const keys = allKeys((fixtures as Record<string, unknown>)[name]);
      expect(keys.filter((k) => MONEY.test(k)), name).toEqual([]);
      expect(keys.filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k)), name).toEqual([]);
    }
    for (const name of ['countView', 'countViewOnBehalf', 'saveCountResult', 'signCountResult']) {
      expect(allKeys((fixtures as Record<string, unknown>)[name]).filter((k) => (DAY_COUNT_BLIND_KEYS as readonly string[]).includes(k)), name).toEqual([]);
    }
    const past = fixtures.myDay as MyDay;
    expect(keysOf(past.lines[0]!)).toEqual(['closingQty', 'itemName', 'openingQty', 'receivedQty', 'unit', 'usedQty', 'wasteQty']);
  });

  it('the blind count has the shape of the Paper B3 screens and the on-behalf count says so', () => {
    const view = fixtures.countView as CountView;
    expect(keysOf(view)).toEqual(['canSign', 'day', 'department', 'lines', 'onBehalfOfDepartment', 'signedAt', 'signedBy', 'state', 'summary']);
    expect(keysOf(view.lines[0]!)).toEqual(['categoryPath', 'countedQty', 'itemId', 'itemName', 'unit']);
    expect(view.canSign).toBe(false);
    expect((fixtures.countViewOnBehalf as CountView).onBehalfOfDepartment).toBe(true);
  });

  it('Today for a hub role is read only', () => {
    const hub = fixtures.todayHub as Today;
    expect(hub.can).toEqual({ close: false, countOnBehalf: false });
    expect(hub.branches).toHaveLength(2);
    expect((fixtures.todayNoDay as Today).day).toBeNull();
  });
});
