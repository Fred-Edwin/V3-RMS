/**
 * Contract drift guard for Deliveries (V1 to V6): the shared sample payloads parse against the frozen Zod schemas, bad inputs are
 * refused, NO sent figure appears in any response before the confirm preview (V5), and the front end's fixtures are byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './deliveries-contract.fixtures.json';
import {
  checkCountResultSchema,
  confirmDeliveryInputSchema,
  confirmDeliveryResultSchema,
  confirmPreviewSchema,
  countLineSchema,
  countViewSchema,
  DELIVERY_ERROR_CODES,
  listDeliveriesQuerySchema,
  listDeliveriesSchema,
  saveCountInputSchema,
  setReasonInputSchema,
  deletePhotoResultSchema,
  uploadPhotoFieldsSchema,
  uploadPhotoResultSchema,
} from './deliveries-contract';
import { errorBodySchema, PHOTO_MAX_BYTES, PHOTO_MAX_PER_LINE } from '../../dispatch/_shared/dispatch-contract';

const F = fixtures as Record<string, unknown>;

describe('deliveries contract fixtures', () => {
  it.each([
    ['listQuery', listDeliveriesQuerySchema],
    ['listWaiting', listDeliveriesSchema],
    ['listPastBranchManager', listDeliveriesSchema],
    ['countView', countViewSchema],
    ['countViewNothingCounted', countViewSchema],
    ['saveCountInput', saveCountInputSchema],
    ['checkCountFirst', checkCountResultSchema],
    ['checkCountFinal', checkCountResultSchema],
    ['setReasonInput', setReasonInputSchema],
    ['setReasonInputOther', setReasonInputSchema],
    ['countLineWithReason', countLineSchema],
    ['uploadPhotoFields', uploadPhotoFieldsSchema],
    ['uploadPhotoResult', uploadPhotoResultSchema],
    ['deletePhotoResult', deletePhotoResultSchema],
    ['confirmPreview', confirmPreviewSchema],
    ['confirmInput', confirmDeliveryInputSchema],
    ['confirmInputOnBehalf', confirmDeliveryInputSchema],
    ['confirmResult', confirmDeliveryResultSchema],
    ['confirmResultAllMatched', confirmDeliveryResultSchema],
    ['errorInvalidPin', errorBodySchema],
    ['errorAlreadyConfirmed', errorBodySchema],
    ['errorRecountUsed', errorBodySchema],
    ['errorNotCounted', errorBodySchema],
    ['errorCountAgainPending', errorBodySchema],
    ['errorReasonRequired', errorBodySchema],
    ['errorTooManyPhotos', errorBodySchema],
    ['errorPhotoTooLarge', errorBodySchema],
    ['errorNotYourDepartment', errorBodySchema],
    ['errorDispatchCancelled', errorBodySchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('every error fixture uses a code the contract lists', () => {
    const errorFixtures = Object.keys(F).filter((name) => name.startsWith('error'));
    expect(errorFixtures).toHaveLength(10);
    for (const name of errorFixtures) {
      const code = (F[name] as { error: { code: string } }).error.code;
      expect(DELIVERY_ERROR_CODES as readonly string[]).toContain(code);
    }
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'deliveries-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(join(__dirname, '../../../../../../frontend/features/inventory/deliveries/_shared/types/deliveries-contract.fixtures.json'), 'utf8');
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
/**
 * Names that carry, or could stand in for, what was sent. `gapCount` (the number of differing lines on a confirmed history row, G2)
 * is allowed: it only appears after the counts are final and the summary has revealed the figures; the waiting row holds null.
 */
const SENT_FIGURE = /sentQty|expected|gapQty|requested|dispatched/i;
/** The responses a person sees BEFORE the confirm preview: none may carry the sent figure. */
const BLIND = [
  'listWaiting',
  'listPastBranchManager',
  'countView',
  'countViewNothingCounted',
  'checkCountFirst',
  'checkCountFinal',
  'countLineWithReason',
  'uploadPhotoResult',
];

