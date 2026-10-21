import { describe, expect, it } from 'vitest';
import type { AccessSubject } from '../../_shared/workforce-access';
import { buildStages, capabilitiesFor, stageCell, tabsEnabled, type StageFacts } from './month-stages';

const facts: StageFacts = { sitesApproved: { approved: 3, total: 4 }, calculatedAt: new Date('2026-10-19T12:05:00Z'), sentAt: new Date('2026-10-19T12:20:00Z'), reviewedBy: 'Hannah, HR', approvedAt: new Date('2026-10-19T14:10:00Z'), approvedBy: 'Anne, Accountant', openLines: 5 };
const subject = (role: string): AccessSubject => ({ id: 'u', role, siteId: null } as unknown as AccessSubject);
const statuses = (state: Parameters<typeof buildStages>[0]) => buildStages(state, facts).map((s) => s.status);

describe('buildStages', () => {
  it('has six stages and the current one moves with the state', () => {
    expect(buildStages('WAITING', facts)).toHaveLength(6);
    expect(statuses('WAITING')).toEqual(['CURRENT', 'TODO', 'TODO', 'TODO', 'TODO', 'TODO']);
    expect(statuses('IN_REVIEW')).toEqual(['DONE', 'DONE', 'CURRENT', 'TODO', 'TODO', 'TODO']);
    expect(statuses('TO_APPROVE')).toEqual(['DONE', 'DONE', 'DONE', 'CURRENT', 'TODO', 'TODO']);
    expect(statuses('TO_PUBLISH')).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'CURRENT', 'TODO']);
  });
  it('captions say what the stage is waiting for or who finished it', () => {
    const waiting = buildStages('WAITING', facts);
    expect(waiting[0]).toMatchObject({ text: '3 of 4 sites' });
    expect(buildStages('IN_REVIEW', facts)[2]).toMatchObject({ who: 'HR', text: '5 lines' });
    expect(buildStages('IN_REVIEW', { ...facts, openLines: 0 })[2]).toMatchObject({ who: 'HR', text: 'All checked' });
    expect(buildStages('TO_APPROVE', facts)[2]).toMatchObject({ who: 'Hannah, HR', at: '2026-10-19T12:20:00.000Z' });
    expect(buildStages('TO_PUBLISH', facts)[3]).toMatchObject({ who: 'Anne, Accountant', status: 'DONE' });
    expect(buildStages('IN_REVIEW', { ...facts, openLines: 1 })[2]?.text).toBe('1 line');
  });
});

describe('tabsEnabled (P25)', () => {
  it('opens tabs as the month progresses and the payslip list from Approved', () => {
    expect(tabsEnabled('OPEN')).toEqual(['timesheets']);
    expect(tabsEnabled('WAITING')).toEqual(['timesheets']);
    expect(tabsEnabled('IN_REVIEW')).toEqual(['timesheets', 'rules', 'tax', 'casual', 'totals']);
    expect(tabsEnabled('TO_PUBLISH')).toContain('payslips');
  });
});

describe('capabilitiesFor: from the access table and the state, never the role name', () => {
  it('gives HR the review buttons only while the month is in review', () => {
    expect(capabilitiesFor(subject('HR_MANAGER'), 'IN_REVIEW')).toMatchObject({ canReview: true, canSendToAccountant: true, canApprove: false, canExport: true });
    expect(capabilitiesFor(subject('HR_MANAGER'), 'TO_APPROVE')).toMatchObject({ canReview: false, canSendToAccountant: false });
  });
  it('gives the Accountant approve only when the month is with them', () => {
    expect(capabilitiesFor(subject('ACCOUNTANT'), 'TO_APPROVE')).toMatchObject({ canApprove: true, canReview: false });
    expect(capabilitiesFor(subject('ACCOUNTANT'), 'IN_REVIEW').canApprove).toBe(false);
  });
  it('gives the Director and the System Admin no review or approve button, and both the late approval and a reminder (21 Oct 2026)', () => {
    for (const role of ['DIRECTOR', 'SYSTEM_ADMIN'] as const) {
      expect(capabilitiesFor(subject(role), 'WAITING'), role).toMatchObject({ canReview: false, canApprove: false, canRemind: true, canApproveSiteLate: true, canExport: false });
    }
  });
  it('gives a Branch Manager nothing', () => {
    expect(Object.values(capabilitiesFor(subject('MANAGER'), 'WAITING')).every((v) => v === false)).toBe(true);
  });
});

describe('stageCell', () => {
  it('words each stage', () => {
    expect(stageCell('WAITING', { sitesApproved: { approved: 3, total: 4 }, openLines: 0, waitingFor: null })).toEqual({ word: 'Waiting', caption: 'for 1 of 4 sites to approve' });
    expect(stageCell('WAITING', { sitesApproved: { approved: 4, total: 4 }, openLines: 0, waitingFor: 'Waiting for the Accountant to confirm the tax tables.' }).caption).toContain('tax tables');
    expect(stageCell('IN_REVIEW', { sitesApproved: { approved: 4, total: 4 }, openLines: 5, waitingFor: null })).toEqual({ word: 'In review', caption: 'HR checks 5 lines' });
  });
});
