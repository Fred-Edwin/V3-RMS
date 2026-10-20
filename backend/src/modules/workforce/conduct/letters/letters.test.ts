import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { buildLetter, verbalNoteLine, type LetterInput } from './letter-fill';
import { selectFacts, offeredMonths, defaultMonthKey, type TimesheetFactRow } from './facts-selection';
import { datesLong, fillBlanks, longDate, plainText } from './letter-text';

const row = (date: string, minutesLate: number, extra: Partial<TimesheetFactRow> = {}): TimesheetFactRow => ({
  date,
  reasons: ['LATE'],
  lateExcused: false,
  status: 'NEEDS_LOOK',
  minutesLate,
  plannedIn: '06:00',
  clockIn: `06:${String(minutesLate).padStart(2, '0')}`,
  ...extra,
});

describe('selectFacts', () => {
  const days = [row('2026-09-02', 6), row('2026-09-09', 9), row('2026-09-16', 8), row('2026-09-23', 9), row('2026-09-30', 6)];

  it('counts the unexcused late days of the month and totals the minutes', () => {
    const facts = selectFacts('LATENESS', '2026-09', days);
    expect(facts).toMatchObject({ kind: 'LATENESS', count: 5, minutes: 38 });
    expect(facts?.days.map((d) => d.date)).toEqual(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30']);
  });

  it('leaves out excused days and days of other months, and sorts by date', () => {
    const mixed = [row('2026-09-16', 8, { lateExcused: true }), row('2026-10-01', 9), row('2026-09-09', 9), row('2026-09-02', 6)];
    const facts = selectFacts('LATENESS', '2026-09', mixed);
    expect(facts?.days.map((d) => d.date)).toEqual(['2026-09-02', '2026-09-09']);
    expect(facts?.minutes).toBe(15);
  });

  it('answers null when there is nothing unexcused', () => {
    expect(selectFacts('LATENESS', '2026-09', [row('2026-09-02', 6, { lateExcused: true })])).toBeNull();
    expect(selectFacts('LATENESS', '2026-08', days)).toBeNull();
  });

  it('absence uses ABSENT days a person did not approve', () => {
    const rows = [row('2026-09-03', 0, { reasons: ['ABSENT'] }), row('2026-09-10', 0, { reasons: ['ABSENT'], status: 'APPROVED' })];
    expect(selectFacts('ABSENCE', '2026-09', rows)).toMatchObject({ count: 1, minutes: 0 });
  });

  it('offers three months and defaults to the last completed one', () => {
    expect(offeredMonths('2026-10')).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(offeredMonths('2026-01')).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(defaultMonthKey('2026-10')).toBe('2026-09');
  });
});

describe('letter text helpers', () => {
  it('writes dates the way the letter reads', () => {
    expect(datesLong(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'] as NairobiDate[])).toBe('the 2nd, 9th, 16th, 23rd and 30th');
    expect(datesLong(['2026-09-11'] as NairobiDate[])).toBe('the 11th');
    expect(datesLong(['2026-09-01', '2026-09-21'] as NairobiDate[])).toBe('the 1st and 21st');
    expect(longDate('2026-10-09' as NairobiDate)).toBe('9 October 2026');
  });

  it('turns the own line into plain text and keeps blanks visible when a value is missing', () => {
    expect(plainText('  We spoke\non Thursday.\t\tThanks \u0007 ')).toBe('We spoke on Thursday. Thanks');
    expect(fillBlanks('A {x} and {y}', { x: 1 })).toBe('A 1 and {y}');
  });
});

describe('buildLetter', () => {
  const base: LetterInput = {
    level: 'WRITTEN_WARNING',
    about: 'LATENESS',
    personName: 'Mark Njoroge',
    personRole: 'Barista',
    siteName: 'Nyeri Town',
    issuerName: 'Faith Njeri',
    issuerRole: 'Branch Manager',
    facts: selectFacts('LATENESS', '2026-09', [row('2026-09-02', 6), row('2026-09-09', 9), row('2026-09-16', 8), row('2026-09-23', 9), row('2026-09-30', 6)]),
    ownLine: 'We spoke about this on Thursday 8 October 2026, and you agreed to arrive on time.',
    issuedAt: new Date('2026-10-09T13:42:00Z'),
    validUntil: '2027-04-09' as NairobiDate,
    appealDays: 7,
    appealBy: new Date('2026-10-16T20:59:59.999Z'),
    reducedFromFinalAt: null,
  };

  it('fills the written lateness letter from the wording constants', () => {
    const letter = buildLetter(base);
    expect(letter.subject).toBe('Written warning: late arrival for work');
    expect(letter.salutation).toBe('Dear Mark,');
    expect(letter.paragraphs[0]).toBe('This is a written warning. On 5 days in September 2026 (the 2nd, 9th, 16th, 23rd and 30th) you arrived after the start of your shift, 38 minutes late in total. The timesheets are attached to this notice and none of these arrivals was excused.');
    expect(letter.paragraphs[1]).toContain('If this does not improve, a final written warning may follow.');
    expect(letter.paragraphs[2]).toContain('until 9 April 2027');
    expect(letter.paragraphs[2]).toContain('within 7 days, by 16 October 2026');
    expect(letter.appealByLong).toBe('16 October 2026');
    expect(JSON.stringify(letter)).not.toMatch(/\{\w+\}/); // no blank left unfilled
  });

  it('never uses a title or a gendered word', () => {
    expect(JSON.stringify(buildLetter(base))).not.toMatch(/\b(Mr|Mrs|Ms|he|she|him|her|his)\b/);
  });

  it('a behaviour letter has no facts paragraph', () => {
    const letter = buildLetter({ ...base, about: 'BEHAVIOUR', facts: null });
    expect(letter.paragraphs[0]).toBe('This is a written warning about your behaviour at work.');
  });

  it('a final letter swaps the follow-up sentence for the hearing line', () => {
    const letter = buildLetter({ ...base, level: 'FINAL_WRITTEN_WARNING' });
    expect(letter.paragraphs[0]).toMatch(/^This is a final written warning\./);
    expect(letter.paragraphs[1]).toContain('HR will invite you to a hearing');
    expect(letter.paragraphs[1]).not.toContain('a final written warning may follow');
  });

  it('a reduced written letter carries the reduction line and gives no new appeal', () => {
    const letter = buildLetter({ ...base, appealBy: null, appealDays: 0, reducedFromFinalAt: new Date('2026-10-12T08:00:00Z') });
    expect(letter.paragraphs.join(' ')).toContain('Reduced on appeal from a final written warning on 12 October 2026.');
    expect(letter.paragraphs.join(' ')).toContain('cannot be appealed again');
    expect(letter.appealByLong).toBeNull();
  });

  it('the own line cannot carry markup breaks: control characters are flattened', () => {
    const letter = buildLetter({ ...base, ownLine: 'Line one\nLine two <b>bold</b>' });
    expect(letter.paragraphs[1]).toContain('Line one Line two <b>bold</b>'); // text stays text; the PDF never renders markup
  });

  it('writes the verbal note record line', () => {
    expect(verbalNoteLine(new Date('2026-10-09T13:42:00Z'), 'Branch Manager', 'Spoke about timekeeping.')).toBe('Verbal note recorded on 9 October 2026 by Branch Manager: Spoke about timekeeping.');
  });
});
