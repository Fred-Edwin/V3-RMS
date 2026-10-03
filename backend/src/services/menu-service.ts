import type { BranchMenuItem, PrepStation, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { redisClient } from '../config/redis';
import {
  menuRepository,
  type MenuCategoryWithOverridesRecord,
} from '../repositories/menu-repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type {
  CreateCategoryInput,
  CreateItemInput,
  MenuQueryInput,
  UpdateCategoryInput,
  UpdateItemInput,
} from '../validators/menu-schemas';

type Actor = NonNullable<Request['user']>;

type MenuVisibilityMode = 'available-only' | 'all-items';

const BRANCH_SCOPED_ROLES: UserRole[] = [
  'MANAGER',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
];

const AVAILABLE_ONLY_ROLES: UserRole[] = [
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
];

const MENU_CACHE_TTL_SECONDS = 60 * 60;

export interface MenuItemWithAvailability {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  isAvailable: boolean;
}

export interface MenuCategoryWithAvailability {
  id: string;
  name: string;
  prepStation: PrepStation;
  displayOrder: number;
  items: MenuItemWithAvailability[];
}

export interface MenuResponse {
  categories: MenuCategoryWithAvailability[];
}

export interface MenuCategoryManagementItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  isActive: boolean;
}

export interface MenuCategoryManagementRecord {
  id: string;
  name: string;
  prepStation: PrepStation;
  displayOrder: number;
  isActive: boolean;
  itemCount: number;
  items: MenuCategoryManagementItem[];
}

const buildMenuCacheKey = (
  branchId: string,
  visibilityMode: MenuVisibilityMode,
  categoryId?: string,
): string => {
  return `menu:${branchId}:${visibilityMode}:${categoryId ?? 'all'}`;
};

const resolveBranchId = (actor: Actor, requestedBranchId?: string): string => {
  if (BRANCH_SCOPED_ROLES.includes(actor.role)) {
    if (!actor.siteId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    if (requestedBranchId && requestedBranchId !== actor.siteId) {
      throw new ForbiddenError('Cannot access menu for another branch');
    }

    return actor.siteId;
  }

  if (!requestedBranchId) {
    throw new ValidationError('branchId query param is required for this role');
  }

  return requestedBranchId;
};

const getVisibilityMode = (role: UserRole): MenuVisibilityMode => {
  return AVAILABLE_ONLY_ROLES.includes(role) ? 'available-only' : 'all-items';
};

const parseCachedMenu = (cached: string): MenuResponse | null => {
  try {
    return JSON.parse(cached) as MenuResponse;
  } catch {
    return null;
  }
};

export const mergeMenuAvailability = (
  categories: MenuCategoryWithOverridesRecord[],
): MenuCategoryWithAvailability[] => {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    prepStation: category.prepStation,
    displayOrder: category.displayOrder,
    items: category.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      price: item.price.toString(),
      isAvailable: item.branchOverrides[0]?.isAvailable ?? true,
    })),
  }));
};

export const invalidateMenuCache = async (branchId?: string): Promise<void> => {
  const pattern = branchId ? `menu:${branchId}:*` : 'menu:*';
  const keys = await redisClient.keys(pattern);

  if (keys.length === 0) {
    return;
  }

  await redisClient.del(...keys);
};

