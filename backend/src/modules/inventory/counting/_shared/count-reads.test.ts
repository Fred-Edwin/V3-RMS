import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lastCountedByItem, longestWithoutCount, sectionNamesByItem, todaysCounts, unsectionedCount } from './count-reads';
import { countReadsRepository } from './count-reads-repository';

vi.mock('./count-reads-repository', () => ({
  countReadsRepository: {
    countsInWindow: vi.fn(),
    sectionsLastCounted: vi.fn(),
    itemsLastCounted: vi.fn(),
    lastCountedByItem: vi.fn(),
    sectionNamesByItem: vi.fn(),
    unsectionedCount: vi.fn(),
  },
}));

const at = (iso: string) => new Date(iso);

beforeEach(() => vi.resetAllMocks());

describe('todaysCounts', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'c1',
    reference: 'CNT-2026-0001',
    status: 'OPEN' as const,
    selfSigned: false,
    startedAt: at('2026-10-13T05:00:00Z'),
    signedAt: null,
    counterName: 'Linnet Wanjiru',
    scopeNames: ['Samrat'],
    firstItemNames: [],
    ...over,
  });

  it('asks for the Nairobi day of now (00:00 to 00:00 Nairobi)', async () => {
    vi.mocked(countReadsRepository.countsInWindow).mockResolvedValue([]);
    await todaysCounts('hub', at('2026-10-13T20:30:00Z')); // 23:30 Nairobi on the 13th
    const [siteId, from, to] = vi.mocked(countReadsRepository.countsInWindow).mock.calls[0]!;
    expect(siteId).toBe('hub');
    expect(from.toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-13T21:00:00.000Z');
  });

  it('words the sections, and falls back to item names for a recount; latest activity first', async () => {
    vi.mocked(countReadsRepository.countsInWindow).mockResolvedValue([
      row({ id: 'a', scopeNames: ['Others', 'Packaging'] }),
      row({ id: 'b', scopeNames: [], firstItemNames: ['Eggs'], startedAt: at('2026-10-13T08:00:00Z') }),
      row({ id: 'c', status: 'SUBMITTED', startedAt: at('2026-10-13T03:00:00Z'), signedAt: at('2026-10-13T09:00:00Z') }),
    ]);
    const counts = await todaysCounts('hub', at('2026-10-13T10:00:00Z'));
    expect(counts.map((c) => [c.id, c.sectionsText, c.status])).toEqual([
      ['c', 'Samrat', 'SUBMITTED'],
      ['b', 'Eggs', 'OPEN'],
      ['a', 'Others, Packaging', 'OPEN'],
    ]);
    expect(counts[0]).toMatchObject({ counterName: 'Linnet Wanjiru', selfSigned: false, signedAt: at('2026-10-13T09:00:00Z') });
  });
});

describe('longestWithoutCount', () => {
  const section = (id: string, name: string, lastCountedAt: Date | null, itemCount = 10) => ({ id, name, itemCount, lastCountedAt });
  const item = (id: string, name: string, sectionId: string, sectionName: string, lastCountedAt: Date | null) => ({ id, name, sectionId, sectionName, lastCountedAt });

  it('never-counted sorts first, then the oldest, sections before items on a tie', async () => {
    vi.mocked(countReadsRepository.sectionsLastCounted).mockResolvedValue([
      section('s1', 'Samrat', at('2026-10-12T05:30:00Z')),
      section('s2', 'Others', at('2026-10-07T05:30:00Z'), 150),
      section('s3', 'Packaging', null, 4),
    ]);
    vi.mocked(countReadsRepository.itemsLastCounted).mockResolvedValue([]);
    const rows = await longestWithoutCount('hub', at('2026-10-13T06:00:00Z'), 10);
    expect(rows.map((r) => [r.kind, r.name, r.itemCount])).toEqual([
      ['SECTION', 'Packaging', 4],
      ['SECTION', 'Others', 150],
      ['SECTION', 'Samrat', 10],
    ]);
    expect(rows[0]).toMatchObject({ refId: 's3', lastCountedAt: null, sectionName: null });
  });

  it('lists an item only when its own last count is older than its counted section’s', async () => {
    vi.mocked(countReadsRepository.sectionsLastCounted).mockResolvedValue([
      section('s1', 'Samrat', at('2026-10-12T05:30:00Z')),
      section('s2', 'Others', null),
    ]);
    vi.mocked(countReadsRepository.itemsLastCounted).mockResolvedValue([
      item('i1', 'Brown sugar', 's1', 'Samrat', at('2026-10-07T05:30:00Z')), // skipped since: listed
      item('i2', 'Rice', 's1', 'Samrat', at('2026-10-12T05:30:00Z')), // counted with its section: not listed
      item('i3', 'Tea', 's1', 'Samrat', null), // never counted though the section was: listed first
      item('i4', 'Salt', 's2', 'Others', null), // its section was never counted: the section covers it
    ]);
    const rows = await longestWithoutCount('hub', at('2026-10-13T06:00:00Z'), 10);
    expect(rows.map((r) => `${r.kind}:${r.name}`)).toEqual(['SECTION:Others', 'ITEM:Tea', 'ITEM:Brown sugar', 'SECTION:Samrat']);
    expect(rows[1]).toMatchObject({ sectionName: 'Samrat', itemCount: null, refId: 'i3' });
  });

  it('honours the limit', async () => {
    vi.mocked(countReadsRepository.sectionsLastCounted).mockResolvedValue([section('s1', 'A', null), section('s2', 'B', null), section('s3', 'C', null)]);
    vi.mocked(countReadsRepository.itemsLastCounted).mockResolvedValue([]);
    expect(await longestWithoutCount('hub', at('2026-10-13T06:00:00Z'), 1)).toHaveLength(1);
    expect(await longestWithoutCount('hub', at('2026-10-13T06:00:00Z'), 0)).toEqual([]);
  });
});

describe('the item maps', () => {
  it('lastCountedByItem keys the latest count by item id', async () => {
    vi.mocked(countReadsRepository.lastCountedByItem).mockResolvedValue([{ itemId: 'i1', at: at('2026-10-12T05:30:00Z'), reference: 'CNT-2026-0006' }]);
    const map = await lastCountedByItem('hub', ['i1', 'i2']);
    expect(map.get('i1')).toEqual({ at: at('2026-10-12T05:30:00Z'), reference: 'CNT-2026-0006' });
    expect(map.has('i2')).toBe(false);
  });

  it('sectionNamesByItem and unsectionedCount pass through', async () => {
    vi.mocked(countReadsRepository.sectionNamesByItem).mockResolvedValue([{ itemId: 'i1', name: 'Samrat' }]);
    vi.mocked(countReadsRepository.unsectionedCount).mockResolvedValue(3);
    expect((await sectionNamesByItem('hub', ['i1'])).get('i1')).toBe('Samrat');
    expect(await unsectionedCount('hub')).toBe(3);
    expect(countReadsRepository.unsectionedCount).toHaveBeenCalledWith('hub');
  });
});
