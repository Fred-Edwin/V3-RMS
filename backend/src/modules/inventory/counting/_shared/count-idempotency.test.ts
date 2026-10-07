import { describe, expect, it } from 'vitest';
import { approvedWith, isApproveKey, isSignKey, isStartKey, keysOf, signedWith, startKeyWhere, startedWith } from './count-idempotency';

describe('count idempotency keys', () => {
  it('the three keys are kept in the order the requests happened', () => {
    const started = startedWith('start-key-1');
    expect(started).toBe('start-key-1');
    const signed = signedWith(started, 'sign-key-22');
    expect(signed).toBe('start-key-1|sign-key-22');
    const approved = approvedWith(signed, 'approve-key-3');
    expect(approved).toBe('start-key-1|sign-key-22|approve-key-3');
    expect(keysOf(approved)).toEqual(['start-key-1', 'sign-key-22', 'approve-key-3']);
  });

  it('each retried request finds its own key, and only its own', () => {
    const stored = 'start-key-1|sign-key-22|approve-key-3';
    expect(isStartKey(stored, 'start-key-1')).toBe(true);
    expect(isSignKey(stored, 'sign-key-22')).toBe(true);
    expect(isApproveKey(stored, 'approve-key-3')).toBe(true);
    expect(isStartKey(stored, 'sign-key-22')).toBe(false);
    expect(isSignKey(stored, 'start-key-1')).toBe(false);
    expect(isApproveKey(stored, 'sign-key-22')).toBe(false);
  });

  it('a count not yet signed knows only its start key', () => {
    expect(isStartKey('start-key-1', 'start-key-1')).toBe(true);
    expect(isSignKey('start-key-1', 'start-key-1')).toBe(false);
    expect(isSignKey(null, 'x')).toBe(false);
    expect(keysOf(null)).toEqual([]);
  });

  it('signing again replaces a previous sign key, approving keeps the first two', () => {
    expect(signedWith('start-key-1|old-sign-key', 'new-sign-key')).toBe('start-key-1|new-sign-key');
    expect(approvedWith('start-key-1|sign-key-22|older', 'approve-key-3')).toBe('start-key-1|sign-key-22|approve-key-3');
  });

  it('a separator inside a client key cannot forge another key', () => {
    const stored = signedWith(startedWith('a|b-key-1'), 'c|d-key-2');
    expect(keysOf(stored)).toEqual(['a_b-key-1', 'c_d-key-2']);
    expect(isStartKey(stored, 'a|b-key-1')).toBe(true);
    expect(isSignKey(stored, 'a|b-key-1')).toBe(false);
  });

  it('finds a count by the key it was started with, signed or not', () => {
    expect(startKeyWhere('start-key-1')).toEqual({ OR: [{ idempotencyKey: 'start-key-1' }, { idempotencyKey: { startsWith: 'start-key-1|' } }] });
  });
});
