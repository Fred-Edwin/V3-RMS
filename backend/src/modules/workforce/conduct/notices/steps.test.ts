import { describe, expect, it } from 'vitest';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import { effectiveStatus, subjectActions } from './notice-view';
import { buildSteps } from './steps';

const base = {
  id: 'n1',
  level: 'WRITTEN_WARNING',
  number: 7,
  status: 'ISSUED',
  issuerRole: 'Branch Manager',
  issuedAt: new Date('2026-10-09T13:42:00Z'), // Fri 9 Oct 16:42 Nairobi
  ackDays: 3,
  appealDays: 7,
  validForMonths: 6,
  validUntil: new Date('2027-04-09T00:00:00Z'),
  personUserId: 'staff',
  signedAt: null,
  notSignedRecordedAt: null,
  appealedAt: null,
  replacesNoticeId: null,
} as unknown as ConductNotice;
const at = (iso: string): Date => new Date(iso);
const notice = (extra: Partial<ConductNotice>): ConductNotice => ({ ...base, ...extra }) as ConductNotice;

describe('buildSteps', () => {
  it('a notice waiting to be signed: sign is the current step and appeal is open', () => {
    const steps = buildSteps(base, null, at('2026-10-10T08:00:00Z'));
    expect(steps.map((s) => [s.key, s.state])).toEqual([['issued', 'done'], ['sign', 'current'], ['appeal', 'current'], ['ends', 'todo']]);
    expect(steps[0]?.line).toBe('Fri 9 Oct, 16:42 · signed by your Branch Manager');
    expect(steps[1]?.line).toBe('By Mon 12 Oct · this does not mean you agree');
    expect(steps[2]?.line).toBe('Until Fri 16 Oct · HR decides, not your manager');
    expect(steps[3]?.line).toBe('9 Apr 2027 · 6 months, kept on your file');
  });

  it('signed: the sign step is done with the time', () => {
    const steps = buildSteps(notice({ status: 'SIGNED', signedAt: at('2026-10-09T14:02:00Z') }), null, at('2026-10-10T08:00:00Z'));
    expect(steps[1]).toMatchObject({ state: 'done', title: 'You signed that you received it', line: 'Fri 9 Oct, 17:02 · with your code' });
  });

  it('given, not signed shows the amber step', () => {
    const steps = buildSteps(notice({ status: 'GIVEN_NOT_SIGNED', notSignedRecordedAt: at('2026-10-13T08:00:00Z') }), null, at('2026-10-14T08:00:00Z'));
    expect(steps[1]).toMatchObject({ state: 'amber', title: 'Given, not signed' });
  });

  it('after the appeal days the appeal step reads Appeal days ended', () => {
    const steps = buildSteps(notice({ status: 'SIGNED', signedAt: at('2026-10-09T14:02:00Z') }), null, at('2026-10-17T08:00:00Z'));
    expect(steps.find((s) => s.key === 'appeal')).toMatchObject({ state: 'todo', title: 'Appeal days ended', line: 'Ended Fri 16 Oct' });
  });

  it('appealed: HR will decide; decided: the outcome is shown and the notice is replaced', () => {
    const appealed = notice({ status: 'APPEALED', appealedAt: at('2026-10-10T06:15:00Z'), signedAt: at('2026-10-09T14:02:00Z') });
    expect(buildSteps(appealed, null, at('2026-10-11T08:00:00Z')).map((s) => s.key)).toEqual(['issued', 'sign', 'appeal', 'decided', 'ends']);
    const replaced = notice({ status: 'REPLACED', appealedAt: at('2026-10-10T06:15:00Z'), signedAt: at('2026-10-09T14:02:00Z') });
    const steps = buildSteps(replaced, { outcome: 'REDUCE_TO_VERBAL', decidedAt: at('2026-10-12T08:20:00Z') }, at('2026-10-13T08:00:00Z'));
    expect(steps.find((s) => s.key === 'decided')?.line).toBe('Mon 12 Oct, 11:20 · HR reduced it to a verbal note');
    expect(steps[steps.length - 1]).toMatchObject({ key: 'replaced', title: 'Replaced on appeal' });
  });

  it('a verbal note has no sign step', () => {
    const steps = buildSteps(notice({ level: 'VERBAL_NOTE', number: null, status: 'RECORDED' }), null, at('2026-10-10T08:00:00Z'));
    expect(steps.map((s) => s.key)).toEqual(['recorded', 'appeal', 'ends']);
  });

  it('a notice made by a reduction gives no appeal step', () => {
    const steps = buildSteps(notice({ replacesNoticeId: 'old', appealDays: 0, level: 'VERBAL_NOTE', status: 'RECORDED' }), null, at('2026-10-13T08:00:00Z'));
    expect(steps.some((s) => s.key === 'appeal')).toBe(false);
  });
});

describe('effectiveStatus and subjectActions', () => {
  it('reads Ended after the end date even before the job stores it, but an appeal stands', () => {
    expect(effectiveStatus(notice({ status: 'SIGNED' }), at('2027-04-09T20:00:00Z'))).toBe('SIGNED');
    expect(effectiveStatus(notice({ status: 'SIGNED' }), at('2027-04-09T21:00:00Z'))).toBe('ENDED');
    expect(effectiveStatus(notice({ status: 'APPEALED' }), at('2027-05-01T00:00:00Z'))).toBe('APPEALED');
  });

  it('sign and appeal are offered only while they can work', () => {
    expect(subjectActions(base, at('2026-10-10T08:00:00Z'))).toEqual({ canSign: true, canAppeal: true, canDownload: true });
    expect(subjectActions(notice({ status: 'SIGNED', signedAt: at('2026-10-09T14:02:00Z') }), at('2026-10-17T00:00:00Z'))).toEqual({ canSign: false, canAppeal: false, canDownload: true });
    expect(subjectActions(notice({ status: 'WITHDRAWN' }), at('2026-10-10T08:00:00Z'))).toMatchObject({ canSign: false, canAppeal: false });
    expect(subjectActions(notice({ personUserId: null }), at('2026-10-10T08:00:00Z')).canSign).toBe(false);
    expect(subjectActions(notice({ level: 'VERBAL_NOTE', status: 'RECORDED' }), at('2026-10-10T08:00:00Z'))).toEqual({ canSign: false, canAppeal: true, canDownload: false });
  });
});
