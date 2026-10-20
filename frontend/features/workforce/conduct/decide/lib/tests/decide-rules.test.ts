import { describe, expect, it } from 'vitest';

import type { DecisionPreview, DeskDetail } from '../../../_shared/types/conduct-types';
import { decideBlock, decidePrint, outcomeOptions, previewRows, titleFor } from '../decide-rules';

const detail = { personName: 'Mark Njoroge', number: 'WRN-0007' } as DeskDetail;

describe('titles and options', () => {
  it('names the appeal or the change', () => {
    expect(titleFor(detail, 'decide')).toBe("Decide Mark Njoroge's appeal");
    expect(titleFor(detail, 'change')).toBe("Change Mark Njoroge's notice");
  });
  it('words each outcome the server offered, and only those', () => {
    const options = outcomeOptions(['REDUCE_TO_VERBAL', 'WITHDRAW']);
    expect(options.map((o) => o.title)).toEqual(['Reduce to a verbal note', 'Withdraw the warning']);
    expect(options[0]?.description).toBe('The letter is replaced by a note on the file, with no letter.');
  });
});

describe('decideBlock', () => {
  const ok = { outcome: 'KEEP' as const, reason: 'The dates are right.', pin: '1234', online: true, hasPin: true };
  it('lets a complete decision go', () => expect(decideBlock(ok)).toBeNull());
  it('asks in the spec words, in order', () => {
    expect(decideBlock({ ...ok, outcome: null })).toBe('Choose an outcome.');
    expect(decideBlock({ ...ok, reason: 'short' })).toBe('Say why (at least 10 characters).');
    expect(decideBlock({ ...ok, pin: '' })).toBe('Enter your PIN.');
    expect(decideBlock({ ...ok, online: false })).toContain('No signal');
  });
  it('counts the reason after trimming', () => expect(decideBlock({ ...ok, reason: '          x  ' })).toBe('Say why (at least 10 characters).'));
});

describe('previewRows', () => {
  const base: DecisionPreview = { outcome: 'REDUCE_TO_VERBAL', from: 'WRITTEN_WARNING', to: 'VERBAL_NOTE', daysTaken: 3, endsOn: '2027-01-12', oldNotice: 'REPLACED' };
  it('shows the record, the new end date and what happens to the old letter', () => {
    expect(previewRows(detail, base)).toEqual([
      { label: 'The record', value: 'Written warning to verbal note · 3 days to decide' },
      { label: 'Ends by itself on', value: '12 Jan 2027', mono: true },
      { label: 'WRN-0007', value: 'Marked as replaced, kept on the file' },
    ]);
  });
  it('says a withdrawn notice does not count', () => {
    const rows = previewRows(detail, { ...base, outcome: 'WITHDRAW', to: null, endsOn: null, oldNotice: 'WITHDRAWN' });
    expect(rows[1]).toMatchObject({ value: 'Does not count' });
    expect(rows[2]?.value).toBe('Marked as withdrawn, kept on the file');
  });
  it('says a kept notice stays as it is', () => {
    expect(previewRows(detail, { ...base, outcome: 'KEEP', to: null, oldNotice: 'KEPT' })[2]?.value).toBe('Stays exactly as it is');
  });
});

describe('small print', () => {
  it('uses roles and says the decision is final', () => {
    expect(decidePrint('decide')).toContain('The staff member and the issuer are told.');
    expect(decidePrint('decide')).toContain('final');
  });
});
