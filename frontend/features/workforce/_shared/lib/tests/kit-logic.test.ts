import { describe, expect, it } from 'vitest';

import { avatarTone, initialsOf } from '../style/avatar';
import { UNDO_WINDOW_MS } from '../style/interaction';
import {
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_KIND_TONE,
  NOTIFICATION_ROWS,
  notificationRow,
} from '../copy/notification-copy';
import { EMPTY_REASON, OTHER_REASON, isReasonComplete, reasonText } from '../data/reason';
import {
  STATES_COPY,
  SCREEN_KEYS,
  fillCopy,
  formatReference,
  statesCopy,
} from '../copy/states-copy';
import {
  clampPercent,
  completenessColour,
  isComplete,
  probationColour,
  probationProgress,
} from '../style/status-colour';
import { undoExpired, undoRemainingMs, undoSecondsLeft } from '../data/undo';

describe('completeness ring colour (red under 50, amber 50 to 84, green 85 to 99, solid green at 100)', () => {
  it.each([
    [0, 'red'],
    [49, 'red'],
    [50, 'amber'],
    [67, 'amber'],
    [84, 'amber'],
    [85, 'green'],
    [99, 'green'],
    [100, 'green'],
  ] as const)('%i percent is %s', (percent, colour) => {
    expect(completenessColour(percent)).toBe(colour);
  });
  it('only exactly 100 is complete (the tick)', () => {
    expect(isComplete(100)).toBe(true);
    expect(isComplete(99)).toBe(false);
    expect(isComplete(99.6)).toBe(true); // rounds to 100
  });
  it('clamps and survives bad numbers', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(completenessColour(Number.NaN)).toBe('red');
  });
});

describe('probation bar colour (green over 30 days left, amber at 30 or fewer, red at 7 or fewer)', () => {
  it.each([
    [90, 'green'],
    [31, 'green'],
    [30, 'amber'],
    [10, 'amber'],
    [8, 'amber'],
    [7, 'red'],
    [0, 'red'],
    [-3, 'red'],
  ] as const)('%i days left is %s', (daysLeft, colour) => {
    expect(probationColour(daysLeft)).toBe(colour);
  });
  it('progress is the share of the period used, held between 0 and 100', () => {
    expect(probationProgress(80, 90)).toBe(89); // Paper's "Day 80 of 90"
    expect(probationProgress(120, 90)).toBe(100);
    expect(probationProgress(5, 0)).toBe(0);
  });
});

describe('avatars', () => {
  it('takes initials from first and last name', () => {
    expect(initialsOf('Joy Chebet')).toBe('JC');
    expect(initialsOf('  mary wanjiru  kamau ')).toBe('MK');
    expect(initialsOf('Cher')).toBe('CH');
    expect(initialsOf('')).toBe('?');
  });
  it('gives a person the same tile every time', () => {
    expect(avatarTone('Joy Chebet')).toEqual(avatarTone('Joy Chebet'));
  });
});

describe('reason chips', () => {
  it('needs a chip, and words for "Other"', () => {
    expect(isReasonComplete(EMPTY_REASON)).toBe(false);
    expect(isReasonComplete({ choice: 'cover', otherText: '' })).toBe(true);
    expect(isReasonComplete({ choice: OTHER_REASON, otherText: '   ' })).toBe(false);
    expect(isReasonComplete({ choice: OTHER_REASON, otherText: 'Bus broke down' })).toBe(true);
  });
  it('stores the label of a chip, or the written words', () => {
    const labels = { cover: 'Cover for a gap' };
    expect(reasonText({ choice: 'cover', otherText: '' }, labels)).toBe('Cover for a gap');
    expect(reasonText({ choice: OTHER_REASON, otherText: ' Bus broke down ' }, labels)).toBe('Bus broke down');
    expect(reasonText(EMPTY_REASON, labels)).toBeNull();
  });
});

describe('undo window (30 seconds)', () => {
  it('is 30 seconds', () => {
    expect(UNDO_WINDOW_MS).toBe(30_000);
  });
  it('counts down and stops at zero', () => {
    expect(undoRemainingMs(1000, 1000)).toBe(30_000);
    expect(undoRemainingMs(1000, 16_000)).toBe(15_000);
    expect(undoRemainingMs(1000, 31_000)).toBe(0);
    expect(undoRemainingMs(1000, 99_000)).toBe(0);
  });
  it('is expired only when nothing is left, and shows 1 s until the end', () => {
    expect(undoExpired(0, 29_999)).toBe(false);
    expect(undoExpired(0, 30_000)).toBe(true);
    expect(undoSecondsLeft(0, 29_500)).toBe(1);
    expect(undoSecondsLeft(0, 0)).toBe(30);
  });
});

