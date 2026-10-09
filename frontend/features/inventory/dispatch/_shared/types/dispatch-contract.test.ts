import { describe, expect, it } from 'vitest';
import fixtures from './dispatch-contract.fixtures.json';
import { DISPATCH_ERROR_CODES, DISPATCH_STAGES, DISPATCH_STAGE_TEXT, PHOTO_MAX_BYTES, PHOTO_MAX_PER_LINE } from './dispatch-contract';
import type { CarrierRef, DispatchFile, DispatchMine, PrintDispatch, Queue, Review, SignDispatchResult } from './dispatch-contract';

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

describe('dispatch contract mirror', () => {
  it('queue and review keys', () => {
    const queue = fixtures.queue as Queue;
    expect(keysOf(queue)).toEqual(['branchesToPack', 'cards']);
    expect(keysOf(queue.cards[0]!)).toEqual(['approvedAt', 'branch', 'cycle', 'cycleLabel', 'departments', 'lineCount', 'reference', 'requisitionId']);
    const review = fixtures.review as Review;
    expect(keysOf(review)).toEqual(['branch', 'canSign', 'carriers', 'cycleLabel', 'departments', 'lineCount', 'lines', 'packedBy', 'reference', 'requisitionId', 'shortCount', 'signedBy']);
    expect((review.carriers[0] as CarrierRef).kind).toBe('VEHICLE');
  });

  it('the sign result reports what shipped and what was left out', () => {
    const result = fixtures.signResult as SignDispatchResult;
    expect(keysOf(result)).toEqual(['branch', 'carrier', 'dispatches', 'leftOut', 'lineCount', 'packedBy', 'reference', 'replayed', 'requisitionId', 'sendBatchId', 'shortCount', 'signedAt', 'signedBy']);
    expect(result.dispatches.map((d) => d.departmentId)).not.toContain(result.leftOut[0]!.id);
  });

  it('file keys, and the Next step card carries one action and facts only', () => {
    const file = fixtures.fileHub as DispatchFile;
    expect(keysOf(file)).toEqual([
      'activity', 'branch', 'can', 'cancelled', 'carrier', 'closedAt', 'counted', 'department', 'documents', 'id', 'items', 'lineCount', 'nextStep', 'onBehalfOfDepartment', 'packed', 'reference',
      'requisition', 'sendBatchId', 'sentVisible', 'shortCount', 'siblings', 'signed', 'stage', 'status', 'tracker', 'valueKes',
    ]);
    expect(keysOf(file.nextStep)).toEqual(['action', 'facts']);
    expect(keysOf(file.nextStep.facts)).toEqual(['discrepancyId', 'gapLineCount', 'waitingSince']);
    for (const step of file.tracker) expect(keysOf(step)).toEqual(['at', 'by', 'carrier', 'key', 'state']);
  });

  it('a branch-side file before the count has no sent figure, no gap and no money total', () => {
    const file = fixtures.fileBranchManagerBlind as DispatchFile;
    expect(file.sentVisible).toBe(false);
    const keys = allKeys(file);
    for (const k of ['sentQty', 'gapQty', 'valueKes']) expect(keys).not.toContain(k);
  });

  it('the Attendant and packing payloads carry no money', () => {
    for (const payload of [fixtures.queue, fixtures.packDepartment, fixtures.review, fixtures.signResult, fixtures.fileAttendantOnTheWay, fixtures.printStore, fixtures.printBranch, fixtures.mine]) {
      expect(allKeys(payload).filter((k) => MONEY.test(k))).toEqual([]);
    }
  });

  it('the branch copy of the delivery note has no quantities', () => {
    const branch = fixtures.printBranch as PrintDispatch;
    expect(branch.copy).toBe('branch');
    expect(allKeys(branch)).not.toContain('sentQty');
    expect(allKeys(branch)).not.toContain('requestedQty');
  });

  it('the Done tab rows', () => {
    const mine = fixtures.mine as DispatchMine;
    expect(keysOf(mine)).toEqual(['page', 'rows', 'tab', 'tabCounts']);
    expect(keysOf(mine.rows[0]!)).toEqual(['branch', 'department', 'id', 'lineCount', 'reference', 'result', 'signedAt', 'stage']);
  });

  it('stages, error codes and limits', () => {
    expect(Object.keys(DISPATCH_STAGE_TEXT).sort()).toEqual([...DISPATCH_STAGES].sort());
    for (const name of Object.keys(fixtures).filter((n) => n.startsWith('error'))) {
      const code = (fixtures as Record<string, { error: { code: string } }>)[name]!.error.code;
      expect(DISPATCH_ERROR_CODES as readonly string[]).toContain(code);
    }
    expect(PHOTO_MAX_PER_LINE).toBe(3);
    expect(PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
