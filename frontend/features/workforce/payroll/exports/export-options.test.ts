import { describe, expect, it } from 'vitest';

import { buttonLabel, exportOptions, firstOn, stampLine } from './export-options';

describe('export options', () => {
  it('are all off before the month is calculated', () => {
    expect(exportOptions('WAITING').every((o) => o.offReason === 'Nothing is calculated yet.' || o.offReason === 'Available once the payslips are published.')).toBe(true);
    expect(firstOn(exportOptions('OPEN'))).toBeNull();
  });
  it('turn on from calculated, and the zip waits for publishing', () => {
    const review = exportOptions('IN_REVIEW');
    expect(review.find((o) => o.kind === 'REGISTER')?.offReason).toBeNull();
    expect(review.find((o) => o.kind === 'PAYSLIPS')?.offReason).toBe('Available once the payslips are published.');
    expect(exportOptions('PUBLISHED').find((o) => o.kind === 'PAYSLIPS')?.offReason).toBeNull();
  });
  it('give each kind only its own formats', () => {
    const byKind = Object.fromEntries(exportOptions('PAID').map((o) => [o.kind, o.formats]));
    expect(byKind).toEqual({ REGISTER: ['pdf', 'xlsx'], SUMMARY: ['pdf'], STATUTORY: ['xlsx'], PAYSLIPS: ['zip'] });
  });
  it('says draft until approval, then names the document', () => {
    expect(stampLine('TO_APPROVE', null, null).tone).toBe('warning');
    expect(stampLine('PAID', 'PAY-2026-09', '19 Oct').text).toContain('PAY-2026-09');
  });
  it('labels the button by choice', () => {
    const register = exportOptions('PAID')[0]!;
    expect(buttonLabel(register, 'xlsx')).toBe('Download payroll register (Excel)');
  });
});
