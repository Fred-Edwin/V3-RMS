import { describe, expect, it } from 'vitest';
import fixtures from './counting-contract.fixtures.json';
import { COUNT_STOCK_FIGURE_KEYS } from './counting-contract';
import type {
  ApprovePreview,
  BlankSheet,
  CountDetail,
  CountRecordPrint,
  CountSettings,
  CountsList,
  CountsSummary,
  FlaggedList,
  RepeatShortfallList,
  SetupView,
  SignPreview,
  StartOptions,
} from './counting-contract';

/**
 * Drift guard for the hand-written mirror: the same sample payloads the back end parses with Zod are typed with the
 * mirror types here (the build fails if a field's type changes) and their key sets are pinned (a field added or dropped
 * on one side fails this test).
 */
const keysOf = (o: object): string[] => Object.keys(o).sort();

describe('counting contract mirror', () => {
  it('CountDetail keys', () => {
    const detail = fixtures.managerCountDetail as CountDetail;
    expect(keysOf(detail)).toEqual(
      [
        'approvedAt', 'approver', 'can', 'counter', 'expectedAsOf', 'figures', 'id', 'lines', 'progress', 'range', 'recountOf', 'reference',
        'savedAt', 'scope', 'sections', 'selfSigned', 'signedAt', 'startedAt', 'status', 'statusText', 'timeline', 'tracker',
      ].sort(),
    );
    expect(keysOf(detail.can)).toEqual(['approve', 'count', 'decide', 'print', 'sign']);
    expect(keysOf(detail.figures as object)).toEqual(['counted', 'decided', 'exceeds', 'netDifferenceKes', 'notCounted', 'toDecide', 'withinRange', 'withinRangeNetKes']);
  });

  it('an Attendant count detail has none of the stock-figure keys', () => {
    const detail = fixtures.attendantCountDetail as CountDetail;
    const stockKeys = new Set<string>(COUNT_STOCK_FIGURE_KEYS);
    expect(Object.keys(detail).filter((k) => stockKeys.has(k))).toEqual([]);
    for (const line of detail.lines) expect(Object.keys(line).filter((k) => stockKeys.has(k))).toEqual([]);
  });

  it('CountLine keys for the Manager add the figures', () => {
    const line = (fixtures.managerCountDetail as CountDetail).lines[0]!;
    for (const k of ['expectedQty', 'difference', 'differencePercent', 'differenceValueKes', 'result', 'story', 'suggestedCause', 'shortStreak', 'decision', 'director', 'adjustmentRef']) {
      expect(keysOf(line)).toContain(k);
    }
    expect(keysOf(line.can)).toEqual(['countAgain', 'decide']);
  });

  it('list, summary, flagged and shortfall keys', () => {
    const list = fixtures.countsList as CountsList;
    expect(keysOf(list)).toEqual(['chips', 'page', 'rows']);
    expect(keysOf(list.chips)).toEqual(['all', 'approved', 'inProgress', 'unsectioned', 'waiting']);
    expect(keysOf((fixtures.countsSummaryManager as CountsSummary).kpis[0] as object)).toEqual(['caption', 'filter', 'key', 'label', 'tone', 'value']);
    const flagged = fixtures.flaggedList as FlaggedList;
    expect(keysOf(flagged.chips)).toEqual(['allCounts', 'flaggedToMe', 'repeatShortfalls']);
    expect(keysOf((fixtures.repeatShortfallList as RepeatShortfallList).rows[0] as object)).toEqual(['itemId', 'itemName', 'lastCounts', 'sectionName', 'shortRuns', 'unit']);
  });

  it('start options, sign preview, approve preview keys', () => {
    expect(keysOf(fixtures.startOptionsAttendant as StartOptions)).toEqual(['can', 'openCount', 'order', 'recount', 'sections', 'unsectionedCount']);
    expect(keysOf(fixtures.signPreviewAttendant as SignPreview)).toEqual(['itemCount', 'skipped', 'zero']);
    expect(keysOf(fixtures.signPreviewManager as SignPreview)).toEqual(['figures', 'itemCount', 'skipped', 'zero']);
    expect(keysOf(fixtures.approvePreview as ApprovePreview)).toEqual(['adjustments', 'directorNote', 'netKes', 'notCountedNote', 'rows', 'withinRange']);
  });

  it('setup, settings and print keys', () => {
    expect(keysOf(fixtures.setupView as SetupView)).toEqual(['can', 'movedSinceLastVisit', 'movedText', 'sections', 'unsectioned', 'version']);
    expect(keysOf(fixtures.countSettings as CountSettings)).toEqual([
      'alertUpdatedAt', 'alertUpdatedBy', 'can', 'directorAlertKes', 'flagRepeatShortfalls', 'rangeKes', 'rangePercent', 'rangeUpdatedAt', 'rangeUpdatedBy',
    ]);
    expect(keysOf(fixtures.countRecordPrint as CountRecordPrint)).toEqual([
      'counted', 'counterName', 'differences', 'footnote', 'generatedText', 'netValueKes', 'reference', 'rows', 'sectionsText', 'signatures', 'timeText', 'total',
    ]);
    expect(keysOf(fixtures.blankSheet as BlankSheet)).toEqual(['dateText', 'printedAtText', 'sections']);
  });

  it('every quantity and money value in the samples is a string', () => {
    const line = (fixtures.managerCountDetail as CountDetail).lines[0]!;
    expect(typeof line.countedQty).toBe('string');
    expect(typeof line.expectedQty).toBe('string');
    expect(typeof line.differenceValueKes).toBe('string');
    expect(typeof (fixtures.managerCountDetail as CountDetail).figures?.netDifferenceKes).toBe('string');
  });
});
