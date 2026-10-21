import { describe, expect, it } from 'vitest';

import type { EmployeeFile, FilePart } from '../../_shared/types/people-types';
import { finishProgress, idBankEmpty, numbersEmpty, stillToFinish, toEmergencyBody, toIdBankBody, toNumbersBody, validateEmergency, validateIdBank } from './own-file';

const parts = (open: FilePart[]) => (['EMERGENCY_CONTACT', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'PAY'] as FilePart[]).map((part) => ({ part, applicable: true, done: !open.includes(part) }));
const file = (open: FilePart[], nextSteps: EmployeeFile['nextSteps'] = []): EmployeeFile =>
  ({ completeness: { ringPercent: 50, checklistPercent: 50, parts: parts(open), checklist: [] }, nextSteps, sensitive: {} }) as unknown as EmployeeFile;
const words = (d: string): string => `on ${d}`;

describe('what is still to finish', () => {
  it('lists the three things the person can add, only the open ones', () => {
    expect(stillToFinish(file(['NSSF_SHA']), words).map((r) => r.key)).toEqual(['numbers']);
    expect(stillToFinish(file([]), words)).toEqual([]);
  });
  it('does not ask for numbers that are already on the file (finding 66)', () => {
    const done = { ...file(['NSSF_SHA']), sensitive: { nssfNumber: '900037', shaNumber: '5000091' } } as unknown as EmployeeFile;
    expect(stillToFinish(done, words)).toEqual([]);
  });
  it('says when HR asked', () => {
    const rows = stillToFinish(file(['EMERGENCY_CONTACT'], [{ code: 'FILE_REQUEST', dueOn: null, fileRequestId: 'r', fileRequestKind: 'EMERGENCY_CONTACT', fileRequestAskedOn: '2026-10-02' }]), words);
    expect(rows[0]).toMatchObject({ key: 'emergency', detail: 'HR asked for this on on 2026-10-02' });
  });
  it('counts progress over the three', () => {
    expect(finishProgress(file(['NSSF_SHA']))).toEqual({ done: 2, total: 3 });
  });
});

describe('the small forms', () => {
  it('an emergency contact needs a name, a relation and a phone', () => {
    expect(Object.keys(validateEmergency({ name: '', relation: '', phone: '' }))).toEqual(['name', 'relation', 'phone']);
    expect(validateEmergency({ name: 'Grace Chebet', relation: 'Parent', phone: '0722 000 111' })).toEqual({});
    expect(toEmergencyBody({ name: ' Grace Chebet ', relation: 'Parent', phone: '0722 000 111' })).toEqual({ emergencyName: 'Grace Chebet', emergencyRelation: 'Parent', emergencyPhone: '0722 000 111' });
  });
  it('sends only the numbers that were typed', () => {
    expect(toNumbersBody({ nssf: '2018 4471 09', sha: '' })).toEqual({ nssfNumber: '2018 4471 09' });
    expect(numbersEmpty({ nssf: '', sha: ' ' })).toBe(true);
  });
});

describe('my ID and bank details (finding 15)', () => {
  it('checks the ID and the account, and wants the bank with an account', () => {
    expect(validateIdBank({ nationalId: '12ab', bank: '', accountNumber: '' }).nationalId).toBeDefined();
    expect(validateIdBank({ nationalId: '28817703', bank: '', accountNumber: '' })).toEqual({});
    expect(validateIdBank({ nationalId: '', bank: '', accountNumber: '0123456789' }).bank).toBeDefined();
    expect(validateIdBank({ nationalId: '', bank: 'Equity Bank', accountNumber: '' }).accountNumber).toBeDefined();
    expect(validateIdBank({ nationalId: '', bank: 'Equity Bank', accountNumber: '0123456789' })).toEqual({});
  });
  it('sends only what was entered, so an empty box never clears the file', () => {
    expect(toIdBankBody({ nationalId: ' 28817703 ', bank: '', accountNumber: '' })).toEqual({ nationalId: '28817703' });
    expect(toIdBankBody({ nationalId: '', bank: 'KCB Bank', accountNumber: '123456' })).toEqual({ bankName: 'KCB Bank', accountNumber: '123456' });
    expect(idBankEmpty({ nationalId: '', bank: '', accountNumber: ' ' })).toBe(true);
  });
});
