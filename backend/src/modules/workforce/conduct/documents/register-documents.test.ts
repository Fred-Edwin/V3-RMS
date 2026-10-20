import { describe, expect, it, vi } from 'vitest';
import { receiptIsFinal } from './document-service';
import { registerConductDocuments, type ConductDocumentProvider } from './register-documents';

describe('registerConductDocuments', () => {
  it('hands exactly one conduct-notice provider to the door', () => {
    const register = vi.fn<(provider: ConductDocumentProvider) => void>();
    registerConductDocuments(register);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]?.[0].kind).toBe('conduct-notice');
  });
});

describe('receiptIsFinal', () => {
  it('is not final while waiting for the signature', () => {
    expect(receiptIsFinal({ signedAt: null, status: 'ISSUED' })).toBe(false);
    expect(receiptIsFinal({ signedAt: null, status: 'GIVEN_NOT_SIGNED' })).toBe(false);
  });
  it('is final once signed or past the receipt stage', () => {
    expect(receiptIsFinal({ signedAt: new Date(), status: 'SIGNED' })).toBe(true);
    expect(receiptIsFinal({ signedAt: null, status: 'WITHDRAWN' })).toBe(true);
    expect(receiptIsFinal({ signedAt: null, status: 'ENDED' })).toBe(true);
  });
});
