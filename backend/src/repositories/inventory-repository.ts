import { type Prisma, type RequisitionStatus } from '@prisma/client';
import { prisma } from '../config/database';

type Tx = Prisma.TransactionClient;
type Client = typeof prisma | Tx;

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const inventoryRepository = {
  // Suppliers
  createSupplier: (data: { name: string; phone?: string; email?: string }) => {
    return prisma.supplier.create({ data });
  },

  getSuppliers: () => {
    return prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  updateSupplier: (id: string, data: { name?: string; phone?: string; email?: string; isActive?: boolean }) => {
    return prisma.supplier.update({ where: { id }, data });
  },

  // ─── Raw Ingredients ──────────────────────────────────────────────────────

  createIngredient: (data: { name: string; unit: string; reorderThreshold: number }) => {
    return prisma.rawIngredient.create({ data });
  },

  getIngredients: () => {
    return prisma.rawIngredient.findMany({
      where: { isActive: true },
      include: {
        conversions: {
          include: { menuItem: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  updateIngredient: (id: string, data: { name?: string; unit?: string; reorderThreshold?: number; isActive?: boolean }) => {
    return prisma.rawIngredient.update({ where: { id }, data });
  },

  incrementIngredientStock: (id: string, qty: number, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.rawIngredient.update({
      where: { id },
      data: { currentStockCk: { increment: qty } },
    });
  },

  decrementIngredientStock: (id: string, qty: number, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.rawIngredient.update({
      where: { id },
      data: { currentStockCk: { decrement: qty } },
    });
  },

  // ─── Ingredient Conversions ───────────────────────────────────────────────

  createConversion: (data: { menuItemId: string; ingredientId: string; quantityPerPortion: number }) => {
    return prisma.ingredientConversion.create({
      data,
      include: { menuItem: true, ingredient: true },
    });
  },

  getConversionsForMenuItem: (menuItemId: string) => {
    return prisma.ingredientConversion.findMany({
      where: { menuItemId },
      include: { ingredient: true },
    });
  },

  getConversionsForIngredient: (ingredientId: string) => {
    return prisma.ingredientConversion.findMany({
      where: { ingredientId },
      include: { menuItem: true },
    });
  },

  // ─── Supplier Deliveries ──────────────────────────────────────────────────

  createDelivery: (
    data: { ingredientId: string; supplierId: string; quantity: number; loggedById: string; notes?: string },
    tx?: Tx,
  ) => {
    const client: Client = tx ?? prisma;
    return client.supplierDelivery.create({
      data,
      include: { ingredient: true, supplier: true },
    });
  },

  getDeliveries: (filters: { ingredientId?: string; supplierId?: string; from?: Date; to?: Date }) => {
    return prisma.supplierDelivery.findMany({
      where: {
        ...(filters.ingredientId && { ingredientId: filters.ingredientId }),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.from || filters.to
          ? {
              deliveredAt: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      include: { ingredient: true, supplier: true, loggedBy: { select: { id: true, name: true } } },
      orderBy: { deliveredAt: 'desc' },
    });
  },

  // ─── Requisitions ─────────────────────────────────────────────────────────

  createRequisition: (data: {
    organizationId: string;
    submittedById: string;
    notes?: string;
    isMidDay: boolean;
    items: Array<{ menuItemId: string; requestedQty: number }>;
  }) => {
    return prisma.$transaction(async (tx) => {
      const requisition = await tx.requisition.create({
        data: {
          organizationId: data.organizationId,
          submittedById: data.submittedById,
          notes: data.notes,
          isMidDay: data.isMidDay,
        },
      });

      await tx.requisitionItem.createMany({
        data: data.items.map((item) => ({
          requisitionId: requisition.id,
          menuItemId: item.menuItemId,
          requestedQty: item.requestedQty,
        })),
      });

      return tx.requisition.findUniqueOrThrow({
        where: { id: requisition.id },
        include: {
          items: { include: { menuItem: { select: { id: true, name: true } } } },
          organization: { select: { id: true, name: true } },
          submittedBy: { select: { id: true, name: true } },
        },
      });
    });
  },

  getRequisitionById: (id: string) => {
    return prisma.requisition.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                conversions: {
                  include: { ingredient: true },
                },
              },
            },
          },
        },
        organization: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true } },
      },
    });
  },

  getRequisitionsForCK: (filters: { status?: RequisitionStatus; date?: Date }) => {
    const startOfDay = filters.date ? new Date(filters.date) : new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.requisition.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
        submittedAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        items: { include: { menuItem: { select: { id: true, name: true } } } },
        organization: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  },

  getRequisitionsForBranch: (organizationId: string, filters?: { status?: RequisitionStatus }) => {
    return prisma.requisition.findMany({
      where: {
        organizationId,
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        items: { include: { menuItem: { select: { id: true, name: true } } } },
        submittedBy: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  },

  dispatchRequisition: (
    id: string,
    items: Array<{ requisitionItemId: string; dispatchedQty: number }>,
    tx?: Tx,
  ) => {
    const client: Client = tx ?? prisma;
    return Promise.all([
      client.requisition.update({
        where: { id },
        data: { status: 'DISPATCHED', dispatchedAt: new Date() },
      }),
      ...items.map((item) =>
        client.requisitionItem.update({
          where: { id: item.requisitionItemId },
          data: { dispatchedQty: item.dispatchedQty },
        }),
      ),
    ]);
  },

  receiveRequisitionItems: (
    items: Array<{ requisitionItemId: string; receivedQty: number; hasDiscrepancy: boolean }>,
    tx?: Tx,
  ) => {
    const client: Client = tx ?? prisma;
    return Promise.all(
      items.map((item) =>
        client.requisitionItem.update({
          where: { id: item.requisitionItemId },
          data: { receivedQty: item.receivedQty, hasDiscrepancy: item.hasDiscrepancy },
        }),
      ),
    );
  },

  updateRequisitionStatus: (id: string, status: RequisitionStatus, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.requisition.update({
      where: { id },
      data: {
        status,
        ...(status === 'RECEIVED' || status === 'PARTIAL' ? { receivedAt: new Date() } : {}),
      },
    });
  },

  // ─── Branch Stock ─────────────────────────────────────────────────────────

  getBranchStock: (organizationId: string) => {
    return prisma.branchStock.findMany({
      where: { organizationId },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: { select: { prepStation: true } },
          },
        },
      },
      orderBy: { menuItem: { name: 'asc' } },
    });
  },

  // Returns all active menu items with their current stock qty for a branch (0 if no record yet).
  // Used by the stocktake form so Managers can count every item, not just ones already in BranchStock.
  getMenuItemsWithBranchStock: async (organizationId: string) => {
    const [menuItems, branchStock] = await Promise.all([
      prisma.menuItem.findMany({
        where: { isActive: true, deletedAt: null },
        include: {
          category: { select: { name: true, prepStation: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.branchStock.findMany({
        where: { organizationId },
        select: { menuItemId: true, currentQty: true, lowStockThreshold: true },
      }),
    ]);
    const stockMap = new Map(branchStock.map((s) => [s.menuItemId, s]));
    return menuItems
      .map((item) => {
        const stock = stockMap.get(item.id);
        return {
          menuItemId: item.id,
          name: item.name,
          currentQty: stock ? Number(stock.currentQty) : 0,
          lowStockThreshold: stock ? Number(stock.lowStockThreshold) : 0,
          category: { name: item.category.name, prepStation: item.category.prepStation },
        };
      })
      .sort((a, b) => a.category.name.localeCompare(b.category.name) || a.name.localeCompare(b.name));
  },

  getBranchStockItem: (organizationId: string, menuItemId: string, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.branchStock.findUnique({
      where: { organizationId_menuItemId: { organizationId, menuItemId } },
    });
  },

  incrementBranchStock: (organizationId: string, menuItemId: string, qty: number, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.branchStock.upsert({
      where: { organizationId_menuItemId: { organizationId, menuItemId } },
      update: { currentQty: { increment: qty } },
      create: { organizationId, menuItemId, currentQty: qty },
    });
  },

  decrementBranchStock: (organizationId: string, menuItemId: string, qty: number, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.branchStock.update({
      where: { organizationId_menuItemId: { organizationId, menuItemId } },
      data: { currentQty: { decrement: qty } },
    });
  },

  upsertBranchStock: (organizationId: string, menuItemId: string, qty: number) => {
    return prisma.branchStock.upsert({
      where: { organizationId_menuItemId: { organizationId, menuItemId } },
      update: { currentQty: qty },
      create: { organizationId, menuItemId, currentQty: qty },
    });
  },

  // ─── Branch Menu Item availability ───────────────────────────────────────

  setBranchMenuItemAvailability: (
    organizationId: string,
    menuItemId: string,
    isAvailable: boolean,
    tx?: Tx,
  ) => {
    const client: Client = tx ?? prisma;
    return client.branchMenuItem.upsert({
      where: { organizationId_menuItemId: { organizationId, menuItemId } },
      update: { isAvailable, updatedBy: 'system' },
      create: { organizationId, menuItemId, isAvailable, updatedBy: 'system' },
    });
  },

  getBranchMenuItemAvailability: (organizationId: string, menuItemId: string, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.branchMenuItem.findUnique({
      where: { organizationId_menuItemId: { organizationId, menuItemId } },
    });
  },

  // ─── Stocktake ────────────────────────────────────────────────────────────

  createStocktakeSession: (data: {
    organizationId: string;
    conductedById: string;
    date: Date;
    entries: Array<{
      station: 'KITCHEN' | 'BARISTA' | 'WAITER';
      menuItemId?: string;
      consumableId?: string;
      expectedQty: number;
      actualQty: number;
      note?: string;
    }>;
  }) => {
    return prisma.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.create({
        data: {
          organizationId: data.organizationId,
          conductedById: data.conductedById,
          date: data.date,
          completedAt: new Date(),
        },
      });

      await tx.stocktakeEntry.createMany({
        data: data.entries.map((entry) => ({
          sessionId: session.id,
          station: entry.station,
          menuItemId: entry.menuItemId,
          consumableId: entry.consumableId,
          expectedQty: entry.expectedQty,
          actualQty: entry.actualQty,
          variance: entry.actualQty - entry.expectedQty,
          note: entry.note,
        })),
      });

      // Correct BranchStock.currentQty to the counted actual quantity.
      // StocktakeEntry.actualQty is Decimal(10,2); BranchStock.currentQty is Int — must round.
      for (const entry of data.entries) {
        if (entry.menuItemId) {
          await tx.branchStock.upsert({
            where: { organizationId_menuItemId: { organizationId: data.organizationId, menuItemId: entry.menuItemId } },
            update: { currentQty: Math.round(Number(entry.actualQty)) },
            create: { organizationId: data.organizationId, menuItemId: entry.menuItemId, currentQty: Math.round(Number(entry.actualQty)) },
          });
        }
      }

      return tx.stocktakeSession.findUniqueOrThrow({
        where: { id: session.id },
        include: {
          entries: { include: { menuItem: { select: { id: true, name: true } } } },
          conductedBy: { select: { id: true, name: true } },
        },
      });
    });
  },

  getStocktakeSessions: (organizationId: string, filters?: { from?: Date; to?: Date }) => {
    return prisma.stocktakeSession.findMany({
      where: {
        organizationId,
        ...(filters?.from || filters?.to
          ? {
              date: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      include: {
        entries: { include: { menuItem: { select: { id: true, name: true } } } },
        conductedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  },

  getCentralStocktakeSessions: (filters?: { date?: Date }) => {
    return prisma.rawIngredient.findMany({
      where: { isActive: true },
      include: { conversions: true },
      orderBy: { name: 'asc' },
    });
  },

  // ─── Overview & Reports ───────────────────────────────────────────────────

  getActiveOrganizations: () => {
    return prisma.organization.findMany({
      where: { isActive: true, isHub: false },
      select: { id: true, name: true },
    });
  },

  getTodayRequisitionsForAllBranches: () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return prisma.requisition.findMany({
      where: { submittedAt: { gte: start, lte: end } },
      include: {
        organization: { select: { id: true, name: true } },
        items: true,
      },
    });
  },

  getDiscrepancies: (filters: { branchId?: string; from?: Date; to?: Date }) => {
    return prisma.requisitionItem.findMany({
      where: {
        hasDiscrepancy: true,
        requisition: {
          ...(filters.branchId && { organizationId: filters.branchId }),
          ...(filters.from || filters.to
            ? {
                submittedAt: {
                  ...(filters.from && { gte: filters.from }),
                  ...(filters.to && { lte: filters.to }),
                },
              }
            : {}),
        },
      },
      include: {
        menuItem: { select: { id: true, name: true } },
        requisition: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { requisition: { submittedAt: 'desc' } },
    });
  },

  getShrinkageEntries: (filters: { branchId?: string; from?: Date; to?: Date }) => {
    return prisma.stocktakeEntry.findMany({
      where: {
        variance: { lt: 0 },
        session: {
          ...(filters.branchId && { organizationId: filters.branchId }),
          ...(filters.from || filters.to
            ? {
                date: {
                  ...(filters.from && { gte: filters.from }),
                  ...(filters.to && { lte: filters.to }),
                },
              }
            : {}),
        },
      },
      include: {
        menuItem: { select: { id: true, name: true } },
        session: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { session: { date: 'desc' } },
    });
  },

  // ─── Intentionally cross-org: directors query all branches, no organizationId filter ───
  getAllStocktakeSessions: (filters?: { from?: Date; to?: Date }) => {
    return prisma.stocktakeSession.findMany({
      where: {
        ...(filters?.from || filters?.to
          ? {
              date: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      include: {
        entries: { include: { menuItem: { select: { id: true, name: true } } } },
        conductedBy: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  },

  updateIngredientStock: (id: string, actualQty: number, tx?: Tx) => {
    const client: Client = tx ?? prisma;
    return client.rawIngredient.update({
      where: { id },
      data: { currentStockCk: actualQty },
    });
  },

  getUsersByRole: (role: 'MANAGER' | 'STORE_MANAGER' | 'DIRECTOR', organizationId?: string) => {
    return prisma.user.findMany({
      where: {
        role,
        isActive: true,
        ...(organizationId && { organizationId }),
      },
      select: { id: true, name: true, fcmToken: true },
    });
  },
};
