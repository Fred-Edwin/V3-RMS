import { describe, expect, it } from 'vitest';
import fixtures from './discrepancies-contract.fixtures.json';
import { DISCREPANCY_ERROR_CODES, FINDINGS, FINDINGS_FOR, FINDING_PROFILE, FINDING_TEXT } from './discrepancies-contract';
import type { DiscrepancyFile, FindingPreview, ListDiscrepancies, RecordFindingResult } from './discrepancies-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror types, key sets are pinned, money is capability-gated. */
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

describe('discrepancies contract mirror', () => {
  it('list keys', () => {
    const list = fixtures.listOpen as ListDiscrepancies;
    expect(keysOf(list)).toEqual(['branches', 'counts', 'page', 'rows', 'tab']);
    expect(keysOf(list.rows[0]!)).toEqual(['branch', 'branchReason', 'can', 'department', 'direction', 'dispatch', 'finding', 'gapQty', 'id', 'itemName', 'openedAt', 'reference', 'reminderSentAt', 'status', 'unit']);
    expect(keysOf(fixtures.listSettledBranchManager as ListDiscrepancies)).not.toContain('branches');
  });

  it('file keys', () => {
    const file = fixtures.fileOpen as DiscrepancyFile;
    expect(keysOf(file)).toEqual([
      'allowedFindings', 'assignedTo', 'branch', 'branchReason', 'branchReasonNote', 'can', 'carrier', 'counted', 'countedQty', 'countedTwice', 'department', 'direction', 'dispatch', 'events', 'finding',
      'gapQty', 'id', 'item', 'nextStep', 'openedAt', 'packed', 'photos', 'reference', 'reminderSentAt', 'requisition', 'reversal', 'sentQty', 'signed', 'status', 'valueKes',
    ]);
    expect(keysOf(file.nextStep)).toEqual(['action', 'facts']);
  });

  it('a department head file carries no money; the hub file and a LOSS finding do', () => {
    expect(allKeys(fixtures.fileDepartmentHead).filter((k) => MONEY.test(k))).toEqual([]);
    expect(keysOf(fixtures.fileOpen)).toContain('valueKes');
    expect(keysOf((fixtures.findingPreviewLost as FindingPreview))).toContain('lossValueKes');
    expect(keysOf((fixtures.findingPreviewPackedShort as FindingPreview))).not.toContain('lossValueKes');
    expect(keysOf((fixtures.recordFindingResult as RecordFindingResult).finding)).not.toContain('lossValueKes');
  });

  it('the finding rules match the back end', () => {
    expect([...FINDINGS].sort()).toEqual(['BRANCH_COUNTED_WRONG', 'CANT_TELL', 'LOST_OR_DAMAGED', 'PACKED_MORE', 'PACKED_SHORT']);
    expect(FINDINGS_FOR.SHORT).toEqual(['PACKED_SHORT', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL']);
    expect(FINDINGS_FOR.EXTRA).toEqual(['PACKED_MORE', 'BRANCH_COUNTED_WRONG', 'CANT_TELL']);
    expect(FINDING_PROFILE.LOST_OR_DAMAGED).toEqual({ against: 'CARRIER', lossKind: 'LOSS' });
    expect(FINDING_PROFILE.PACKED_SHORT).toEqual({ against: 'STORE', lossKind: 'PACKING_ERROR' });
    expect(FINDING_TEXT.CANT_TELL).toBe("Can't tell");
    expect((fixtures.fileOpen as DiscrepancyFile).allowedFindings).toEqual([...FINDINGS_FOR.SHORT]);
  });

  it('Amendment 1: a reversal puts the gap back to Open; the finding is null and the reversal and events stay', () => {
    const file = fixtures.fileReversedBackToOpen as DiscrepancyFile;
    expect(file.status).toBe('OPEN');
    expect(file.finding).toBeNull();
    expect(file.reversal).not.toBeNull();
    expect(file.allowedFindings).toEqual([...FINDINGS_FOR.SHORT]);
    expect(file.events.map((e) => e.type)).toEqual(['DISCREPANCY_OPENED', 'FINDING_RECORDED', 'FINDING_REVERSED']);
    expect((fixtures.reverseFindingResult as { status: string }).status).toBe('OPEN');
    expect(keysOf(fixtures.recordFindingInput)).toEqual(['finding', 'idempotencyKey', 'note', 'pin']);
    expect(keysOf(fixtures.reverseFindingInput)).toEqual(['idempotencyKey', 'pin', 'reason']);
    expect((DISCREPANCY_ERROR_CODES as readonly string[])).toContain('FINDING_NOT_REVERSIBLE');
  });

  it('every error fixture uses a listed code', () => {
    for (const name of Object.keys(fixtures).filter((n) => n.startsWith('error'))) {
      const code = (fixtures as unknown as Record<string, { error: { code: string } }>)[name]?.error.code ?? '';
      expect(DISCREPANCY_ERROR_CODES as readonly string[]).toContain(code);
    }
  });
});