describe('blind rule: no sent figure before the summary', () => {
  it.each(BLIND)('%s carries no sent figure, no gap and no stand-in', (name) => {
    // `signedAt` and `signedBy` are who and when, not what: allowed. Everything else that smells of a quantity sent is not.
    const bad = allKeys(F[name]).filter((k) => SENT_FIGURE.test(k));
    expect(bad).toEqual([]);
  });

  it('the branch never sees money, even in the summary and the result', () => {
    for (const name of [...BLIND, 'confirmPreview', 'confirmResult', 'confirmResultAllMatched']) {
      expect(allKeys(F[name]).filter((k) => MONEY.test(k)), name).toEqual([]);
    }
  });

  it('the confirm preview is where the sent figure first appears, with the gap and the direction', () => {
    const line = fixtures.confirmPreview.differingLines[0]!;
    expect(line.sentQty).toBe('24');
    expect(line.gapQty).toBe('-2');
    expect(line.direction).toBe('SHORT');
  });

  it('the first check flags a difference without saying which way; the second makes it final with a direction', () => {
    expect(fixtures.checkCountFirst.differing[0]!.state).toBe('COUNT_AGAIN');
    expect(fixtures.checkCountFirst.final).toBe(false);
    expect(fixtures.checkCountFinal.differing[0]!.state).toBe('SHORT');
    expect(fixtures.checkCountFinal.final).toBe(true);
  });

  it('a check lists the differing lines by name and typed number, with the direction (never the size)', () => {
    expect(Object.keys(fixtures.checkCountFirst.differing[0]!).sort()).toEqual(['countedQty', 'direction', 'itemName', 'lineId', 'state']);
    expect(fixtures.checkCountFirst.differing[0]!.direction).toBe('SHORT');
  });

  it('a waiting row has no gap count yet; only a confirmed history row does', () => {
    expect(fixtures.listWaiting.rows[0]!.gapCount).toBeNull();
    expect(fixtures.listPastBranchManager.rows.every((r) => typeof r.gapCount === 'number')).toBe(true);
  });

  it('nothing is pre-filled: an uncounted line has no number', () => {
    for (const line of fixtures.countViewNothingCounted.lines) {
      expect(line.countedQty).toBeNull();
      expect(line.state).toBe('NOT_COUNTED');
      expect(line.attempt).toBe(0);
    }
  });
});

