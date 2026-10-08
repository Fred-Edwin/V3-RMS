import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStories } from './count-story-reader';
import { countStoryRepository } from './count-story-repository';
import { D, count, frozen, hubId, itemIdOf, line, lineIdOf, signedLine, storeId } from './count-fixtures';

vi.mock('./count-story-repository', () => ({
  countStoryRepository: { dispatches: vi.fn(), prepRuns: vi.fn(), deliveries: vi.fn(), isPrepRecipeInput: vi.fn(), usedInPrepLastWeek: vi.fn() },
}));

const signedAt = new Date('2026-10-13T04:42:00Z');
const signed = (lines: ReturnType<typeof line>[]) => count(lines, { status: 'SUBMITTED', signedAt, expectedAsOf: signedAt, ...frozen });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(countStoryRepository.dispatches).mockResolvedValue([]);
  vi.mocked(countStoryRepository.prepRuns).mockResolvedValue([]);
  vi.mocked(countStoryRepository.deliveries).mockResolvedValue([]);
  vi.mocked(countStoryRepository.isPrepRecipeInput).mockResolvedValue(false);
  vi.mocked(countStoryRepository.usedInPrepLastWeek).mockResolvedValue(false);
});

describe('readStories', () => {
  it('tells a story only for the outside-range lines of a signed count', async () => {
    const c = signed([signedLine(1, 164, 180, 'EXCEEDS'), signedLine(2, 99, 100, 'WITHIN_RANGE'), signedLine(3, 40, 40, 'MATCHES'), signedLine(4, null, 5, 'NOT_COUNTED')]);
    const stories = await readStories({ siteId: hubId, locationId: storeId, count: c, lastCounted: new Map() });
    expect([...stories.keys()]).toEqual([lineIdOf(1)]);
    expect(stories.get(lineIdOf(1))).toEqual({ story: 'No movement since the last count.', suggestedCause: null });
  });

  it('judges the window from the previous count to the sign time, or 7 days back when never counted', async () => {
    const prev = new Date('2026-10-10T05:00:00Z');
    const c = signed([signedLine(1, 1, 100, 'EXCEEDS'), signedLine(2, 1, 100, 'EXCEEDS')]);
    await readStories({ siteId: hubId, locationId: storeId, count: c, lastCounted: new Map([[itemIdOf(1), prev]]) });
    const windows = vi.mocked(countStoryRepository.dispatches).mock.calls.map(([w]) => [w.itemId, w.from.toISOString(), w.to.toISOString()]);
    expect(windows).toContainEqual([itemIdOf(1), prev.toISOString(), signedAt.toISOString()]);
    expect(windows).toContainEqual([itemIdOf(2), '2026-10-06T04:42:00.000Z', signedAt.toISOString()]);
  });

  it('puts the repository facts through the five rules (a prep recipe input nobody used for a week suggests "prep not logged")', async () => {
    vi.mocked(countStoryRepository.isPrepRecipeInput).mockResolvedValue(true);
    const c = signed([signedLine(1, 164, 180, 'EXCEEDS', { name: 'Sugar, white' })]);
    const stories = await readStories({ siteId: hubId, locationId: storeId, count: c, lastCounted: new Map([[itemIdOf(1), new Date('2026-10-07T05:30:00Z')]]) });
    expect(stories.get(lineIdOf(1))).toEqual({ story: 'No prep use logged for sugar this week. Last counted 6 days ago.', suggestedCause: 'PREP_NOT_LOGGED' });
  });

  it('an OPEN count has no stories and asks the repository nothing', async () => {
    const c = count([line(1, { countedQty: D(1) })]);
    expect((await readStories({ siteId: hubId, locationId: storeId, count: c, lastCounted: new Map() })).size).toBe(0);
    expect(countStoryRepository.dispatches).not.toHaveBeenCalled();
  });
});
