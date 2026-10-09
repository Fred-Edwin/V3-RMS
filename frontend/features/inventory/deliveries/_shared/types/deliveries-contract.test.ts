import { describe, expect, it } from 'vitest';
import fixtures from './deliveries-contract.fixtures.json';
import { DELIVERY_ERROR_CODES } from './deliveries-contract';
import type { CheckCountResult, ConfirmDeliveryResult, ConfirmPreview, CountView, DeliveryFile, ListDeliveries } from './deliveries-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror types, key sets are pinned, and the blind rule holds. */
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
/** `gapCount` (differing lines on a confirmed history row) is allowed: it appears only after the summary has revealed the figures; a waiting row holds null. */
const SENT_FIGURE = /sentQty|expected|gapQty|requested|dispatched/i;
const BLIND = ['listWaiting', 'listPastBranchManager', 'countView', 'countViewNothingCounted', 'checkCountFirst', 'checkCountFinal', 'countLineWithReason', 'uploadPhotoResult'];

describe('deliveries contract mirror', () => {
  it('list and count view keys', () => {
    const list = fixtures.listWaiting as ListDeliveries;
    expect(keysOf(list)).toEqual(['page', 'rows', 'tab', 'tabCounts']);
    expect(keysOf(list.rows[0]!)).toEqual([
      'arrivedAt', 'can', 'carrier', 'confirmedAt', 'confirmedBy', 'confirmedByTitle', 'countStarted', 'cycle', 'department', 'gapCount', 'id', 'lineCount', 'reference', 'result', 'signedAt', 'stage',
    ]);
    const view = fixtures.countView as CountView;
    expect(keysOf(view)).toEqual(['arrivedAt', 'branch', 'canCheck', 'countAgainCount', 'countedCount', 'department', 'id', 'lineCount', 'lines', 'onBehalfOfDepartment', 'reference', 'signedAt']);
    expect(keysOf(view.lines[0]!)).toEqual(['attempt', 'categoryPath', 'countedQty', 'direction', 'itemName', 'lineId', 'photos', 'reason', 'reasonNote', 'recountUsed', 'state', 'unit']);
  });

  it('Amendment 1: photos are { id, url }, the delete result keeps the rest, the recount flag and direction ride on the line', () => {
    expect(keysOf((fixtures.uploadPhotoResult as { photo: object }).photo)).toEqual(['id', 'url']);
    expect(fixtures.deletePhotoResult.photos).toEqual([]);
    expect((fixtures.countView as CountView).lines.find((l) => l.state === 'COUNT_AGAIN')!.recountUsed).toBe(false);
    expect((fixtures.checkCountFinal as CheckCountResult).view.lines[0]!.recountUsed).toBe(true);
  });

  it('the check lists the differing lines by name and typed number only', () => {
    const check = fixtures.checkCountFirst as CheckCountResult;
    expect(keysOf(check)).toEqual(['differing', 'final', 'reasonsComplete', 'view']);
    expect(keysOf(check.differing[0]!)).toEqual(['countedQty', 'direction', 'itemName', 'lineId', 'state']);
    expect(check.differing[0]!.state).toBe('COUNT_AGAIN');
    expect((fixtures.checkCountFinal as CheckCountResult).differing[0]!.state).toBe('SHORT');
  });

  it.each(BLIND)('%s carries no sent figure, no gap and no stand-in', (name) => {
    expect(allKeys((fixtures as Record<string, unknown>)[name]).filter((k) => SENT_FIGURE.test(k))).toEqual([]);
  });

  it('the branch never sees money', () => {
    for (const name of [...BLIND, 'confirmPreview', 'confirmResult', 'confirmResultAllMatched']) {
      expect(allKeys((fixtures as Record<string, unknown>)[name]).filter((k) => MONEY.test(k))).toEqual([]);
    }
  });

  it('the sent figure first appears in the confirm preview', () => {
    const preview = fixtures.confirmPreview as ConfirmPreview;
    expect(keysOf(preview.differingLines[0]!)).toEqual(['countedQty', 'direction', 'gapQty', 'itemName', 'lineId', 'photoCount', 'reason', 'reasonNote', 'sentQty', 'unit']);
  });

  it('the confirm result', () => {
    const result = fixtures.confirmResult as ConfirmDeliveryResult;
    expect(keysOf(result)).toEqual(['arrivedAt', 'confirmedAt', 'confirmedBy', 'discrepancies', 'id', 'lineCount', 'matchedCount', 'onBehalfOfDepartment', 'reference', 'replayed', 'signedAt', 'status']);
    expect((fixtures.confirmResultAllMatched as ConfirmDeliveryResult).onBehalfOfDepartment).not.toBeNull();
  });

  it('V7: the department file, typed with the dispatch mirror, shows no sent figure, gap or money before the count is signed', () => {
    const blind: DeliveryFile = fixtures.fileMemberBlind as DeliveryFile;
    expect(blind.sentVisible).toBe(false);
    expect(blind.shortCount).toBe(0);
    expect(blind.items.every((i) => i.sentQty === undefined && i.gapQty === undefined)).toBe(true);
    expect(allKeys(blind).filter((k) => MONEY.test(k))).toEqual([]);
    const counted: DeliveryFile = fixtures.fileMemberCounted as DeliveryFile;
    expect(counted.sentVisible).toBe(true);
    expect(counted.items.map((i) => i.gapQty)).toEqual(['0', '-1']);
    expect(allKeys(counted).filter((k) => MONEY.test(k))).toEqual([]);
    expect(blind.can.print || counted.can.print).toBe(false);
  });

  it('every error fixture uses a listed code', () => {
    for (const name of Object.keys(fixtures).filter((n) => n.startsWith('error'))) {
      const code = (fixtures as unknown as Record<string, { error: { code: string } }>)[name]?.error.code ?? '';
      expect(DELIVERY_ERROR_CODES as readonly string[]).toContain(code);
    }
  });
});
