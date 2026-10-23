import { describe, expect, it } from 'vitest';

import { pageNameFromPath, refusalBody, refusalCaption, refusalFooter, safeFrom } from './refusal-words';

describe('the refusal screen words', () => {
  it('writes the caption and the footer', () => {
    expect(refusalCaption('Payroll')).toBe('PAYROLL · NOT AVAILABLE');
    expect(refusalFooter('WF-R7K2')).toBe('Wrong page? Ask your manager or HR (reference WF-R7K2). Nothing was changed.');
    expect(refusalFooter(null)).toBe('Wrong page? Ask your manager or HR. Nothing was changed.');
    expect(refusalFooter(null, 'HR_MANAGER')).toBe('Wrong page? Ask the System Admin. Nothing was changed.');
  });

  it('says who the page is for and where to go instead, from the server', () => {
    const info = { page: 'Payroll', forWords: 'the Accountant and the Director', instead: { line: 'Your own pay is under My payslips.', label: 'My payslips', href: '/x' } };
    expect(refusalBody(info, 'Payroll')).toBe('Payroll is for the Accountant and the Director. Your own pay is under My payslips.');
    expect(refusalBody({ ...info, instead: null }, 'Payroll')).toBe('Payroll is for the Accountant and the Director.');
  });

  it('falls back to a plain line when the server has no "for" or cannot answer', () => {
    expect(refusalBody({ page: 'This page', forWords: null, instead: null }, 'Thing')).toBe('This page is not available for your role.');
    expect(refusalBody(null, 'Leave calendar')).toBe('Leave calendar is not available for your role.');
  });

  it('believes only a path inside the app, and names a page from its last segment', () => {
    expect(safeFrom('/app/workforce/payroll')).toBe('/app/workforce/payroll');
    expect(safeFrom('https://evil.example/app/x')).toBeNull();
    expect(safeFrom('/app/<script>')).toBeNull();
    expect(safeFrom(null)).toBeNull();
    expect(pageNameFromPath('/app/workforce/leave-calendar')).toBe('Leave calendar');
    expect(pageNameFromPath(null)).toBe('This page');
  });
});
