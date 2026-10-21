import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAudited } from '../../_shared/audit/audit-writer';
import { hireRepository } from './hire-repository';
import { backfillReportsTo } from './reports-to-backfill';

vi.mock('./hire-repository', () => ({
  hireRepository: { findWithoutBoss: vi.fn(), findSiteManager: vi.fn(), setBossIfNone: vi.fn() },
}));
vi.mock('../../_shared/audit/audit-writer', () => ({
  runAudited: vi.fn(async (change: (tx: unknown) => Promise<{ result: unknown }>) => (await change({})).result),
}));

describe('backfillReportsTo (finding 12)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gives people without a boss the site manager, audited by the system, and skips the manager and manager-less sites', async () => {
    vi.mocked(hireRepository.findWithoutBoss).mockResolvedValue([
      { id: 'e1', siteId: 's1', userId: null },
      { id: 'mgr', siteId: 's1', userId: 'u9' },
      { id: 'e3', siteId: 's2', userId: null },
    ]);
    vi.mocked(hireRepository.findSiteManager).mockImplementation(((_c: string, siteId: string) => Promise.resolve(siteId === 's1' ? { id: 'mgr' } : null)) as unknown as typeof hireRepository.findSiteManager);

    const result = await backfillReportsTo('c1');

    expect(result).toEqual({ updated: 1, skipped: 2 });
    expect(hireRepository.setBossIfNone).toHaveBeenCalledTimes(1);
    expect(hireRepository.setBossIfNone).toHaveBeenCalledWith({}, 'c1', 'e1', 'mgr');
    expect(runAudited).toHaveBeenCalledTimes(1);
  });
});