describe('inputs that must be refused', () => {
  it('a saved count is not negative, a line is listed once, and the body is strict', () => {
    const c = fixtures.saveCountInput.counts[0]!;
    expect(saveCountInputSchema.safeParse({ counts: [{ ...c, countedQty: '-1' }] }).success).toBe(false);
    expect(saveCountInputSchema.safeParse({ counts: [{ ...c, countedQty: '0' }] }).success).toBe(true);
    expect(saveCountInputSchema.safeParse({ counts: [c, c] }).success).toBe(false);
    expect(saveCountInputSchema.safeParse({ counts: [{ ...c, sentQty: '12' }] }).success).toBe(false);
    expect(saveCountInputSchema.safeParse({ counts: [] }).success).toBe(false);
  });

  it('a reason is one of the four chips; a note is optional and at most 200 characters', () => {
    expect(setReasonInputSchema.safeParse({ reason: 'LOST' }).success).toBe(false);
    expect(setReasonInputSchema.safeParse({ reason: 'DAMAGED' }).success).toBe(true);
    expect(setReasonInputSchema.safeParse({ reason: 'OTHER', note: 'x'.repeat(201) }).success).toBe(false);
  });

  it('confirming needs a PIN and a key; onBehalf is optional; unknown keys are refused', () => {
    expect(confirmDeliveryInputSchema.safeParse({ pin: '3318' }).success).toBe(false);
    expect(confirmDeliveryInputSchema.safeParse({ ...fixtures.confirmInput, pin: '33' }).success).toBe(false);
    expect(confirmDeliveryInputSchema.safeParse({ ...fixtures.confirmInput, departmentId: 'x' }).success).toBe(false);
    expect(confirmDeliveryInputSchema.safeParse(fixtures.confirmInput).success).toBe(true);
  });

  it('the list defaults to the waiting tab and refuses an unknown tab or result', () => {
    expect(listDeliveriesQuerySchema.parse({})).toMatchObject({ tab: 'waiting', page: 1, pageSize: 50 });
    expect(listDeliveriesQuerySchema.safeParse({ tab: 'done' }).success).toBe(false);
    expect(listDeliveriesQuerySchema.safeParse({ result: 'LOST' }).success).toBe(false);
  });

  it('photo limits are 3 per line and 5 MB, and the upload names its line', () => {
    expect(PHOTO_MAX_PER_LINE).toBe(3);
    expect(PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(uploadPhotoFieldsSchema.safeParse({}).success).toBe(false);
    expect(uploadPhotoResultSchema.safeParse({ ...fixtures.uploadPhotoResult, photo: { id: 'not-a-uuid', url: '/x' } }).success).toBe(false);
    expect(uploadPhotoResultSchema.safeParse({ ...fixtures.uploadPhotoResult, photo: { id: fixtures.uploadPhotoResult.photo.id } }).success).toBe(false);
  });
});

/** Dispatch Amendment 1 (docs/features/inventory/dispatch-amendment-1.md), the branch side. */
describe('Amendment 1', () => {
  it('row 1: arrivedAt is information on the row, the count view and the result; null before anyone opens the delivery', () => {
    expect(fixtures.listWaiting.rows[0]!.arrivedAt).toBeNull();
    expect(Object.keys(fixtures.countView)).toContain('arrivedAt');
    expect(Object.keys(fixtures.confirmResult)).toEqual(expect.arrayContaining(['signedAt', 'arrivedAt', 'confirmedAt']));
  });

  it('row 5: V2 reports each line\'s saved count, the direction and whether the recount was used', () => {
    for (const line of fixtures.countView.lines) expect(Object.keys(line)).toEqual(expect.arrayContaining(['countedQty', 'recountUsed', 'direction', 'attempt']));
    expect(fixtures.countView.lines.find((l) => l.state === 'COUNT_AGAIN')!.recountUsed).toBe(false);
    expect(fixtures.checkCountFinal.view.lines[0]!.recountUsed).toBe(true);
  });

  it('row 6: a photo is { id, url }, and there is a delete result', () => {
    expect(Object.keys(fixtures.uploadPhotoResult.photo).sort()).toEqual(['id', 'url']);
    expect(fixtures.deletePhotoResult.photos).toEqual([]);
  });

  it('row 10: V1 rows carry the cycle, carrier, arrivedAt, the confirmer\'s title, the result and the gap count', () => {
    for (const row of [...fixtures.listWaiting.rows, ...fixtures.listPastBranchManager.rows]) {
      expect(Object.keys(row)).toEqual(
        expect.arrayContaining(['reference', 'department', 'cycle', 'lineCount', 'signedAt', 'carrier', 'arrivedAt', 'confirmedAt', 'confirmedByTitle', 'result', 'gapCount']),
      );
    }
    expect(listDeliveriesQuerySchema.parse({ result: 'MATCHED' }).result).toBe('MATCHED');
    expect(listDeliveriesQuerySchema.safeParse({ result: 'ALL_MATCHED' }).success).toBe(false);
    expect(fixtures.listPastBranchManager.rows.map((r) => r.result)).toEqual(['GAP_OPEN', 'MATCHED']);
  });

  it('row 11: the renamed codes are the amendment names', () => {
    for (const code of ['ALREADY_CONFIRMED', 'NOT_COUNTED', 'RECOUNT_USED', 'REASON_REQUIRED', 'NOT_YOUR_DEPARTMENT', 'DISPATCH_CANCELLED', 'TOO_MANY_PHOTOS', 'PHOTO_TOO_LARGE']) {
      expect(DELIVERY_ERROR_CODES as readonly string[]).toContain(code);
    }
    for (const gone of ['COUNT_FINAL', 'NOT_ALL_COUNTED', 'REASON_MISSING']) expect(DELIVERY_ERROR_CODES as readonly string[]).not.toContain(gone);
  });
});

describe('who confirms', () => {
  it('a row says what the caller may do; the Branch Manager row can confirm on behalf, a member row can count', () => {
    expect(fixtures.listWaiting.rows[0]!.can).toEqual({ count: true, confirmOnBehalf: false });
    expect(Object.keys(fixtures.listPastBranchManager.rows[0]!.can).sort()).toEqual(['confirmOnBehalf', 'count']);
  });

  it('an on-behalf result records the real signer and the department they signed for', () => {
    expect(fixtures.confirmResultAllMatched.onBehalfOfDepartment).not.toBeNull();
    expect(fixtures.confirmResultAllMatched.confirmedBy.roleLabel).toBe('Branch Manager');
  });

  it('a clean count closes; a gap leaves one DSC- per differing line', () => {
    expect(fixtures.confirmResultAllMatched.status).toBe('CLOSED');
    expect(fixtures.confirmResultAllMatched.discrepancies).toEqual([]);
    expect(fixtures.confirmResult.status).toBe('CONFIRMED');
    expect(fixtures.confirmResult.discrepancies).toHaveLength(fixtures.confirmResult.lineCount - fixtures.confirmResult.matchedCount);
  });
});