// The screens of the Paper table "Workforce · States kit" (1Q84-0), in order. If a screen is added in
// Paper, add it here AND to STATES_COPY; this list is what fails the build when a key goes missing.
const PAPER_SCREENS: Array<[key: (typeof SCREEN_KEYS)[number], paperName: string]> = [
  ['waitingForYou', 'Needs you'],
  ['rota', 'Rota'],
  ['todayBoard', 'Today board'],
  ['timesheets', 'Timesheets'],
  ['myTime', 'My time and My requests'],
  ['leave', 'Leave requests and balances'],
  ['conduct', 'Conduct'],
  ['pay', 'Pay runs and payslips'],
  ['people', 'Employees and Organisation'],
  ['audit', 'Audit log and Signed documents'],
  ['rules', 'Rules'],
  // Added in production (Segment 6a, 6b M3).
  ['myPayslips', 'My payslips'],
  ['securityAlerts', 'Security alerts'],
  ['phones', 'Phones'],
];

describe('per-screen copy table (States kit)', () => {
  it('has a row for every screen in the Paper table, under the Paper name', () => {
    for (const [key, paperName] of PAPER_SCREENS) {
      expect(STATES_COPY[key], `missing screen key ${key}`).toBeDefined();
      expect(STATES_COPY[key].screen).toBe(paperName);
    }
    expect(Object.keys(STATES_COPY).sort()).toEqual(PAPER_SCREENS.map(([k]) => k).sort());
    expect([...SCREEN_KEYS].sort()).toEqual(PAPER_SCREENS.map(([k]) => k).sort());
  });
  it('has all three lines on every row', () => {
    for (const key of SCREEN_KEYS) {
      const row = STATES_COPY[key];
      expect(row.nothingYet.length, `${key}.nothingYet`).toBeGreaterThan(0);
      expect(row.nothingFound.length, `${key}.nothingFound`).toBeGreaterThan(0);
      expect(row.error.length, `${key}.error`).toBeGreaterThan(0);
    }
  });
  it('never blames the person and says whether anything was lost', () => {
    for (const key of SCREEN_KEYS) {
      const { error } = STATES_COPY[key];
      expect(error).toMatch(/^We could not /);
      expect(error).not.toMatch(/\byou (did|forgot|failed)\b/i);
      expect(error).toMatch(/(safe|changed|published|old|recorded|affected)/i);
    }
  });
  it('only Rules is marked not applicable', () => {
    expect(SCREEN_KEYS.filter((k) => STATES_COPY[k].notApplicable)).toEqual(['rules']);
  });
  it('fills the term and range holes, and leaves a missing value visible', () => {
    expect(statesCopy('waitingForYou', 'nothingFound', { term: 'Overtime' })).toBe('No request matches "Overtime". Clear the filter.');
    expect(statesCopy('waitingForYou', 'nothingYet')).toBe('Nothing needs you. New requests show here, in the bell and as badges on the menu.');
    expect(statesCopy('rota', 'nothingYet', { range: '19 to 25 Oct' })).toBe('No rota for 19 to 25 Oct yet. Start from last week or from a template.');
    expect(fillCopy('No shift matches "{term}".')).toBe('No shift matches "{term}".');
  });
  it('formats the support reference', () => {
    expect(formatReference('1a2b')).toBe('WF-1A2B');
    expect(formatReference('WF-1a2b')).toBe('WF-1A2B');
  });
});

describe('notification wording table', () => {
  it('has unique keys and every field filled', () => {
    const keys = NOTIFICATION_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of NOTIFICATION_ROWS) {
      expect(r.event.length, r.key).toBeGreaterThan(0);
      expect(r.whoIsTold.length, r.key).toBeGreaterThan(0);
      expect(r.wording.length, r.key).toBeGreaterThan(0);
      expect(NOTIFICATION_KIND_LABEL[r.kind], r.key).toBeDefined();
      expect(NOTIFICATION_KIND_TONE[r.kind], r.key).toBeDefined();
    }
  });
  it('carries every event row of the Paper table (40: its 42 rows, less the header and the "Where and when" row) and the four Segment 3 kinds the back end sends', () => {
    expect(NOTIFICATION_ROWS).toHaveLength(44);
  });
  it('never opens with "Dear" and never asks for a decision in the wording', () => {
    for (const r of NOTIFICATION_ROWS) {
      expect(r.wording, r.key).not.toMatch(/^Dear\b/);
    }
  });
  it('finds a row by key', () => {
    expect(notificationRow('shiftChanged')?.wording).toBe('Sat 17 changed: day off is now Morning. Changed by Faith Njeri. Reason: cover for a gap.');
    expect(notificationRow('nope')).toBeUndefined();
  });
});
