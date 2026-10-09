/**
 * Contract drift guard for Discrepancies (Q1 to Q5): the shared sample payloads parse against the frozen Zod schemas, bad inputs are
 * refused, the finding rules (which finding fits which gap, whom it is recorded against) hold, money is capability-gated, and the
 * front end's copy of the fixtures is byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './discrepancies-contract.fixtures.json';
import {
  DISCREPANCY_ERROR_CODES,
  discrepancyFileSchema,
  FINDINGS,
  FINDINGS_FOR,
  FINDING_PROFILE,
  FINDING_TEXT,
  findingPreviewQuerySchema,
  findingPreviewSchema,
  listDiscrepanciesQuerySchema,
  listDiscrepanciesSchema,
  recordFindingInputSchema,
  recordFindingResultSchema,
  reverseFindingInputSchema,
  reverseFindingResultSchema,
} from './discrepancies-contract';
import { errorBodySchema } from '../../dispatch/_shared/dispatch-contract';

const F = fixtures as Record<string, unknown>;

describe('discrepancies contract fixtures', () => {
  it.each([
    ['listQuery', listDiscrepanciesQuerySchema],
    ['listOpen', listDiscrepanciesSchema],
    ['listSettledBranchManager', listDiscrepanciesSchema],
    ['fileOpen', discrepancyFileSchema],
    ['fileReversedBackToOpen', discrepancyFileSchema],
    ['fileDepartmentHead', discrepancyFileSchema],
    ['findingPreviewQuery', findingPreviewQuerySchema],
    ['findingPreviewPackedShort', findingPreviewSchema],
    ['findingPreviewLost', findingPreviewSchema],
    ['recordFindingInput', recordFindingInputSchema],
    ['recordFindingResult', recordFindingResultSchema],
    ['reverseFindingInput', reverseFindingInputSchema],
    ['reverseFindingResult', reverseFindingResultSchema],
    ['errorFindingAlreadyRecorded', errorBodySchema],
    ['errorFindingNotAllowed', errorBodySchema],
    ['errorInvalidPin', errorBodySchema],
    ['errorFindingNotReversible', errorBodySchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('every error fixture uses a code the contract lists, and the contract lists every code a fixture uses', () => {
    const errorFixtures = Object.keys(F).filter((name) => name.startsWith('error'));
    expect(errorFixtures).toHaveLength(4);
    for (const name of errorFixtures) {
      const code = (F[name] as { error: { code: string } }).error.code;
      expect(DISCREPANCY_ERROR_CODES as readonly string[]).toContain(code);
    }
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'discrepancies-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(join(__dirname, '../../../../../../frontend/features/inventory/discrepancies/_shared/types/discrepancies-contract.fixtures.json'), 'utf8');
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

describe('money is capability-gated and absent, not null, without it', () => {
  it('a department head file carries no money anywhere', () => {
    expect(allKeys(fixtures.fileDepartmentHead).filter((k) => MONEY.test(k))).toEqual([]);
    expect(Object.keys(fixtures.fileDepartmentHead)).not.toContain('valueKes');
  });

  it('the hub file and a LOSS finding carry money; a packing error carries none on the recorded finding', () => {
    expect(Object.keys(fixtures.fileOpen)).toContain('valueKes');
    expect(Object.keys(fixtures.findingPreviewLost)).toContain('lossValueKes');
    expect(Object.keys(fixtures.findingPreviewPackedShort)).not.toContain('lossValueKes');
    expect(Object.keys(fixtures.recordFindingResult.finding)).not.toContain('lossValueKes');
    expect(Object.keys(fixtures.listSettledBranchManager.rows[0]!.finding!)).toContain('lossValueKes');
  });

  it('the open list rows carry no money (only a settled finding can)', () => {
    expect(allKeys(fixtures.listOpen).filter((k) => MONEY.test(k))).toEqual([]);
  });
});

describe('the findings (discrepancies.md)', () => {
  it('there are five findings with a name each; D21 draws four names, the Extra one is the contract wording', () => {
    expect([...FINDINGS].sort()).toEqual(['BRANCH_COUNTED_WRONG', 'CANT_TELL', 'LOST_OR_DAMAGED', 'PACKED_MORE', 'PACKED_SHORT']);
    expect(FINDING_TEXT.PACKED_SHORT).toBe('Packed short at the store');
    expect(FINDING_TEXT.LOST_OR_DAMAGED).toBe('Lost or damaged on the way');
    expect(FINDING_TEXT.BRANCH_COUNTED_WRONG).toBe('Branch counted wrong');
    expect(FINDING_TEXT.CANT_TELL).toBe("Can't tell");
  });

  it('a short line takes four findings, an extra line three, and the two shared ones are shared', () => {
    expect(FINDINGS_FOR.SHORT).toEqual(['PACKED_SHORT', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL']);
    expect(FINDINGS_FOR.EXTRA).toEqual(['PACKED_MORE', 'BRANCH_COUNTED_WRONG', 'CANT_TELL']);
    expect(FINDINGS_FOR.SHORT).not.toContain('PACKED_MORE');
    expect(FINDINGS_FOR.EXTRA).not.toContain('PACKED_SHORT');
    expect(FINDINGS_FOR.EXTRA).not.toContain('LOST_OR_DAMAGED');
  });

  it('whom each finding is recorded against, and which count as a loss (D21)', () => {
    expect(FINDING_PROFILE.PACKED_SHORT).toEqual({ against: 'STORE', lossKind: 'PACKING_ERROR' });
    expect(FINDING_PROFILE.LOST_OR_DAMAGED).toEqual({ against: 'CARRIER', lossKind: 'LOSS' });
    expect(FINDING_PROFILE.BRANCH_COUNTED_WRONG).toEqual({ against: 'RECEIVER', lossKind: 'NONE' });
    expect(FINDING_PROFILE.CANT_TELL).toEqual({ against: 'UNEXPLAINED', lossKind: 'LOSS' });
    for (const finding of FINDINGS) expect(FINDING_PROFILE[finding]).toBeDefined();
  });

  it('an open file lists the findings its direction allows; a settled or head file lists none', () => {
    expect(fixtures.fileOpen.direction).toBe('SHORT');
    expect(fixtures.fileOpen.allowedFindings).toEqual([...FINDINGS_FOR.SHORT]);
    expect(fixtures.fileReversedBackToOpen.allowedFindings).toEqual([...FINDINGS_FOR.SHORT]);
    expect(fixtures.fileDepartmentHead.allowedFindings).toEqual([]);
  });

  it('row 7: a reversed file is Open again with no current finding; the reversal and every event stay on file; a new finding may be recorded', () => {
    const file = fixtures.fileReversedBackToOpen;
    expect(file.status).toBe('OPEN');
    expect(file.finding).toBeNull();
    expect(file.reversal).not.toBeNull();
    expect(file.events.map((e) => e.type)).toEqual(['DISCREPANCY_OPENED', 'FINDING_RECORDED', 'FINDING_REVERSED']);
    expect(file.can.recordFinding).toBe(true);
    expect(file.nextStep.action).toBe('RECORD_A_FINDING');
  });

  it('row 7: a reversal answers OPEN, not REVERSED', () => {
    expect(fixtures.reverseFindingResult.status).toBe('OPEN');
    expect(reverseFindingResultSchema.safeParse({ ...fixtures.reverseFindingResult, status: 'REVERSED' }).success).toBe(false);
  });

  it('row 9: the tabs carry `counts`', () => {
    expect(Object.keys(fixtures.listOpen)).toContain('counts');
    expect(Object.keys(fixtures.listOpen)).not.toContain('tabCounts');
    expect(fixtures.listOpen.counts).toEqual({ open: 2, settled: 14 });
  });

  it('row 11: recording and reversing are idempotent writes and the reversal refusal is FINDING_NOT_REVERSIBLE', () => {
    expect(recordFindingInputSchema.safeParse({ finding: 'CANT_TELL', pin: '4821' }).success).toBe(false);
    expect(reverseFindingInputSchema.safeParse({ reason: 'Found in the cold room', pin: '4821' }).success).toBe(false);
    expect(fixtures.recordFindingResult.replayed).toBe(false);
    expect(DISCREPANCY_ERROR_CODES as readonly string[]).toContain('FINDING_NOT_REVERSIBLE');
    for (const gone of ['NO_FINDING_TO_REVERSE', 'ALREADY_REVERSED']) expect(DISCREPANCY_ERROR_CODES as readonly string[]).not.toContain(gone);
  });

  it('the gap is signed and its direction agrees with the sign', () => {
    for (const file of [fixtures.fileOpen, fixtures.fileReversedBackToOpen, fixtures.fileDepartmentHead]) {
      expect(Number(file.gapQty) < 0).toBe(file.direction === 'SHORT');
      expect(Number(file.countedQty) - Number(file.sentQty)).toBe(Number(file.gapQty));
    }
  });
});

describe('inputs that must be refused', () => {
  it('a finding is one of the five, with an optional note, a four digit PIN and an idempotency key', () => {
    const key = 'finding-dsc-nyr-0007-z9';
    expect(recordFindingInputSchema.safeParse({ finding: 'STOLEN', pin: '4821', idempotencyKey: key }).success).toBe(false);
    expect(recordFindingInputSchema.safeParse({ finding: 'CANT_TELL', pin: '48', idempotencyKey: key }).success).toBe(false);
    expect(recordFindingInputSchema.safeParse({ finding: 'CANT_TELL', idempotencyKey: key }).success).toBe(false);
    expect(recordFindingInputSchema.safeParse({ finding: 'CANT_TELL', pin: '4821', idempotencyKey: key }).success).toBe(true);
    expect(recordFindingInputSchema.safeParse({ finding: 'CANT_TELL', pin: '4821', idempotencyKey: key, note: 'x'.repeat(301) }).success).toBe(false);
    expect(recordFindingInputSchema.safeParse({ ...fixtures.recordFindingInput, extra: 1 }).success).toBe(false);
  });

  it('a reversal needs a reason, a PIN and an idempotency key', () => {
    const key = 'reverse-dsc-nyr-0007-z9';
    expect(reverseFindingInputSchema.safeParse({ pin: '4821', idempotencyKey: key }).success).toBe(false);
    expect(reverseFindingInputSchema.safeParse({ reason: 'ok', pin: '4821', idempotencyKey: key }).success).toBe(false);
    expect(reverseFindingInputSchema.safeParse({ reason: 'Found in the cold room', pin: 'abcd', idempotencyKey: key }).success).toBe(false);
  });

  it('the list opens on Open, takes only Open or Settled, and pages by 25, 50 or 100', () => {
    expect(listDiscrepanciesQuerySchema.parse({})).toMatchObject({ tab: 'open', page: 1, pageSize: 50 });
    expect(listDiscrepanciesQuerySchema.safeParse({ tab: 'reversed' }).success).toBe(false);
    expect(listDiscrepanciesQuerySchema.safeParse({ departmentId: 'kitchen' }).success).toBe(false);
    expect(listDiscrepanciesQuerySchema.safeParse({ pageSize: 10 }).success).toBe(false);
  });

  it('the preview needs a known finding', () => {
    expect(findingPreviewQuerySchema.safeParse({}).success).toBe(false);
    expect(findingPreviewQuerySchema.safeParse({ finding: 'LOST' }).success).toBe(false);
  });
});
