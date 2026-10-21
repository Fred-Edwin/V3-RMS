import { describe, expect, it } from 'vitest';

import { countText, greetingLine, latestWhen, needsYouHeadline, needsYouPageLine, needsYouSubtitle, safeOpens, seeAllLabel, showingTop, sinceWords } from './role-home-words';

describe('Home words', () => {
  it('writes the headline from the counts', () => {
    expect(needsYouHeadline(0, 0)).toBe('Nothing needs you right now.');
    expect(needsYouHeadline(1, 0)).toBe('1 thing needs you.');
    expect(needsYouHeadline(14, 1)).toBe('14 things need you, and 1 is overdue.');
    expect(needsYouHeadline(5, 3)).toBe('5 things need you, and 3 are overdue.');
  });

  it('joins the date and the headline as Paper 1.1 does', () => {
    expect(greetingLine('Wednesday 21 October', '14 things need you, and 1 is overdue.')).toBe('Wednesday 21 October. 14 things need you, and 1 is overdue.');
    expect(greetingLine('Wednesday 21 October', null)).toBe('Wednesday 21 October.');
  });

  it('writes the section lines and the footer', () => {
    expect(needsYouSubtitle(14, 5)).toBe('14 in 5 kinds, most urgent first');
    expect(needsYouPageLine(14, 5)).toBe('14 things in 5 kinds. Overdue first, then grouped by kind.');
    expect(showingTop(5, 14)).toBe('Showing the top 5 of 14');
    expect(showingTop(5, 5)).toBeNull();
    expect(seeAllLabel(14)).toBe('See all 14');
  });

  it('says how long a row has waited in the Since column', () => {
    const now = new Date('2026-10-22T09:00:00Z');
    expect(sinceWords('2026-10-22T05:00:00Z', now)).toBe('TODAY');
    expect(sinceWords('2026-10-21T05:00:00Z', now)).toBe('1 DAY');
    expect(sinceWords('2026-10-15T05:00:00Z', now)).toBe('7 DAYS');
    expect(sinceWords('2026-09-30T05:00:00Z', now)).toBe('3 WEEKS');
  });

  it('writes the Latest time as the clock today, YEST, then the date', () => {
    const now = new Date('2026-10-22T09:00:00Z');
    expect(latestWhen('2026-10-22T07:05:00Z', now)).toBe('10:05');
    expect(latestWhen('2026-10-21T07:05:00Z', now)).toBe('YEST');
    expect(latestWhen('2026-10-19T07:05:00Z', now)).toBe('19 OCT');
  });

  it('caps a count at 99+ and keeps links inside the app', () => {
    expect(countText(99)).toBe('99');
    expect(countText(100)).toBe('99+');
    expect(safeOpens('/app/workforce/leave')).toBe('/app/workforce/leave');
    expect(safeOpens('https://evil.example')).toBe('/app/workforce');
  });
});
