import { beforeEach, describe, expect, it, vi } from 'vitest';

const findManyMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findMany: findManyMock,
      updateMany: updateManyMock,
    },
  },
}));

describe('staffRepository — PIN status and reset (org + role scoped)', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    updateManyMock.mockReset();
  });

  it('findTeamWithPinStatus scopes by organizationId + roles and maps pinHash to a boolean', async () => {
    findManyMock.mockResolvedValue([
      { id: 'a', name: 'A', pinHash: 'secret-hash' },
      { id: 'b', name: 'B', pinHash: null },
    ]);
    const { staffRepository } = await import('../src/repositories/staff-repository');

    const team = await staffRepository.findTeamWithPinStatus('hub-1', ['STORE_ATTENDANT']);

    expect(findManyMock.mock.calls[0]![0].where).toMatchObject({
      siteId: 'hub-1',
      role: { in: ['STORE_ATTENDANT'] },
    });
    expect(team).toEqual([
      { id: 'a', name: 'A', hasPin: true },
      { id: 'b', name: 'B', hasPin: false },
    ]);
    expect(JSON.stringify(team)).not.toContain('secret-hash');
  });

  it('clearPin nulls only the matching org + role row', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const { staffRepository } = await import('../src/repositories/staff-repository');

    await staffRepository.clearPin('att-1', 'hub-1', ['STORE_ATTENDANT']);

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'att-1', siteId: 'hub-1', role: { in: ['STORE_ATTENDANT'] } },
      data: { pinHash: null },
    });
  });
});
