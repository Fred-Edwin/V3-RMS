import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepTicketRepository } from './prep-ticket-repository';

const today = new Date('2026-05-14T00:00:00.000Z');

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../utils/date-only', () => ({
  getTodayDateOnly: () => today,
}));

vi.mock('../config/database', () => ({
  prisma: {
    $transaction: mocks.transaction,
    prepTicket: {
      count: mocks.count,
      findMany: mocks.findMany,
    },
  },
}));

describe('prepTicketRepository.findByStation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations));
  });

  it('scopes active live KDS queries to today so stale tickets stay out of the display', async () => {
    await prepTicketRepository.findByStation('org-1', ['KITCHEN', 'PIZZA', 'PASTRY'], {
      activeOnly: true,
      page: 1,
      perPage: 100,
    });

    expect(mocks.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: 'org-1',
        station: { in: ['KITCHEN', 'PIZZA', 'PASTRY'] },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        order: {
          status: { notIn: ['CLOSED', 'CANCELLED'] },
          orderDate: today,
        },
      }),
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: expect.objectContaining({
            orderDate: today,
          }),
        }),
        take: 100,
      }),
    );
  });
});
