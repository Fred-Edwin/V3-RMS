import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { availableFrom, monthStates, p9Number, p9Status } from './p9-rules';

const d = parseNairobiDate;

describe('when the P9 is available (PD13)', () => {
  it('the later of 1 January and the day December is Paid', () => {
    expect(availableFrom({ year: 2026, exitMonthKey: null, december: { paid: true, paidOn: d('2026-12-23') }, finalMonth: null })).toBe('2027-01-01');
    expect(availableFrom({ year: 2026, exitMonthKey: null, december: { paid: true, paidOn: d('2027-01-12') }, finalMonth: null })).toBe('2027-01-12');
  });
  it('not at all while December is not Paid', () => {
    expect(availableFrom({ year: 2026, exitMonthKey: null, december: { paid: false, paidOn: null }, finalMonth: null })).toBeNull();
    expect(availableFrom({ year: 2026, exitMonthKey: null, december: null, finalMonth: null })).toBeNull();
  });
  it('a Paid December whose day is unknown counts as available from 1 January', () => {
    expect(availableFrom({ year: 2026, exitMonthKey: null, december: { paid: true, paidOn: null }, finalMonth: null })).toBe('2027-01-01');
  });
  it('a leaver gets it from the day their final month is Paid, not from January', () => {
    expect(availableFrom({ year: 2026, exitMonthKey: '2026-06', december: null, finalMonth: { paid: true, paidOn: d('2026-06-26') } })).toBe('2026-06-26');
    expect(availableFrom({ year: 2026, exitMonthKey: '2026-06', december: null, finalMonth: { paid: false, paidOn: null } })).toBeNull();
    expect(availableFrom({ year: 2026, exitMonthKey: '2026-06', december: null, finalMonth: { paid: true, paidOn: null } })).toBe('2026-07-01');
  });
  it('someone who left in December is treated like everyone (December is their final month)', () => {
    expect(availableFrom({ year: 2026, exitMonthKey: '2026-12', december: { paid: true, paidOn: d('2026-12-23') }, finalMonth: { paid: true, paidOn: d('2026-12-23') } })).toBe('2027-01-01');
  });
  it('someone who left in an earlier year is not asked about this year', () => {
    expect(availableFrom({ year: 2026, exitMonthKey: '2025-11', december: { paid: true, paidOn: d('2026-12-23') }, finalMonth: null })).toBe('2027-01-01');
  });
});

describe('the status the History card shows (PD14)', () => {
  const base = { availableFrom: d('2027-01-01') };
  it('not yet before the date', () => {
    expect(p9Status({ ...base, today: d('2026-12-31'), formatConfirmed: true })).toBe('NOT_YET');
    expect(p9Status({ today: d('2027-06-01'), availableFrom: null, formatConfirmed: true })).toBe('NOT_YET');
  });
  it('waiting for the Accountant until the layout is confirmed', () => {
    expect(p9Status({ ...base, today: d('2027-01-01'), formatConfirmed: false })).toBe('WAITING_FORMAT');
  });
  it('ready on the day, once confirmed', () => {
    expect(p9Status({ ...base, today: d('2027-01-01'), formatConfirmed: true })).toBe('READY');
  });
});

describe('the twelve rows', () => {
  const all = (months: string[]) => new Set(months);
  it('a full year has twelve payslips', () => {
    const rows = monthStates(2026, d('2020-01-01'), null, all(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`)));
    expect(rows.every((r) => r.state === 'PAYSLIP')).toBe(true);
  });
  it('someone who joined in July is Not employed before it', () => {
    const rows = monthStates(2026, d('2026-07-10'), null, all(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']));
    expect(rows.slice(0, 6).every((r) => r.state === 'NOT_EMPLOYED')).toBe(true);
    expect(rows[6]?.state).toBe('PAYSLIP');
  });
  it('someone who left in April is Not employed after it', () => {
    const rows = monthStates(2026, d('2020-01-01'), d('2026-04-15'), all(['2026-01', '2026-02', '2026-03', '2026-04']));
    expect(rows.slice(4).every((r) => r.state === 'NOT_EMPLOYED')).toBe(true);
  });
  it('a month inside the employment with no payslip is flagged, not hidden', () => {
    const rows = monthStates(2026, d('2020-01-01'), null, all(['2026-01']));
    expect(rows[1]?.state).toBe('NO_PAYSLIP');
  });
});

describe('the number (PD15)', () => {
  it('is the year then the digits of the employee number', () => {
    expect(p9Number(2026, 'WCB-0214')).toBe('P9-2026-0214');
    expect(p9Number(2026, 'X')).toBe('P9-2026-0000');
  });
});
