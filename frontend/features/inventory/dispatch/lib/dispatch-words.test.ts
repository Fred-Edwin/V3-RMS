import { describe, expect, it } from 'vitest';

import { requisitionProgress } from '../../requisitions/_shared/lib/requisition-progress';
import { DISPATCH_STAGES } from '../_shared/types/dispatch-contract';
import { drawerTitle, errorText, findingDescription, gapSentence, stageChip } from './dispatch-words';

describe('dispatch words (Paper D22)', () => {
  it('gives every dispatch stage a chip with the word Paper draws', () => {
    for (const stage of DISPATCH_STAGES) expect(stageChip(stage).text.length).toBeGreaterThan(0);
    expect(stageChip('GAP_HELD').text).toBe('Gap held · needs a finding');
    expect(stageChip('WAITING_FOR_BRANCH')).toEqual({ text: 'Waiting for the branch', tone: 'warning' });
    expect(stageChip('CANCELLED').tone).toBe('neutral');
  });

  it('writes the gap and drawer titles with a space after the number', () => {
    expect(gapSentence('Milk 1L', '-2')).toBe('Milk 1L is short by 2');
    expect(gapSentence('Milk 1L', '2')).toBe('Milk 1L is over by 2');
    expect(drawerTitle('Milk 1L', 2, 'SHORT')).toBe('What happened to the 2 milk?');
    expect(drawerTitle('Milk 1L', 2, 'EXTRA')).toBe('What happened to the 2 extra milk?');
  });

  it('describes the extra findings in the D22 wording', () => {
    const ctx = { sent: '24', counted: '26', gap: 2, item: 'Milk 1L' };
    expect(findingDescription('PACKED_MORE', 'EXTRA', ctx).body).toContain('The store sent 26 but recorded 24. Store stock goes down by 2.');
    expect(findingDescription('BRANCH_COUNTED_WRONG', 'EXTRA', ctx).body).toContain('Only 24 arrived');
    expect(findingDescription('CANT_TELL', 'EXTRA', ctx).body).toContain('unexplained surplus');
  });

  it('has wording for every error code the desktop screens handle', () => {
    for (const code of ['INVALID_PIN', 'DISPATCH_ALREADY_COUNTED', 'CARRIER_NAME_TAKEN', 'FINDING_ALREADY_RECORDED', 'FINDING_NOT_REVERSIBLE', 'ALREADY_SIGNED', 'CARRIER_INACTIVE']) {
      expect(errorText(code, 'server message')).not.toBe('server message');
    }
    expect(errorText('SOMETHING_NEW', 'server message')).toBe('server message');
    expect(errorText(null, null)).toBe('Something went wrong. Try again.');
  });
});

describe('requisition progress (Paper D22 tracker)', () => {
  const step = (key: 'STARTED' | 'ALL_IN' | 'APPROVED' | 'PACKED' | 'DELIVERED' | 'CLOSED', state: 'DONE' | 'CURRENT' | 'TODO', count: { done: number; total: number } | null = null) => ({ key, state, at: '2026-10-09T08:00:00.000Z', by: null, count });

  it('always has the five steps Asked, Approved, Packed and signed, On the way, Counted', () => {
    const steps = requisitionProgress([step('STARTED', 'DONE'), step('ALL_IN', 'DONE'), step('APPROVED', 'DONE'), step('PACKED', 'CURRENT', { done: 4, total: 5 }), step('DELIVERED', 'TODO', { done: 0, total: 5 }), step('CLOSED', 'TODO')], false);
    expect(steps.map((s) => s.label)).toEqual(['Asked', 'Approved', 'Packed and signed', 'On the way', 'Counted']);
  });

  it('reads "4 of 5 sent" and "0 of 5 counted" across departments', () => {
    const steps = requisitionProgress([step('STARTED', 'DONE'), step('ALL_IN', 'DONE'), step('APPROVED', 'DONE'), step('PACKED', 'CURRENT', { done: 4, total: 5 }), step('DELIVERED', 'TODO', { done: 0, total: 5 }), step('CLOSED', 'TODO')], false);
    expect(steps[3]?.second).toContain('4 of 5 sent');
    expect(steps[3]?.state).toBe('CURRENT');
    expect(steps[4]?.second).toBe('0 of 5 counted');
  });

  it('shows the Branch Manager an amber, waiting-for-you Approved step', () => {
    const steps = requisitionProgress([step('STARTED', 'DONE'), step('ALL_IN', 'DONE'), { ...step('APPROVED', 'CURRENT'), at: null }, step('PACKED', 'TODO'), step('DELIVERED', 'TODO'), step('CLOSED', 'TODO')], true);
    expect(steps[1]).toMatchObject({ state: 'CURRENT', tone: 'act', second: 'Waiting for you' });
  });
});
