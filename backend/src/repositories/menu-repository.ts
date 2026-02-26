import type { BranchMenuItem, MenuCategory, MenuItem, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type {
  CreateCategoryInput,
  CreateItemInput,
  UpdateCategoryInput,
  UpdateItemInput,
} from '../validators/menu-schemas';

export type CategoryWithItemsRecord = Prisma.MenuCategoryGetPayload<{
  include: {
    menuItems: true;
  };
}>;

export type MenuCategoryWithOverridesRecord = Prisma.MenuCategoryGetPayload<{
  include: {
    menuItems: {
      include: {
        branchOverrides: true;
      };
    };
  };
}>;

export type MenuItemWithCategoryRecord = Prisma.MenuItemGetPayload<{
  include: {
    category: true;
    branchOverrides: true;
  };
}>;

export const menuRepository = {
  findAllCategories: async (): Promise<Array<CategoryWithItemsRecord & { itemCount: number }>> => {
    const categories = await prisma.menuCategory.findMany({
      include: {
        menuItems: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    return categories.map((category) => ({
      ...category,
      itemCount: category.menuItems.filter((item) => item.isActive).length,
    }));
  },

  findCategoryById: async (id: string): Promise<MenuCategory | null> => {
    return prisma.menuCategory.findUnique({
      where: { id },
    });
  },

  createCategory: async (data: CreateCategoryInput): Promise<MenuCategory> => {
    return prisma.menuCategory.create({
      data,
    });
  },

  updateCategory: async (id: string, data: UpdateCategoryInput): Promise<MenuCategory | null> => {
    const result = await prisma.menuCategory.updateMany({
      where: { id },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.menuCategory.findUnique({
      where: { id },
    });
  },

  deleteCategory: async (id: string): Promise<boolean> => {
    const result = await prisma.menuCategory.updateMany({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return result.count > 0;
  },

  countActiveItemsInCategory: async (categoryId: string): Promise<number> => {
    return prisma.menuItem.count({
      where: {
        categoryId,
        isActive: true,
        deletedAt: null,
      },
    });
  },

  findAllItems: async (): Promise<MenuItem[]> => {
    return prisma.menuItem.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  },

  findItemById: async (id: string): Promise<MenuItem | null> => {
    return prisma.menuItem.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  },

  createItem: async (data: CreateItemInput): Promise<MenuItem> => {
    return prisma.menuItem.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        price: data.price,
      },
    });
  },

  updateItem: async (id: string, data: UpdateItemInput): Promise<MenuItem | null> => {
    const result = await prisma.menuItem.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        price: data.price,
        isActive: data.isActive,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.menuItem.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  },

  deleteItem: async (id: string): Promise<boolean> => {
    const result = await prisma.menuItem.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return result.count > 0;
  },

  findMenuWithBranchAvailability: async (
    organizationId: string,
    categoryId?: string,
  ): Promise<MenuCategoryWithOverridesRecord[]> => {
    return prisma.menuCategory.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { id: categoryId } : {}),
      },
      orderBy: {
        displayOrder: 'asc',
      },
      include: {
        menuItems: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          orderBy: {
            name: 'asc',
          },
          include: {
            branchOverrides: {
              where: {
                organizationId,
              },
            },
          },
        },
      },
    });
  },

  upsertBranchMenuItemAvailability: async (
    menuItemId: string,
    organizationId: string,
    updatedBy: string,
    isAvailable: boolean,
  ): Promise<BranchMenuItem> => {
    return prisma.branchMenuItem.upsert({
      where: {
        organizationId_menuItemId: {
          organizationId,
          menuItemId,
        },
      },
      create: {
        organizationId,
        menuItemId,
        isAvailable,
        updatedBy,
      },
      update: {
        isAvailable,
        updatedBy,
      },
    });
  },

  findItemsWithCategoriesByIds: async (
    ids: string[],
    organizationId: string,
  ): Promise<MenuItemWithCategoryRecord[]> => {
    if (ids.length === 0) {
      return [];
    }

    return prisma.menuItem.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        deletedAt: null,
      },
      include: {
        category: true,
        branchOverrides: {
          where: {
            organizationId,
          },
        },
      },
    });
  },
};
