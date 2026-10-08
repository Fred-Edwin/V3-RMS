import { describe, expect, it } from 'vitest';
import { REQUISITION_STATUS_TEXT } from '../types/requisitions-contract';
import { REQUISITIONS_KIT_COPY, REQUISITIONS_WORDING, REQUISITION_EVERY_STATE, REQUISITION_STATUS_WORDS, wordsFor } from './states-copy';

describe('requisitions states copy', () => {
  it('has the eight moments of Paper step 22 and the seven rows of the state table', () => {
    expect(REQUISITIONS_WORDING).toHaveLength(8);
    expect(REQUISITION_EVERY_STATE).toHaveLength(7);
  });

  it('the status words agree with the contract', () => {
    expect(REQUISITION_STATUS_WORDS).toEqual(REQUISITION_STATUS_TEXT);
  });

  it('uses titles, never names, in the screen copy', () => {
    const text = JSON.stringify([REQUISITIONS_WORDING, REQUISITION_EVERY_STATE, REQUISITIONS_KIT_COPY]);
    expect(text).not.toMatch(/Peter|Samrat|Grace|Isabel/);
  });

  it('looks words up by key, and the kit has an action only where there is something to press', () => {
    expect(wordsFor('cancel')[0]).toBe('Cancel this requisition?');
    expect('action' in REQUISITIONS_KIT_COPY.nothingWaiting).toBe(false);
    expect(REQUISITIONS_KIT_COPY.couldNotLoad.action).toBe('Retry');
  });
});
