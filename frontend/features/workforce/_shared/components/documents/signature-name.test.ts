import { describe, expect, it } from 'vitest';

import { signatureName } from './workforce-document';

describe('Signature name', () => {
  it('keeps the first and second name only', () => {
    expect(signatureName('Faith Wanjiru Njeri')).toBe('Faith Wanjiru');
    expect(signatureName('Mercy Achieng')).toBe('Mercy Achieng');
    expect(signatureName('Faith')).toBe('Faith');
  });
  it('drops bracketed extras and stray spaces', () => {
    expect(signatureName('Faith Njeri (BM Nyeri Town)')).toBe('Faith Njeri');
    expect(signatureName('  Mercy   Achieng ')).toBe('Mercy Achieng');
  });
});
