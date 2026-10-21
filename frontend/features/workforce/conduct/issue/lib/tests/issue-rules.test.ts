import { describe, expect, it } from 'vitest';

import type { Draft, IssuePerson } from '../../../_shared/types/conduct-types';
import { endsLine, levelHelper, levelItems, noticeNote, sentMessage, smallPrint, submitBlock, type SubmitInputs } from '../issue-rules';

const person: IssuePerson = { id: 'p1', name: 'Mark Njoroge', department: 'Barista', employeeNumber: 'WND-0412', isMyTeam: true, hasLogin: true, activeNotices: [] };
const draft: Draft = {
  suggestedLevel: 'WRITTEN_WARNING',
  finalAllowed: false,
  finalAlreadyActive: false,
  justIssued: false,
  hasLogin: true,
  facts: { kind: 'LATENESS', monthKey: '2026-09', count: 5, minutes: 38, days: [] },
  months: ['2026-09', '2026-08', '2026-07'],
  month: '2026-09',
  noFacts: false,
  validUntilByLevel: { VERBAL_NOTE: '2027-01-09', WRITTEN_WARNING: '2027-04-09', FINAL_WRITTEN_WARNING: '2027-10-09' },
  ackDays: 3,
  appealDays: 7,
  levels: [],
};
const ready: SubmitInputs = { person, level: 'WRITTEN_WARNING', about: 'LATENESS', draft, ownLine: 'We spoke about it on Thursday and agreed.', pin: '1234', online: true, hasPin: true };

describe('levelItems', () => {
  it('disables the final warning until a written warning is on file', () => {
    expect(levelItems(draft).find((i) => i.value === 'FINAL_WRITTEN_WARNING')?.disabled).toBe(true);
    expect(levelItems({ ...draft, finalAllowed: true }).find((i) => i.value === 'FINAL_WRITTEN_WARNING')?.disabled).toBe(false);
  });
  it('lets every level show before a person is chosen', () => {
    expect(levelItems(null).every((i) => !i.disabled)).toBe(true);
  });
});

describe('levelHelper', () => {
  it('says a verbal note has no letter, by first name', () => {
    expect(levelHelper('VERBAL_NOTE', draft, person)).toBe('A verbal note has no letter. Mark can read it and appeal.');
  });
  it('gives the reason the final warning is off', () => {
    expect(levelHelper('WRITTEN_WARNING', draft, person)).toBe('A final written warning needs an active written warning on the file.');
  });
});

describe('submitBlock', () => {
  it('lets a complete notice go', () => {
    expect(submitBlock(ready)).toBeNull();
  });
  it('names the first thing missing, in order', () => {
    expect(submitBlock({ ...ready, person: null })).toBe('Choose who first.');
    expect(submitBlock({ ...ready, ownLine: 'too short' })).toBe('Add your own line (at least 20 characters).');
    expect(submitBlock({ ...ready, pin: '12' })).toBe('Enter your PIN.');
  });
  it('blocks lateness with no unexcused days', () => {
    expect(submitBlock({ ...ready, draft: { ...draft, noFacts: true } })).toContain('no unexcused days');
  });
  it('does not need timesheet facts for behaviour', () => {
    expect(submitBlock({ ...ready, about: 'BEHAVIOUR', draft: { ...draft, noFacts: true } })).toBeNull();
  });
  it('blocks a final warning when one is already active, and when no written one is on file', () => {
    expect(submitBlock({ ...ready, level: 'FINAL_WRITTEN_WARNING', draft: { ...draft, finalAlreadyActive: true } })).toBe('A final written warning is already on file. Speak to HR.');
    expect(submitBlock({ ...ready, level: 'FINAL_WRITTEN_WARNING' })).toBe('A final written warning needs an active written warning on the file.');
  });
  it('says "no signal" offline, after the other checks', () => {
    expect(submitBlock({ ...ready, online: false })).toContain('No signal');
  });
  it('waits while no PIN is set', () => {
    expect(submitBlock({ ...ready, hasPin: false })).toBe('Set your PIN first.');
  });
});

describe('words', () => {
  it('writes the end line with months and date', () => {
    expect(endsLine('WRITTEN_WARNING', draft, new Date('2026-10-09T13:42:00.000Z'))).toBe('6 months · 9 Apr 2027');
  });
  it('uses roles and first names only in the small print', () => {
    expect(smallPrint(person, 'WRITTEN_WARNING', draft)).toBe('Mark is told on the phone and asked to sign, with 7 days to appeal. HR is told. Recorded in the audit log with your name and the time.');
    expect(smallPrint(person, 'VERBAL_NOTE', draft)).toContain('Mark is told on the phone.');
  });
  it('does not say a person with no login is told on the phone', () => {
    const noLogin = { ...draft, hasLogin: false };
    expect(smallPrint(person, 'WRITTEN_WARNING', noLogin)).toContain('You give the printed letter by hand and record that it was given.');
    expect(smallPrint(person, 'WRITTEN_WARNING', noLogin)).not.toContain('told on the phone and asked');
    expect(smallPrint({ ...person, hasLogin: false }, 'VERBAL_NOTE', null)).toContain('has no login, so is not told on the phone');
  });
  it('shows the picker note by what is on file', () => {
    expect(noticeNote(person)).toEqual({ text: 'No notices on file', tone: 'muted' });
    expect(noticeNote({ ...person, activeNotices: [{ level: 'WRITTEN_WARNING', validUntil: '2027-01-01' }] })).toEqual({ text: '1 active', tone: 'warning' });
    expect(noticeNote({ ...person, activeNotices: [{ level: 'FINAL_WRITTEN_WARNING', validUntil: '2027-01-01' }] }).text).toBe('Final warning on file');
  });
  it('says what happens next after sending', () => {
    expect(sentMessage(person, 'WRITTEN_WARNING', 3, new Date('2026-10-09T13:42:00.000Z'))).toBe('Notice sent to Mark. They have until Mon 12 Oct to sign.');
    expect(sentMessage({ ...person, hasLogin: false }, 'WRITTEN_WARNING', 3, new Date())).toContain('give it by hand');
    expect(sentMessage(person, 'VERBAL_NOTE', 3, new Date())).toBe('Verbal note recorded for Mark. HR has been told.');
  });
});
