import { describe, expect, it } from 'vitest';
import type { CountStatus } from '@prisma/client';
import { assertOpen, assertSubmitted, canTransition, capsOf, countCan, lineCan, statusTextFor, trackerFor } from './count-state';

const caps = (role: string) => capsOf({ role } as never);
const attendant = caps('STORE_ATTENDANT');
const manager = caps('STORE_MANAGER');
const director = caps('DIRECTOR');
const accountant = caps('ACCOUNTANT');

describe('capsOf reads the one capability table', () => {
  it('Attendant: records, blind, sees item cost', () => {
    expect(attendant).toEqual({ read: false, record: true, resolve: false, blind: true, costs: true });
  });
  it('Store Manager and System Admin: record and resolve, see figures', () => {
    expect(manager).toEqual({ read: true, record: true, resolve: true, blind: false, costs: true });
    expect(caps('SYSTEM_ADMIN')).toMatchObject({ read: true, record: true, resolve: true, blind: false });
  });
  it('Director, Accountant and Branch Manager: read only', () => {
    for (const c of [director, accountant, caps('MANAGER')]) expect(c).toMatchObject({ read: true, record: false, resolve: false, blind: false });
  });
  it('a department head holds nothing here', () => {
    expect(caps('CHEF')).toEqual({ read: false, record: false, resolve: false, blind: true, costs: false });
  });
});

describe('state machine', () => {
  const all: CountStatus[] = ['OPEN', 'SUBMITTED', 'APPROVED'];
  const allowed = new Set(['OPEN>SUBMITTED', 'OPEN>APPROVED', 'SUBMITTED>APPROVED']);
  for (const from of all) {
    for (const to of all) {
      it(`${from} to ${to} is ${allowed.has(`${from}>${to}`) ? 'allowed' : 'refused'}`, () => {
        expect(canTransition(from, to)).toBe(allowed.has(`${from}>${to}`));
      });
    }
  }

  it('assertOpen and assertSubmitted raise the contract codes', () => {
    expect(() => assertOpen('OPEN')).not.toThrow();
    expect(() => assertOpen('SUBMITTED')).toThrowError(expect.objectContaining({ code: 'COUNT_NOT_OPEN', statusCode: 409 }));
    expect(() => assertSubmitted('SUBMITTED')).not.toThrow();
    expect(() => assertSubmitted('OPEN')).toThrowError(expect.objectContaining({ code: 'COUNT_NOT_SUBMITTED', statusCode: 409 }));
    expect(() => assertSubmitted('APPROVED')).toThrowError(expect.objectContaining({ code: 'COUNT_NOT_SUBMITTED' }));
  });
});

describe('statusTextFor', () => {
  it('words for the viewer', () => {
    expect(statusTextFor({ status: 'OPEN', selfSigned: false }, manager)).toBe('In progress');
    expect(statusTextFor({ status: 'SUBMITTED', selfSigned: false }, manager)).toBe('Waiting for you');
    expect(statusTextFor({ status: 'SUBMITTED', selfSigned: false }, attendant)).toBe('Submitted');
    expect(statusTextFor({ status: 'SUBMITTED', selfSigned: false }, director)).toBe('Submitted');
    expect(statusTextFor({ status: 'APPROVED', selfSigned: false }, manager)).toBe('Approved');
    expect(statusTextFor({ status: 'APPROVED', selfSigned: true }, manager)).toBe('Signed');
  });
});

describe('countCan', () => {
  it('only the counter may count and sign an OPEN count', () => {
    expect(countCan({ status: 'OPEN', isCounter: true, caps: attendant, toDecide: 0 })).toEqual({ count: true, sign: true, decide: false, approve: false, print: false });
    expect(countCan({ status: 'OPEN', isCounter: false, caps: manager, toDecide: 0 })).toMatchObject({ count: false, sign: false });
    expect(countCan({ status: 'OPEN', isCounter: true, caps: director, toDecide: 0 })).toMatchObject({ count: false, sign: false });
  });

  it('a signed count cannot be counted or signed again', () => {
    for (const status of ['SUBMITTED', 'APPROVED'] as const) {
      expect(countCan({ status, isCounter: true, caps: manager, toDecide: 0 })).toMatchObject({ count: false, sign: false });
    }
  });

  it('the Manager decides a SUBMITTED count and may approve only once nothing is left to decide', () => {
    expect(countCan({ status: 'SUBMITTED', isCounter: false, caps: manager, toDecide: 4 })).toMatchObject({ decide: true, approve: false });
    expect(countCan({ status: 'SUBMITTED', isCounter: false, caps: manager, toDecide: 0 })).toMatchObject({ decide: true, approve: true });
    expect(countCan({ status: 'APPROVED', isCounter: false, caps: manager, toDecide: 0 })).toMatchObject({ decide: false, approve: false });
    expect(countCan({ status: 'SUBMITTED', isCounter: false, caps: director, toDecide: 0 })).toMatchObject({ decide: false, approve: false });
    expect(countCan({ status: 'SUBMITTED', isCounter: true, caps: attendant, toDecide: 0 })).toMatchObject({ decide: false, approve: false });
  });

  it('print is for the readers, and only once the count is signed', () => {
    expect(countCan({ status: 'APPROVED', isCounter: false, caps: accountant, toDecide: 0 }).print).toBe(true);
    expect(countCan({ status: 'SUBMITTED', isCounter: false, caps: director, toDecide: 0 }).print).toBe(true);
    expect(countCan({ status: 'OPEN', isCounter: false, caps: manager, toDecide: 0 }).print).toBe(false);
    expect(countCan({ status: 'APPROVED', isCounter: true, caps: attendant, toDecide: 0 }).print).toBe(false);
  });
});