export const menuService = {
  getMenu: async (actor: Actor, query: MenuQueryInput): Promise<MenuResponse> => {
    const branchId = resolveBranchId(actor, query.branchId);
    const visibilityMode = getVisibilityMode(actor.role);
    const cacheKey = buildMenuCacheKey(branchId, visibilityMode, query.categoryId);
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      const parsed = parseCachedMenu(cached);
      if (parsed) {
        return parsed;
      }
    }

    const categories = await menuRepository.findMenuWithBranchAvailability(branchId, query.categoryId);
    const merged = mergeMenuAvailability(categories);
    const visibleCategories =
      visibilityMode === 'available-only'
        ? merged
            .map((category) => ({
              ...category,
              items: category.items.filter((item) => item.isAvailable),
            }))
            .filter((category) => category.items.length > 0)
        : merged;

    const payload: MenuResponse = {
      categories: visibleCategories,
    };

    await redisClient.setex(cacheKey, MENU_CACHE_TTL_SECONDS, JSON.stringify(payload));
    return payload;
  },

  getCategories: async (): Promise<MenuCategoryManagementRecord[]> => {
    const categories = await menuRepository.findAllCategories();

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      prepStation: category.prepStation,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      itemCount: category.itemCount,
      items: category.menuItems.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        price: item.price.toString(),
        isActive: item.isActive,
      })),
    }));
  },

  createCategory: async (data: CreateCategoryInput): Promise<void> => {
    await menuRepository.createCategory(data);
    await invalidateMenuCache();
  },

  updateCategory: async (id: string, data: UpdateCategoryInput): Promise<void> => {
    const existing = await menuRepository.findCategoryById(id);
    if (!existing) {
      throw new NotFoundError('Menu category not found');
    }

    const updated = await menuRepository.updateCategory(id, data);
    if (!updated) {
      throw new NotFoundError('Menu category not found');
    }

    await invalidateMenuCache();
  },

  deleteCategory: async (id: string): Promise<void> => {
    const existing = await menuRepository.findCategoryById(id);
    if (!existing) {
      throw new NotFoundError('Menu category not found');
    }

    const activeItemCount = await menuRepository.countActiveItemsInCategory(id);
    if (activeItemCount > 0) {
      throw new ConflictError(
        'Cannot delete a category that has active menu items. Deactivate or reassign items first.',
      );
    }

    const deleted = await menuRepository.deleteCategory(id);
    if (!deleted) {
      throw new NotFoundError('Menu category not found');
    }

    await invalidateMenuCache();
  },

  createItem: async (data: CreateItemInput): Promise<void> => {
    const category = await menuRepository.findCategoryById(data.categoryId);
    if (!category || !category.isActive) {
      throw new ValidationError('Cannot create item in an inactive or missing category');
    }

    await menuRepository.createItem(data);
    await invalidateMenuCache();
  },

  updateItem: async (id: string, data: UpdateItemInput): Promise<void> => {
    const existing = await menuRepository.findItemById(id);
    if (!existing) {
      throw new NotFoundError('Menu item not found');
    }

    if (data.categoryId) {
      const category = await menuRepository.findCategoryById(data.categoryId);
      if (!category || !category.isActive) {
        throw new ValidationError('Cannot move item to an inactive or missing category');
      }
    }

    const updated = await menuRepository.updateItem(id, data);
    if (!updated) {
      throw new NotFoundError('Menu item not found');
    }

    await invalidateMenuCache();
  },

  deleteItem: async (id: string): Promise<void> => {
    const existing = await menuRepository.findItemById(id);
    if (!existing) {
      throw new NotFoundError('Menu item not found');
    }

    const deleted = await menuRepository.deleteItem(id);
    if (!deleted) {
      throw new NotFoundError('Menu item not found');
    }

    await invalidateMenuCache();
  },

  setItemAvailability: async (
    menuItemId: string,
    actor: Actor,
    isAvailable: boolean,
    branchIdQuery?: string,
  ): Promise<BranchMenuItem> => {
    if (actor.role !== 'MANAGER') {
      throw new ForbiddenError('Only managers can toggle menu availability');
    }

    if (!actor.siteId) {
      throw new ForbiddenError('Manager branch context is required');
    }

    if (branchIdQuery && branchIdQuery !== actor.siteId) {
      throw new ForbiddenError('Managers can only update availability for their own branch');
    }

    const item = await menuRepository.findItemById(menuItemId);
    if (!item || !item.isActive) {
      throw new NotFoundError('Menu item not found');
    }

    const availability = await menuRepository.upsertBranchMenuItemAvailability(
      menuItemId,
      actor.siteId,
      actor.id,
      isAvailable,
    );

    await invalidateMenuCache(actor.siteId);
    return availability;
  },
};
