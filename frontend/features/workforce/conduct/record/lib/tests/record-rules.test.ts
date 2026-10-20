import { describe, expect, it } from 'vitest';

import type { DeskDetail } from '../../../_shared/types/conduct-types';
import { defaultReason, hasNoLogin, reasonChips, recordBlock, recordPrint } from '../record-rules';

const base = { actions: { canRecordNotSigned: true, recordableFrom: '2026-10-12T00:00:00.000Z', canDecide: false, outcomes: [], canChange: false, canOpenAsIssued: false }, jobLabel: 'Barista', appealLine: 'None' } as unknown as DeskDetail;
const noLogin = { ...base, actions: { ...base.actions, recordableFrom: null } } as DeskDetail;

describe('reason chips', () => {
  it('offers refused and not reached to a person with a login', () => {
    expect(reasonChips(base).map((c) => c.value)).toEqual(['REFUSED', 'NOT_REACHED']);
    expect(defaultReason(base)).toBeNull();
  });
  it('offers only "no login" (chosen for you) when there is no login', () => {
    expect(hasNoLogin(noLogin)).toBe(true);
    expect(reasonChips(noLogin).map((c) => c.value)).toEqual(['NO_LOGIN']);
    expect(defaultReason(noLogin)).toBe('NO_LOGIN');
  });
  it('words them without a gendered pronoun', () => {
    expect(reasonChips(base).map((c) => c.label).join(' ')).not.toMatch(/\b(him|her|he|she|his)\b/i);
  });
});

describe('recordBlock', () => {
  const ok = { reason: 'REFUSED' as const, witnessId: 'w1', pin: '1234', online: true, hasPin: true };
  it('lets a complete record go', () => {
    expect(recordBlock(ok)).toBeNull();
  });
  it('asks in the spec words, in order', () => {
    expect(recordBlock({ ...ok, reason: null })).toBe('Choose what happened.');
    expect(recordBlock({ ...ok, witnessId: null })).toBe('Choose a witness.');
    expect(recordBlock({ ...ok, pin: '' })).toBe('Enter your PIN.');
    expect(recordBlock({ ...ok, online: false })).toContain('No signal');
  });
});

describe('small print', () => {
  it('names roles, not people', () => {
    expect(recordPrint(base)).toBe('Barista, the witness and HR are told. Recorded in the audit log with your name and the time.');
  });
});
