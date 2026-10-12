import { describe, expect, it } from 'vitest';
import { BRANCH_WASTE_ERROR_CODES } from '../types/waste-contract';
import {
  BRANCH_WASTE_BUTTONS,
  BRANCH_WASTE_ERROR_COPY,
  BRANCH_WASTE_MESSAGES,
  BRANCH_WASTE_STATES_COPY,
  BRANCH_WASTE_WHO,
  BRANCH_WASTE_WORDS,
} from './branch-waste-copy';

describe('branch waste wording (Paper W9)', () => {
  it('has the seven words and the three who-does-what rows W9 draws', () => {
    expect(BRANCH_WASTE_WORDS).toHaveLength(7);
    expect(BRANCH_WASTE_WHO).toHaveLength(3);
  });

  it('the phone buttons read as W9 gives them, with no PIN anywhere', () => {
    expect(BRANCH_WASTE_BUTTONS.review(1)).toBe('Review 1 item');
    expect(BRANCH_WASTE_BUTTONS.review(2)).toBe('Review 2 items');
    expect([BRANCH_WASTE_BUTTONS.confirm, BRANCH_WASTE_BUTTONS.back, BRANCH_WASTE_BUTTONS.more, BRANCH_WASTE_BUTTONS.reverse, BRANCH_WASTE_BUTTONS.keep, BRANCH_WASTE_BUTTONS.cancel]).toEqual([
      'Confirm and log waste',
      'Back to edit',
      'Log more waste',
      'Reverse entry',
      'Keep it',
      'Cancel',
    ]);
    const all = JSON.stringify([BRANCH_WASTE_WORDS, BRANCH_WASTE_BUTTONS, BRANCH_WASTE_MESSAGES, BRANCH_WASTE_STATES_COPY, BRANCH_WASTE_ERROR_COPY]);
    expect(all).not.toMatch(/\bPIN\b/);
  });

  it('the after-logging message is the one W9 quotes', () => {
    expect(BRANCH_WASTE_MESSAGES.afterLogging(2, '14:20')).toBe('2 items logged at 14:20. You can reverse your own entries today.');
    expect(BRANCH_WASTE_MESSAGES.beforeConfirm).toBe('Stock goes down only when you confirm. Nothing is deleted later; a wrong entry can be reversed.');
  });

  it('every error code has a line and no person is named', () => {
    expect(Object.keys(BRANCH_WASTE_ERROR_COPY).sort()).toEqual([...BRANCH_WASTE_ERROR_CODES].sort());
    expect(JSON.stringify([BRANCH_WASTE_WORDS, BRANCH_WASTE_WHO, BRANCH_WASTE_STATES_COPY])).not.toMatch(/Peter|Joseph|Grace|Samuel/);
  });

  it('every screen of the group has loading, empty and error words (a screen with no empty state says null)', () => {
    expect(Object.keys(BRANCH_WASTE_STATES_COPY).sort()).toEqual(['allBranches', 'amount', 'branchList', 'check', 'department', 'pick', 'reverseAny', 'reversePhone']);
    for (const copy of Object.values(BRANCH_WASTE_STATES_COPY)) {
      expect(copy).toHaveProperty('loading');
      expect(copy).toHaveProperty('empty');
      expect(copy).toHaveProperty('error');
    }
  });
});