describe('lineCan', () => {
  it('the Manager decides outside-range and within-range lines of a SUBMITTED count, never matched or skipped ones', () => {
    expect(lineCan({ status: 'SUBMITTED', result: 'EXCEEDS', caps: manager }).decide).toBe(true);
    expect(lineCan({ status: 'SUBMITTED', result: 'WITHIN_RANGE', caps: manager }).decide).toBe(true);
    expect(lineCan({ status: 'SUBMITTED', result: 'MATCHES', caps: manager }).decide).toBe(false);
    expect(lineCan({ status: 'SUBMITTED', result: 'NOT_COUNTED', caps: manager }).decide).toBe(false);
    expect(lineCan({ status: 'APPROVED', result: 'EXCEEDS', caps: manager }).decide).toBe(false);
    expect(lineCan({ status: 'SUBMITTED', result: 'EXCEEDS', caps: director }).decide).toBe(false);
  });

  it('count again: an outside-range line of a signed count, for someone who records and is not blind', () => {
    expect(lineCan({ status: 'SUBMITTED', result: 'EXCEEDS', caps: manager }).countAgain).toBe(true);
    expect(lineCan({ status: 'APPROVED', result: 'EXCEEDS', caps: manager }).countAgain).toBe(true);
    expect(lineCan({ status: 'APPROVED', result: 'WITHIN_RANGE', caps: manager }).countAgain).toBe(false);
    expect(lineCan({ status: 'OPEN', result: 'EXCEEDS', caps: manager }).countAgain).toBe(false);
    expect(lineCan({ status: 'APPROVED', result: 'EXCEEDS', caps: director }).countAgain).toBe(false);
  });

  it('the Attendant never gets a flag that would reveal which lines exceed', () => {
    expect(lineCan({ status: 'SUBMITTED', result: 'EXCEEDS', caps: attendant })).toEqual({ decide: false, countAgain: false });
    expect(lineCan({ status: 'APPROVED', result: 'EXCEEDS', caps: attendant })).toEqual({ decide: false, countAgain: false });
  });
});

describe('trackerFor', () => {
  const t = (iso: string) => new Date(iso);
  const steps = (input: Parameters<typeof trackerFor>[0]) => trackerFor(input).steps.map((s) => `${s.key}:${s.state}`);

  it('OPEN: Counted is current, nothing has a time', () => {
    const tracker = trackerFor({ status: 'OPEN', signedAt: null, approvedAt: null, countedAt: null, checked: false });
    expect(tracker.steps.map((s) => s.state)).toEqual(['CURRENT', 'TODO', 'TODO', 'TODO']);
    expect(tracker.steps.every((s) => s.at === null)).toBe(true);
  });

  it('SUBMITTED, not yet checked: Checked is current', () => {
    expect(steps({ status: 'SUBMITTED', signedAt: t('2026-10-13T04:42:00Z'), approvedAt: null, countedAt: t('2026-10-13T04:41:00Z'), checked: false })).toEqual([
      'COUNTED:DONE',
      'SUBMITTED:DONE',
      'CHECKED:CURRENT',
      'APPROVED:TODO',
    ]);
  });

  it('SUBMITTED and every outside-range line decided: Checked is done, Approved is current', () => {
    expect(steps({ status: 'SUBMITTED', signedAt: t('2026-10-13T04:42:00Z'), approvedAt: null, countedAt: t('2026-10-13T04:41:00Z'), checked: true })).toEqual([
      'COUNTED:DONE',
      'SUBMITTED:DONE',
      'CHECKED:DONE',
      'APPROVED:CURRENT',
    ]);
  });

  it('APPROVED: everything done, with its times', () => {
    const tracker = trackerFor({
      status: 'APPROVED',
      signedAt: t('2026-10-13T04:42:00Z'),
      approvedAt: t('2026-10-13T09:00:00Z'),
      countedAt: t('2026-10-13T04:41:00Z'),
      checked: false,
    });
    expect(tracker.steps.map((s) => s.state)).toEqual(['DONE', 'DONE', 'DONE', 'DONE']);
    expect(tracker.steps[0]!.at).toBe('2026-10-13T04:41:00.000Z');
    expect(tracker.steps[1]!.at).toBe('2026-10-13T04:42:00.000Z');
    expect(tracker.steps[3]!.at).toBe('2026-10-13T09:00:00.000Z');
  });
});
