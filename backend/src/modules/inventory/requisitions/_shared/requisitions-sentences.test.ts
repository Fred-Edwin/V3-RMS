import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, type EventType } from './requisitions-contract';
import { NAMES_REQUISITION, ON_BEHALF_REASON, sentenceOf, type SentenceEvent } from './requisitions-sentences';

const ctx = { reference: 'REQ-NYR-0112', departmentName: 'Kitchen', line: { itemName: 'Milk', unit: 'L' } };
const ev = (type: EventType, over: Partial<SentenceEvent> = {}): SentenceEvent => ({ type, fromValue: null, toValue: null, reason: null, ...over });

describe('sentenceOf', () => {
  it('words the contract example exactly', () => {
    expect(sentenceOf(ev('APPROVED', { fromValue: '40', toValue: 'BRANCH_MANAGER' }), ctx)).toBe('Approved REQ-NYR-0112 · 40 lines · signed with PIN');
    expect(sentenceOf(ev('APPROVED', { fromValue: '1' }), ctx)).toBe('Approved REQ-NYR-0112 · 1 line · signed with PIN');
  });

  it('an approval recorded without a line count (older events) still reads', () => {
    expect(sentenceOf(ev('APPROVED', { toValue: 'DIRECTOR' }), ctx)).toBe('Approved REQ-NYR-0112 · signed with PIN');
  });

  it.each([
    [ev('STARTED', { toValue: 'AFTERNOON' }), 'Started REQ-NYR-0112 · Afternoon'],
    [ev('LINE_CHANGED', { toValue: '4 lines' }), "Changed Kitchen's list · 4 lines"],
    [ev('LINE_CHANGED', { toValue: '4 lines', reason: ON_BEHALF_REASON }), "Filled Kitchen's list on behalf of its head · 4 lines"],
    [ev('SENT'), "Sent Kitchen's list · signed with PIN"],
    [ev('SENT', { reason: ON_BEHALF_REASON }), "Sent Kitchen's list on behalf of its head · signed with PIN"],
    [ev('RECALLED'), "Took Kitchen's list back to draft"],
    [ev('QUANTITY_CHANGED', { fromValue: '30.0000', toValue: '24', reason: 'Not enough in the store' }), 'Changed Milk in Kitchen from 30 L to 24 L · Not enough in the store'],
    [ev('SKIPPED'), "Sent without Kitchen's list"],
    [ev('NUDGED'), 'Nudged Kitchen'],
    [ev('URGENT_SET'), 'Marked Urgent'],
    [ev('URGENT_SET', { toValue: 'Wedding at 4' }), 'Marked Urgent · Wedding at 4'],
    [ev('URGENT_CLEARED'), 'Cleared Urgent'],
    [ev('CANCELLED', { reason: 'No longer needed' }), 'Cancelled REQ-NYR-0112 · No longer needed'],
    [ev('ADDITION_ADDED', { toValue: '3 lines' }), "Added 3 lines to Kitchen's list after approval · signed with PIN"],
    [ev('ADDITION_APPROVED'), "Approved Kitchen's added lines · signed with PIN"],
  ])('%#', (event, expected) => {
    expect(sentenceOf(event, ctx)).toBe(expected);
  });

  it('has a sentence for every event type, and falls back gracefully without a department or line', () => {
    for (const type of EVENT_TYPES) {
      const text = sentenceOf(ev(type), { reference: 'REQ-NYR-0112', departmentName: null, line: null });
      expect(text.length).toBeGreaterThan(5);
    }
    expect(sentenceOf(ev('QUANTITY_CHANGED', { fromValue: '3', toValue: '2' }), { reference: 'R', departmentName: null, line: null })).toBe('Changed a line from 3 to 2');
  });

  it('never carries an account, a PIN or a number that was not recorded', () => {
    for (const type of EVENT_TYPES) {
      const text = sentenceOf(ev(type, { toValue: null }), ctx);
      expect(text).not.toMatch(/pin\s*[:=]?\s*\d|account|\d{4}-\d{4}/i);
    }
  });

  it('names the requisition only for the events that say its reference', () => {
    for (const type of EVENT_TYPES) {
      const names = sentenceOf(ev(type, { fromValue: '2', reason: 'x' }), ctx).includes(ctx.reference);
      expect(names).toBe(NAMES_REQUISITION.includes(type));
    }
  });
});
