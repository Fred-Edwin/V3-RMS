import { describe, expect, it } from 'vitest';

import type { EmployeeActions, EmployeeFile, FilePart } from '../../_shared/types/people-types';
import { finishTarget, hasFinishStep, headerLine, headerTags, nextStepRows, pageActions, probationCard, ringChips, ringSummary, tabsFor, withWendo } from './file-model';

const NO: EmployeeActions = { editJob: false, changePay: false, transfer: false, sendToSite: false, exit: false, undoExit: false, rehire: false, decideProbation: false, writeNote: false, createContract: false, uploadDocument: false, remind: false, createLogin: false };
const HR: EmployeeActions = { ...NO, editJob: true, changePay: true, transfer: true, sendToSite: true, exit: true, decideProbation: true, createContract: true, uploadDocument: true, remind: true };

const ALL_PARTS: FilePart[] = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'EMERGENCY_CONTACT', 'CONTRACT'];
const parts = (done: Partial<Record<FilePart, boolean>>) => ALL_PARTS.map((part) => ({ part, applicable: true, done: done[part] ?? true }));

const joy = (over: Partial<EmployeeFile> = {}): EmployeeFile =>
  ({
    id: 'e1',
    name: 'Joy Chebet',
    status: 'ACTIVE',
    employment: 'MONTHLY',
    contractStatus: 'NONE',
    tracksTime: true,
    organization: { id: 's1', name: 'Nyeri Town' },
    department: { id: 'd1', name: 'Barista' },
    position: { id: 'p1', name: 'Barista' },
    reportsTo: { id: 'e2', name: 'Victor Maina', isHead: true },
    startDate: '2026-07-14',
    personalPhone: '0712 345 678',
    locked: [],
    actions: HR,
    completeness: { ringPercent: 67, checklistPercent: 50, parts: parts({ CONTRACT: false, EMERGENCY_CONTACT: false }), checklist: [] },
    probation: { endsOn: '2026-10-14', dayNumber: 80, totalDays: 90, daysLeft: 10, extensions: 0, extensionsAllowed: 1, decidedOn: null, confirmedOn: null, confirmationWaitingForContract: false, notes: [{ authorName: 'Victor Maina', authorKind: 'HEAD', verdict: 'GOOD', note: null, createdOn: '2026-10-02' }] },
    nextSteps: [{ code: 'PROBATION_DECISION', dueOn: '2026-10-14' }, { code: 'CREATE_CONTRACT', dueOn: null }, { code: 'FILE_REQUEST', dueOn: null, fileRequestId: 'r1' }],
    ...over,
  }) as unknown as EmployeeFile;

describe('tabs follow what is locked', () => {
  it('gives HR the seven tabs and a Branch Manager five', () => {
    expect(tabsFor(joy()).map((t) => t.label)).toEqual(['Overview', 'Job and pay', 'Time', 'Leave', 'Documents', 'Conduct', 'Activity']);
    expect(tabsFor(joy({ locked: ['pay', 'bank', 'ids', 'documents'] })).map((t) => t.label)).toEqual(['Overview', 'Time', 'Leave', 'Conduct', 'Activity']);
  });
  it('marks the tabs of later slices as waiting', () => {
    expect(tabsFor(joy()).filter((t) => t.disabled).map((t) => t.value)).toEqual(['time', 'leave', 'conduct']);
  });
});

describe('the header', () => {
  it('writes the line and the tags as Paper does', () => {
    expect(headerLine(joy())).toBe('Barista · Barista department · Nyeri Town · reports to Victor Maina · 0712 345 678');
    expect(headerTags(joy(), '2026-10-05').map((t) => t.label)).toEqual(['On probation', 'Monthly', 'Clocks in']);
  });
  it('shows Onboarding, the start day and the missing contract for a new hire', () => {
    const labels = headerTags(joy({ status: 'ONBOARDING', startDate: '2026-10-05', probation: null }), '2026-10-01').map((t) => t.label);
    expect(labels).toEqual(['Onboarding', 'Starts Mon 5 Oct', 'Monthly', 'Clocks in', 'No contract yet']);
  });
  it('shows only Exited for an exited file', () => {
    expect(headerTags(joy({ status: 'EXITED' }), '2026-11-01').map((t) => t.label)).toEqual(['Exited']);
  });
});

