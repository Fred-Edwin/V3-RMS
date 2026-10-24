import { describe, expect, it } from 'vitest';
import { highlightParts, labelDetail } from './person-label';

describe('person label text', () => {
  it('marks the letters that match, whatever the case', () => {
    expect(highlightParts('Victor Maina', 'vic')).toEqual([{ text: 'Vic', match: true }, { text: 'tor Maina', match: false }]);
  });
  it('marks every place it matches', () => {
    expect(highlightParts('Anna Hanna', 'an').filter((p) => p.match)).toHaveLength(2);
  });
  it('marks nothing for an empty search or no match', () => {
    expect(highlightParts('Joy Chebet', '  ')).toEqual([{ text: 'Joy Chebet', match: false }]);
    expect(highlightParts('Joy Chebet', 'zzz')).toEqual([{ text: 'Joy Chebet', match: false }]);
  });
  it('joins position and site, and leaves out what is missing', () => {
    expect(labelDetail('Head of Kitchen', 'Nyeri Town')).toBe('Head of Kitchen · Nyeri Town');
    expect(labelDetail(null, 'Nyeri Town')).toBe('Nyeri Town');
    expect(labelDetail(null, undefined)).toBeNull();
  });
});
