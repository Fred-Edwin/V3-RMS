import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redisClient } from '../config/redis';
import { menuRepository } from '../repositories/menu-repository';
import { invalidateMenuCache, menuService, mergeMenuAvailability } from './menu-service';

vi.mock('../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    keys: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../repositories/menu-repository', () => ({
  menuRepository: {
    findAllCategories: vi.fn(),
    findCategoryById: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    countActiveItemsInCategory: vi.fn(),
    findAllItems: vi.fn(),
    findItemById: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    findMenuWithBranchAvailability: vi.fn(),
    upsertBranchMenuItemAvailability: vi.fn(),
  },
}));

const branchId = '33333333-3333-4333-8333-333333333333';
const categoryId = '11111111-1111-4111-8111-111111111111';
const itemOneId = '22222222-2222-4222-8222-222222222221';
const itemTwoId = '22222222-2222-4222-8222-222222222222';
const itemThreeId = '22222222-2222-4222-8222-222222222223';

const waiterActor = {
  id: 'waiter-1',
  role: 'WAITER',
  siteId: branchId,
} as NonNullable<Request['user']>;

const managerActor = {
  id: 'manager-1',
  role: 'MANAGER',
  siteId: branchId,
} as NonNullable<Request['user']>;

describe('menuService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mergeMenuAvailability resolves overrides and defaults correctly', () => {
    const categories = [
      {
        id: categoryId,
        name: 'Hot Drinks',
        prepStation: 'BARISTA',
        displayOrder: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        menuItems: [
          {
            id: itemOneId,
            categoryId,
            name: 'Cappuccino',
            description: 'Coffee',
            price: { toString: () => '350.00' },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            branchOverrides: [
              {
                id: 'override-1',
                siteId: branchId,
                menuItemId: itemOneId,
                isAvailable: false,
                updatedAt: new Date(),
                updatedBy: 'manager-1',
              },
            ],
          },
          {
            id: itemTwoId,
            categoryId,
            name: 'Latte',
            description: 'Coffee',
            price: { toString: () => '400.00' },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            branchOverrides: [],
          },
          {
            id: itemThreeId,
            categoryId,
            name: 'Flat White',
            description: 'Coffee',
            price: { toString: () => '380.00' },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            branchOverrides: [
              {
                id: 'override-3',
                siteId: branchId,
                menuItemId: itemThreeId,
                isAvailable: true,
                updatedAt: new Date(),
                updatedBy: 'manager-1',
              },
            ],
          },
        ],
      },
    ] as unknown as Parameters<typeof mergeMenuAvailability>[0];

    const merged = mergeMenuAvailability(categories);

    expect(merged[0]?.items[0]?.isAvailable).toBe(false);
    expect(merged[0]?.items[1]?.isAvailable).toBe(true);
    expect(merged[0]?.items[2]?.isAvailable).toBe(true);
  });

  it('getMenu uses cache-aside behavior', async () => {
    const cachedPayload = {
      categories: [
        {
          id: categoryId,
          name: 'Hot Drinks',
          prepStation: 'BARISTA',
          displayOrder: 1,
          items: [
            {
              id: itemTwoId,
              name: 'Latte',
              description: 'Coffee',
              price: '400.00',
              isAvailable: true,
            },
          ],
        },
      ],
    };

    vi.mocked(redisClient.get)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(cachedPayload));
    vi.mocked(redisClient.setex).mockResolvedValue('OK');
    vi.mocked(menuRepository.findMenuWithBranchAvailability).mockResolvedValue([
      {
        id: categoryId,
        name: 'Hot Drinks',
        prepStation: 'BARISTA',
        displayOrder: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        menuItems: [
          {
            id: itemTwoId,
            categoryId,
            name: 'Latte',
            description: 'Coffee',
            price: { toString: () => '400.00' },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            branchOverrides: [],
          },
        ],
      },
    ] as unknown as Awaited<ReturnType<typeof menuRepository.findMenuWithBranchAvailability>>);

    const firstResult = await menuService.getMenu(waiterActor, {});
    const secondResult = await menuService.getMenu(waiterActor, {});

    expect(firstResult.categories).toHaveLength(1);
    expect(secondResult.categories).toHaveLength(1);
    expect(menuRepository.findMenuWithBranchAvailability).toHaveBeenCalledTimes(1);
    expect(redisClient.setex).toHaveBeenCalledTimes(1);
  });

  it('invalidates branch-specific cache on availability toggle', async () => {
    vi.mocked(menuRepository.findItemById).mockResolvedValue({
      id: itemOneId,
      categoryId,
      name: 'Cappuccino',
      description: 'Coffee',
      price: { toString: () => '350.00' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as Awaited<ReturnType<typeof menuRepository.findItemById>>);
    vi.mocked(menuRepository.upsertBranchMenuItemAvailability).mockResolvedValue({
      id: 'override-1',
      siteId: branchId,
      menuItemId: itemOneId,
      isAvailable: false,
      updatedAt: new Date(),
      updatedBy: 'manager-1',
    });
    vi.mocked(redisClient.keys).mockResolvedValue(['menu:33333333-3333-4333-8333-333333333333:available-only:all']);
    vi.mocked(redisClient.del).mockResolvedValue(1);

    await menuService.setItemAvailability(itemOneId, managerActor, false);

    expect(redisClient.keys).toHaveBeenCalledWith(`menu:${branchId}:*`);
    expect(redisClient.del).toHaveBeenCalled();
  });

  it('invalidates global menu cache on master item update', async () => {
    vi.mocked(menuRepository.findItemById).mockResolvedValue({
      id: itemOneId,
      categoryId,
      name: 'Cappuccino',
      description: 'Coffee',
      price: { toString: () => '350.00' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as Awaited<ReturnType<typeof menuRepository.findItemById>>);
    vi.mocked(menuRepository.updateItem).mockResolvedValue({
      id: itemOneId,
      categoryId,
      name: 'Updated Cappuccino',
      description: 'Coffee',
      price: { toString: () => '360.00' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as Awaited<ReturnType<typeof menuRepository.updateItem>>);
    vi.mocked(redisClient.keys).mockResolvedValue(['menu:33333333-3333-4333-8333-333333333333:available-only:all']);
    vi.mocked(redisClient.del).mockResolvedValue(1);

    await menuService.updateItem(itemOneId, { name: 'Updated Cappuccino' });

    expect(redisClient.keys).toHaveBeenCalledWith('menu:*');
    expect(redisClient.del).toHaveBeenCalled();
  });

  it('invalidateMenuCache no-ops when no keys exist', async () => {
    vi.mocked(redisClient.keys).mockResolvedValue([]);

    await invalidateMenuCache(branchId);

    expect(redisClient.keys).toHaveBeenCalledWith(`menu:${branchId}:*`);
    expect(redisClient.del).not.toHaveBeenCalled();
  });
});
