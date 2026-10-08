import { describe, expect, it } from 'vitest';
import fixtures from '../types/requisitions-contract.fixtures.json';
import type { RequisitionFile } from '../types/requisitions-contract';
import { changesSentence, clock, elapsed, errorWords, fileChip, kes, nextStepWords, trackerWords } from './requisitions-words';

const file = fixtures.fileManager as RequisitionFile;

describe('requisitions words', () => {
  it('formats Nairobi time and money', () => {
    expect(clock('2026-10-07T10:42:00.000Z')).toBe('1:42 pm');
    expect(kes('58020.00')).toBe('58,020');
    expect(elapsed('2026-10-07T10:00:00.000Z', Date.parse('2026-10-07T11:01:00.000Z'))).toBe('1 h 01 min');
    expect(elapsed('2026-10-07T10:00:00.000Z', Date.parse('2026-10-07T10:17:00.000Z'))).toBe('17 min');
  });

  it('writes the Ready to approve card from Paper', () => {
    const words = nextStepWords(file);
    expect(words.title).toBe('Everything is in. Ready for your signature.');
    expect(words.actionLabel).toBe('Approve and sign');
  });

  it('writes the Collecting card with the missing department', () => {
    const collecting: RequisitionFile = {
      ...file,
      status: 'OPEN',
      nextStep: { action: 'NUDGE', departmentId: file.sections[1]!.departmentId, facts: { sectionsIn: 4, sectionsTotal: 5, additionsWaiting: 0 } },
    };
    const words = nextStepWords(collecting);
    expect(words.title).toBe("Housekeeping hasn't sent yet");
    expect(words.actionLabel).toBe('Nudge Housekeeping');
    expect(words.body).toContain('4 of 5 sections are in');
  });

  it('writes the tracker labels and second lines', () => {
    const words = trackerWords(file.tracker, true);
    expect(words.map((w) => w.label)).toEqual(['Started', 'All sections in', 'Approved', 'Packed and sent', 'Counted at the branch', 'Closed']);
    expect(words[0]!.second).toBe('1:42 pm · Kitchen Head');
    expect(words[2]!.second).toBe('Waiting for you');
  });

  it('chooses the chip', () => {
    expect(fileChip(file).text).toBe('Ready to approve');
  });

  it('words errors by audience and falls back', () => {
    expect(errorWords('SECTION_NOT_SENT', 'manager', null, 'x')).toBe("That section hasn't been sent yet.");
    expect(errorWords('SECTION_NOT_SENT', 'head', null, 'x')).toBe("Your list hasn't been sent yet.");
    expect(errorWords('UNKNOWN', 'manager', 'From server', 'x')).toBe('From server');
    expect(errorWords(null, 'manager', null, 'Try again')).toBe('Try again');
  });

  it('lists changes in a sentence', () => {
    expect(changesSentence([{ itemName: 'Beef patty 120g', from: '30', to: '24' }, { itemName: 'Flour 25kg', from: '6', to: '4' }])).toBe(
      'You changed 2 lines: Beef patty 120g (30 to 24) and Flour 25kg (6 to 4).',
    );
  });
});
