import { describe, expect, it } from 'vitest';
import type { StoredEntry } from '../audit-rows';
import { cardRows, categoriesOfChip, chipOfCategory, needsAnswer, whenWords, wordForPerson } from './my-record-wording';

const entry = (over: Partial<StoredEntry>): StoredEntry => ({
  id: 'e1', seq: 1n, occurredAt: new Date('2026-10-19T09:48:00.000Z'), siteId: null, action: 'payslip.opened', category: 'PAYSLIP_ACCESS', subjectType: 'Payslip', subjectId: 'p1',
  actorId: 'hr-1', actorRole: 'HR_MANAGER', actorName: 'Mercy Achieng', channel: 'APP', subjectUserId: 'me', before: null, after: null, reason: null, deviceLabel: null, placeLabel: null,
  prevHash: 'a', hash: 'b', ...over,
});

describe('Activity on my record: what the person reads', () => {
  it('a payslip opened by HR names who and the month, and never a figure', () => {
    const w = wordForPerson(entry({ after: { number: 'PS-0987', month: '2026-09', ownerOpened: false, net: 91234, gross: 100000 } }), 'me');
    expect(w.title).toBe('Payslip September 2026 opened by Mercy Achieng, HR Manager');
    expect(`${w.title} ${w.line}`).not.toMatch(/91234|100000|net|gross/i);
    expect(w.needsAnswer).toBe(false);
  });

  it('an opening on a phone that is not confirmed is flagged and can be answered', () => {
    const e = entry({ actorId: 'me', actorName: 'Joy Chebet', actorRole: 'WAITER', after: { month: '2026-09', ownerOpened: true, unconfirmed: true }, deviceLabel: 'Tecno, Android', placeLabel: 'Nairobi' });
    const w = wordForPerson(e, 'me');
    expect(w).toMatchObject({ title: 'Payslip opened on a phone you have not confirmed', flagged: true, needsAnswer: true });
    expect(cardRows(e, 'me', '2026-10-19 12:48')).toEqual([
      { label: 'Opened', value: '2026-10-19 12:48' },
      { label: 'Device', value: 'A phone you have not confirmed' },
      { label: 'Place', value: 'Nairobi (approximate)' },
      { label: 'Opened with', value: 'Your own code' },
    ]);
  });

  it('only an unconfirmed opening and a first-seen phone can be answered', () => {
    expect(needsAnswer(entry({ after: { unconfirmed: false } }))).toBe(false);
    expect(needsAnswer(entry({ action: 'security.phone_first_seen', category: 'SECURITY' }))).toBe(true);
    expect(needsAnswer(entry({ action: 'people.updated', category: 'PEOPLE' }))).toBe(false);
  });

  it('a corrected payslip says the version only', () => {
    const w = wordForPerson(entry({ action: 'payroll.payslip_corrected', category: 'PAY_RUN_PREPARE', after: { version: 2, net: 88000 } }), 'me');
    expect(w.title).toBe('Payslip corrected, version 2');
    expect(w.line).not.toMatch(/88000/);
  });
});

describe('chips', () => {
  it('"All" holds every chip category and never the log itself', () => {
    expect(categoriesOfChip('all')).not.toContain('LOG_ACCESS');
    expect(categoriesOfChip('all')).toEqual(expect.arrayContaining(['PAYSLIP_ACCESS', 'TIME', 'LEAVE', 'SECURITY', 'PEOPLE', 'DISCIPLINE']));
  });

  it('the card says Today, Yesterday or a short date, never a raw timestamp', () => {
    expect(whenWords('2026-10-21', '05:58', '2026-10-21', '2026-10-20')).toBe('Today 05:58');
    expect(whenWords('2026-10-20', '22:16', '2026-10-21', '2026-10-20')).toBe('Yesterday 22:16');
    expect(whenWords('2026-10-09', '23:41', '2026-10-21', '2026-10-20')).toBe('9 Oct 23:41');
  });

  it('each category maps to one chip, and File and Conduct exist (SD11)', () => {
    expect(chipOfCategory('PEOPLE')).toBe('file');
    expect(chipOfCategory('DISCIPLINE')).toBe('conduct');
    expect(chipOfCategory('SECURITY')).toBe('signins');
    expect(() => chipOfCategory('LOG_ACCESS')).toThrow();
  });
});
