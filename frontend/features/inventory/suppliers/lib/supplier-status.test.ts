import { describe, expect, it } from 'vitest';

import { composeArchiveReason, holdReason, movesFor, unpaidInvoices } from './supplier-status';

describe('supplier status moves', () => {
  it('offers what makes sense for each status', () => {
    expect(movesFor('ACTIVE')).toEqual(['HOLD', 'ARCHIVE']);
    expect(movesFor('ON_HOLD')).toEqual(['ACTIVATE', 'ARCHIVE']);
    expect(movesFor('ARCHIVED')).toEqual(['ACTIVATE']);
  });
  it('needs a reason to archive, words for Other', () => {
    expect(composeArchiveReason('Closed down', '')).toBe('Closed down.');
    expect(composeArchiveReason('Other', '  ')).toBeNull();
    expect(composeArchiveReason('Other', 'Moved away')).toBe('Moved away.');
    expect(composeArchiveReason(null, '')).toBeNull();
  });
  it('treats an empty hold note as none', () => {
    expect(holdReason('   ')).toBeUndefined();
    expect(holdReason(' Away for a month ')).toBe('Away for a month');
  });
});

describe('unpaidInvoices', () => {
  const inv = (id: string, dueDate: string, outstanding: string) => ({ id, invoiceNumber: id, invoiceDate: '2026-08-29', dueDate, outstanding });
  it('keeps unpaid ones, earliest due first', () => {
    const out = unpaidInvoices([inv('b', '2026-09-20', '100.00'), inv('paid', '2026-09-01', '0.00'), inv('a', '2026-09-12', '27900.00')]);
    expect(out.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