describe('the completeness ring', () => {
  it('lists the six parts and counts what is done', () => {
    expect(ringChips(joy()).map((c) => `${c.label}:${c.done}`)).toEqual(['Identity:true', 'Job:true', 'Pay:true', 'Bank:true', 'Contract:false', 'Emergency contact:false']);
    expect(ringSummary(joy()).caption).toBe('THE FILE · 4 OF 6 DONE');
    expect(ringSummary(joy()).note).toBe('Two gaps. A contract is needed before the 14 Oct probation decision. Click a gap to fix it.');
  });
  it('shows nothing to a viewer who may not see completeness', () => {
    expect(ringChips(joy({ completeness: null }))).toEqual([]);
  });
});

describe('probation and time with Wendo', () => {
  it('reads the head report', () => {
    expect(probationCard(joy())).toMatchObject({ dayNumber: 80, daysLeft: 10, report: 'Report from Victor: good', decideBy: 'Decide by 14 Oct' });
  });
  it('has no card once confirmed', () => {
    expect(probationCard(joy({ probation: { ...joy().probation!, confirmedOn: '2026-10-15' } }))).toBeNull();
  });
  it('counts days for a new hire and months after two', () => {
    expect(withWendo('2026-10-05', '2026-10-17').value).toBe('12 days');
    expect(withWendo('2026-03-03', '2026-10-17').value).toBe('7 mo');
  });
});

describe('next steps and buttons come from the actions the server allows', () => {
  it('gives each step its button for HR and none for a viewer without the action', () => {
    expect(nextStepRows(joy()).map((r) => r.action?.label)).toEqual(['Decide', 'Create', 'Remind']);
    expect(nextStepRows(joy({ actions: NO })).map((r) => r.action)).toEqual([null, null, null]);
  });
  it('puts the brown button last on each tab, and only what is allowed', () => {
    expect(pageActions(joy(), 'overview').map((a) => a.label)).toEqual(['Send to another site', 'Transfer or exit']);
    expect(pageActions(joy({ nextSteps: [{ code: 'FINISH_FILE', dueOn: null }] }), 'overview').map((a) => a.label)).toEqual(['Send to another site', 'Transfer or exit', 'Finish the file']);
    expect(pageActions(joy(), 'job-pay').map((a) => a.label)).toEqual(['Transfer or exit', 'Change pay']);
    expect(pageActions(joy(), 'documents').map((a) => a.label)).toEqual(['Upload a document', 'Create contract']);
    expect(pageActions(joy({ actions: NO }), 'job-pay')).toEqual([]);
  });
  it('offers only Undo exit on an exited file', () => {
    expect(pageActions(joy({ status: 'EXITED', actions: { ...NO, undoExit: true } }), 'overview').map((a) => a.label)).toEqual(['Undo exit']);
    expect(pageActions(joy({ status: 'EXITED' }), 'overview')).toEqual([]);
  });
});

describe('Finish the file', () => {
  it('opens the dialog for the first gap', () => {
    expect(finishTarget(joy({ completeness: { ringPercent: 0, checklistPercent: 0, checklist: [], parts: parts({ BANK: false, CONTRACT: false }) } }))).toBe('bank');
    expect(finishTarget(joy({ completeness: { ringPercent: 0, checklistPercent: 0, checklist: [], parts: parts({ IDENTITY: false }) } }))).toBe('details');
  });
  it('is not offered without a gap it can fix', () => {
    expect(hasFinishStep(joy({ nextSteps: [{ code: 'FINISH_FILE', dueOn: null }], completeness: { ringPercent: 100, checklistPercent: 100, checklist: [], parts: parts({}) } }))).toBe(false);
  });
});
