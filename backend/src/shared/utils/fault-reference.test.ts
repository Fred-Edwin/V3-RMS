import { describe, expect, it } from 'vitest';
import { faultReference } from './fault-reference';

describe('faultReference', () => {
  it('is WF- and four readable characters', () => {
    expect(faultReference({ id: 'req-1' })).toMatch(/^WF-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('is the same for the same request id, so support can search for it', () => {
    expect(faultReference({ id: 42 })).toBe(faultReference({ id: 42 }));
    expect(faultReference({ id: 42 })).not.toBe(faultReference({ id: 43 }));
  });

  it('still gives a reference when the request has no id', () => {
    expect(faultReference({})).toMatch(/^WF-[A-HJ-NP-Z2-9]{4}$/);
  });
});
