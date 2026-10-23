import { describe, expect, it } from 'vitest';
import { correctionNote } from '../correction-note';

describe('the hiring manager’s 24-hour correction note', () => {
  const now = new Date('2026-10-22T09:00:00Z');
  it('says until when, in Nairobi time, and that HR takes over after', () => {
    expect(correctionNote('2026-10-23T11:05:00Z', now)).toBe('You can correct this until Fri 23 Oct, 14:05; after that ask HR.');
  });
  it('says nothing when the window is not running or is over', () => {
    expect(correctionNote(null, now)).toBeNull();
    expect(correctionNote('2026-10-22T08:00:00Z', now)).toBeNull();
    expect(correctionNote('not a date', now)).toBeNull();
  });
});
