import { describe, expect, it } from 'vitest';

import type { EmployeeFile, FilePart } from '../../_shared/types/people-types';
import { finishProgress, stillToFinish, toEmergencyBody, validateEmergency } from './own-file';

const parts = (open: FilePart[]) => (['EMERGENCY_CONTACT', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'PAY'] as FilePart[]).map((part) => ({ part, applicable: true, done: !open.includes(part) }));
const file = (open: FilePart[], nextSteps: EmployeeFile['nextSteps'] = []): EmployeeFile =>
  ({ completeness: { ringPercent: 50, checklistPercent: 50, parts: parts(open), checklist: [] }, nextSteps, sensitive: {} }) as unknown as EmployeeFile;

describe('what is still to finish', () => {
  it('lists the three things the person can add, only the open ones', () => {
    expect(stillToFinish(file(['NSSF_SHA'])).map((r) => r.key)).toEqual(['numbers']);
    expect(stillToFinish(file([]))).toEqual([]);
  });
  it('does not ask for numbers that are already on the file (finding 66)', () => {
    const done = { ...file(['NSSF_SHA']), sensitive: { nssfNumber: '900037', shaNumber: '5000091' } } as unknown as EmployeeFile;
    expect(stillToFinish(done)).toEqual([]);
  });
  it('says why in the words of frame 8.1', () => {
    const rows = stillToFinish(file(['EMERGENCY_CONTACT', 'PHOTO_AND_DETAILS']));
    expect(rows.map((r) => [r.title, r.detail])).toEqual([
      ['Emergency contact', 'HR asked for it. Takes 1 minute.'],
      ['Photo', 'Your team sees it on the rota.'],
    ]);
  });
  it('counts progress over the three', () => {
    expect(finishProgress(file(['NSSF_SHA']))).toEqual({ done: 2, total: 3 });
  });
});

describe('the emergency contact form', () => {
  it('needs a name, a relation and a phone', () => {
    expect(Object.keys(validateEmergency({ name: '', relation: '', phone: '' }))).toEqual(['name', 'relation', 'phone']);
    expect(validateEmergency({ name: 'Grace Chebet', relation: 'Parent', phone: '0722 000 111' })).toEqual({});
    expect(toEmergencyBody({ name: ' Grace Chebet ', relation: 'Parent', phone: '0722 000 111' })).toEqual({ emergencyName: 'Grace Chebet', emergencyRelation: 'Parent', emergencyPhone: '0722 000 111' });
  });
});
