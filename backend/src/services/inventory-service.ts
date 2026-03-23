import { type Prisma, type RequisitionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { inventoryRepository } from '../repositories/inventory-repository';
import { fcmService } from './fcm-service';
import { AppError, NotFoundError } from '../utils/errors';
import { getSocketServer, userRoomName } from '../sockets/socket';
import { logger } from '../utils/logger';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  CreateIngredientInput,
  UpdateIngredientInput,
  CreateIngredientConversionInput,
  LogDeliveryInput,
  CreateRequisitionInput,
  DispatchRequisitionInput,
  ReceiveRequisitionInput,
  SubmitStocktakeInput,
  SubmitCentralStocktakeInput,
  InventoryReportQueryInput,
} from '../validators/inventory-schemas';

type Tx = Prisma.TransactionClient;

export const inventoryService = {
  // ─── Suppliers ─────────────────────────────────────────────────────────────

  createSupplier: (data: CreateSupplierInput) => {
    return inventoryRepository.createSupplier(data);
  },

  getSuppliers: () => {
    return inventoryRepository.getSuppliers();
  },

  updateSupplier: (id: string, data: UpdateSupplierInput) => {
    return inventoryRepository.updateSupplier(id, data);
  },

  // ─── Raw Ingredients ───────────────────────────────────────────────────────

  createIngredient: (data: CreateIngredientInput) => {
    return inventoryRepository.createIngredient(data);
  },

  getIngredients: () => {
    return inventoryRepository.getIngredients();
  },

  updateIngredient: (id: string, data: UpdateIngredientInput) => {
    return inventoryRepository.updateIngredient(id, data);
  },

  // ─── Ingredient Conversions ────────────────────────────────────────────────

  getConversionsForIngredient: (ingredientId: string) => {
    return inventoryRepository.getConversionsForIngredient(ingredientId);
  },

  createConversion: (ingredientId: string, data: CreateIngredientConversionInput) => {
    return inventoryRepository.createConversion({
      ingredientId,
      menuItemId: data.menuItemId,
      quantityPerPortion: data.quantityPerPortion,
    });
  },

  // ─── Supplier Deliveries ───────────────────────────────────────────────────

  getDeliveries: (filters: { ingredientId?: string; supplierId?: string; from?: string; to?: string }) => {
    return inventoryRepository.getDeliveries({
      ingredientId: filters.ingredientId,
      supplierId: filters.supplierId,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
  },

  logDelivery: async (data: LogDeliveryInput, loggedById: string) => {
    return prisma.$transaction(async (tx) => {
      const delivery = await inventoryRepository.createDelivery(
        { ...data, loggedById },
        tx,
      );
      await inventoryRepository.incrementIngredientStock(data.ingredientId, data.quantity, tx);
      const ingredient = await tx.rawIngredient.findUniqueOrThrow({
        where: { id: data.ingredientId },
        select: { id: true, name: true, currentStockCk: true, unit: true },
      });
      return { delivery, ingredient };
    });
  },

  // ─── Requisitions ──────────────────────────────────────────────────────────

  createRequisition: async (
    organizationId: string,
    submittedById: string,
    data: CreateRequisitionInput,
  ) => {
    return inventoryRepository.createRequisition({
      organizationId,
      submittedById,
      notes: data.notes,
      isMidDay: data.isMidDay ?? false,
      items: data.items,
    });
  },

  getRequisitionsForCK: (filters: { status?: string; date?: string }) => {
    const status = filters.status as RequisitionStatus | undefined;
    return inventoryRepository.getRequisitionsForCK({
      status,
      date: filters.date ? new Date(filters.date) : undefined,
    });
  },

  getRequisitionsForBranch: (organizationId: string, filters?: { status?: string }) => {
    const status = filters?.status as RequisitionStatus | undefined;
    return inventoryRepository.getRequisitionsForBranch(organizationId, { status });
  },

  getRequisitionWithCapacity: async (id: string) => {
    const requisition = await inventoryRepository.getRequisitionById(id);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }

    const itemsWithCapacity = await Promise.all(
      requisition.items.map(async (item) => {
        const conversions = await inventoryRepository.getConversionsForMenuItem(item.menuItemId);

        let canFulfilQty = 0;
        if (conversions.length > 0) {
          canFulfilQty = Math.min(
            ...conversions.map((c) =>
              Math.floor(Number(c.ingredient.currentStockCk) / Number(c.quantityPerPortion)),
            ),
          );
        }

        return { ...item, canFulfilQty };
      }),
    );

    return { ...requisition, items: itemsWithCapacity };
  },

  dispatchRequisition: async (
    id: string,
    data: DispatchRequisitionInput,
    dispatchedById: string,
  ) => {
    const requisition = await inventoryRepository.getRequisitionById(id);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }

    await prisma.$transaction(async (tx) => {
      // For each item, deduct raw ingredient stock based on conversions
      for (const dispatchItem of data.items) {
        const reqItem = requisition.items.find((i) => i.id === dispatchItem.requisitionItemId);
        if (!reqItem) continue;

        const conversions = await inventoryRepository.getConversionsForMenuItem(reqItem.menuItemId);
        for (const conversion of conversions) {
          const deductQty = dispatchItem.dispatchedQty * Number(conversion.quantityPerPortion);
          await inventoryRepository.decrementIngredientStock(conversion.ingredientId, deductQty, tx);
        }
      }

      await inventoryRepository.dispatchRequisition(id, data.items, tx);
    });

    // After transaction: FCM push to branch manager
    const managers = await inventoryRepository.getUsersByRole('MANAGER', requisition.organizationId);
    for (const manager of managers) {
      if (manager.fcmToken) {
        await fcmService.sendGenericPush(manager.fcmToken, {
          title: 'Requisition dispatched',
          body: `Your requisition from ${requisition.organization.name} has been dispatched`,
        });
      }
    }

    return inventoryRepository.getRequisitionById(id);
  },

  receiveRequisition: async (
    id: string,
    data: ReceiveRequisitionInput,
    receivedById: string,
  ) => {
    const requisition = await inventoryRepository.getRequisitionById(id);
    if (!requisition) {
      throw new NotFoundError('Requisition not found');
    }

    let hasAnyDiscrepancy = false;

    await prisma.$transaction(async (tx) => {
      const itemsWithDiscrepancy = data.items.map((item) => {
        const reqItem = requisition.items.find((i) => i.id === item.requisitionItemId);
        const hasDiscrepancy =
          reqItem?.dispatchedQty != null && item.receivedQty < reqItem.dispatchedQty;
        if (hasDiscrepancy) hasAnyDiscrepancy = true;
        return { ...item, hasDiscrepancy };
      });

      await inventoryRepository.receiveRequisitionItems(itemsWithDiscrepancy, tx);

      // Increment branch stock and restore availability
      for (const item of data.items) {
        const reqItem = requisition.items.find((i) => i.id === item.requisitionItemId);
        if (!reqItem) continue;

        const updatedStock = await inventoryRepository.incrementBranchStock(
          requisition.organizationId,
          reqItem.menuItemId,
          item.receivedQty,
          tx,
        );

        // Restore availability if item was previously hidden and now has stock
        if (updatedStock.currentQty > 0) {
          const branchMenuItem = await inventoryRepository.getBranchMenuItemAvailability(
            requisition.organizationId,
            reqItem.menuItemId,
            tx,
          );
          if (branchMenuItem && !branchMenuItem.isAvailable) {
            await inventoryRepository.setBranchMenuItemAvailability(
              requisition.organizationId,
              reqItem.menuItemId,
              true,
              tx,
            );
          }
        }
      }

      const allMatch = data.items.every((item) => {
        const reqItem = requisition.items.find((i) => i.id === item.requisitionItemId);
        return reqItem?.dispatchedQty == null || item.receivedQty >= reqItem.dispatchedQty;
      });

      await inventoryRepository.updateRequisitionStatus(
        id,
        allMatch ? 'RECEIVED' : 'PARTIAL',
        tx,
      );
    });

    // After transaction: FCM to Store Manager if discrepancies
    if (hasAnyDiscrepancy) {
      const storeManagers = await inventoryRepository.getUsersByRole('STORE_MANAGER');
      for (const sm of storeManagers) {
        if (sm.fcmToken) {
          await fcmService.sendGenericPush(sm.fcmToken, {
            title: 'Delivery discrepancy flagged',
            body: `${requisition.organization.name} reported discrepancies on requisition receipt`,
          });
        }
      }
    }

    return inventoryRepository.getRequisitionById(id);
  },

  // ─── Stock Deduction for PrepTicket ───────────────────────────────────────
  // Called from prepTicketService.markReady() — MUST accept tx (already in a transaction)

  deductStockForPrepTicket: async (
    organizationId: string,
    menuItemId: string,
    qty: number,
    tx: Tx,
  ): Promise<{ newQty: number; isLowStock: boolean; isOutOfStock: boolean }> => {
    const stock = await inventoryRepository.getBranchStockItem(organizationId, menuItemId, tx);

    if (!stock) {
      // V1 safety: gracefully continue if inventory not configured for this item
      console.warn(
        `[inventory] No BranchStock row for menuItemId=${menuItemId} in org=${organizationId} — skipping deduction`,
      );
      return { newQty: 0, isLowStock: false, isOutOfStock: false };
    }

    const updated = await inventoryRepository.decrementBranchStock(
      organizationId,
      menuItemId,
      qty,
      tx,
    );

    const newQty = updated.currentQty;
    const isOutOfStock = newQty <= 0;
    const isLowStock = newQty > 0 && newQty <= stock.lowStockThreshold;

    if (isOutOfStock) {
      await inventoryRepository.setBranchMenuItemAvailability(
        organizationId,
        menuItemId,
        false,
        tx,
      );
    }

    return { newQty, isLowStock, isOutOfStock };
  },

  // ─── Stocktake ─────────────────────────────────────────────────────────────

  submitStocktake: async (
    organizationId: string,
    conductedById: string,
    data: SubmitStocktakeInput,
  ) => {
    const date = new Date(data.date);
    const session = await inventoryRepository.createStocktakeSession({
      organizationId,
      conductedById,
      date,
      entries: data.entries.map((e) => ({
        station: e.station,
        menuItemId: e.menuItemId,
        consumableId: e.consumableId,
        expectedQty: e.expectedQty,
        actualQty: e.actualQty,
        note: e.note,
      })),
    });

    // Fire-and-forget variance alert — must not delay HTTP response
    void (async () => {
      try {
        const THRESHOLD = 0.1;
        const highVarianceItems = session.entries
          .filter((e) => e.menuItemId && Number(e.expectedQty) > 0)
          .filter((e) => Math.abs(Number(e.variance)) / Number(e.expectedQty) > THRESHOLD)
          .map((e) => ({
            name: e.menuItem?.name ?? 'Unknown',
            variance: Number(e.variance),
            expectedQty: Number(e.expectedQty),
          }));

        if (highVarianceItems.length === 0) return;

        const directors = await inventoryRepository.getUsersByRole('DIRECTOR');
        const io = getSocketServer();

        for (const director of directors) {
          io.to(userRoomName(director.id)).emit('inventory:stocktake_variance', {
            organizationId,
            sessionId: session.id,
            highVarianceItems,
          });
          if (director.fcmToken) {
            await fcmService.sendGenericPush(director.fcmToken, {
              title: 'Stocktake Variance Alert',
              body: `${highVarianceItems.length} item(s) with >10% variance detected`,
            });
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Stocktake variance alert failed — non-fatal');
      }
    })();

    return session;
  },

  getStocktakes: (organizationId: string, filters?: { from?: string; to?: string }) => {
    return inventoryRepository.getStocktakeSessions(organizationId, {
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
    });
  },

  submitCentralStocktake: async (
    conductedById: string,
    data: SubmitCentralStocktakeInput,
  ) => {
    const date = new Date(data.date);
    return prisma.$transaction(async (tx) => {
      const results = await Promise.all(
        data.entries.map(async (entry) => {
          const ingredient = await tx.rawIngredient.findUniqueOrThrow({
            where: { id: entry.ingredientId },
            select: { id: true, name: true, currentStockCk: true, unit: true },
          });
          const variance = entry.actualQty - Number(ingredient.currentStockCk);
          // Persist the corrected stock level to RawIngredient
          await inventoryRepository.updateIngredientStock(entry.ingredientId, entry.actualQty, tx);
          return { ingredient, actualQty: entry.actualQty, variance };
        }),
      );
      return { date: data.date, conductedById, entries: results };
    });
  },

  getCentralStocktakes: () => {
    return inventoryRepository.getCentralStocktakeSessions();
  },

  // ─── Overview & Reports ───────────────────────────────────────────────────

  getInventoryOverview: async () => {
    const [branches, todayRequisitions, ingredients] = await Promise.all([
      inventoryRepository.getActiveOrganizations(),
      inventoryRepository.getTodayRequisitionsForAllBranches(),
      inventoryRepository.getIngredients(),
    ]);

    const branchSummaries = branches.map((branch) => {
      const branchReqs = todayRequisitions.filter((r) => r.organizationId === branch.id);
      const discrepancyCount = branchReqs.reduce(
        (sum, req) => sum + req.items.filter((i) => i.hasDiscrepancy).length,
        0,
      );
      return {
        branch,
        requisitionCount: branchReqs.length,
        statuses: branchReqs.map((r) => r.status),
        discrepancyCount,
      };
    });

    const belowThreshold = ingredients.filter(
      (i) => Number(i.currentStockCk) <= Number(i.reorderThreshold),
    );

    return { branches: branchSummaries, ingredients, belowThreshold };
  },

  getShrinkageReport: (filters: InventoryReportQueryInput) => {
    return inventoryRepository.getShrinkageEntries({
      branchId: filters.branchId,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
  },

  getDiscrepancyReport: (filters: InventoryReportQueryInput) => {
    return inventoryRepository.getDiscrepancies({
      branchId: filters.branchId,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
  },

  getAllStocktakeSessions: (filters?: { from?: string; to?: string }) => {
    return inventoryRepository.getAllStocktakeSessions({
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
    });
  },
};
