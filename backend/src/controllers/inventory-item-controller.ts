import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { inventoryItemService } from '../services/inventory-item-service';
import {
  CreateInventoryItemSchema,
  InventoryIdParamSchema,
  LowStockQuerySchema,
  UpdateInventoryItemSchema,
} from '../validators/inventory-item-schemas';
import { z } from 'zod';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const listQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  locationId: z.string().uuid().optional(),
});

const transactionsQuerySchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID'),
});

export const inventoryItemController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { isActive, locationId } = listQuerySchema.parse(req.query);
    const items = await inventoryItemService.list(actor, isActive, locationId);
    res.status(200).json({ success: true, data: items });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = InventoryIdParamSchema.parse(req.params);
    const item = await inventoryItemService.getById(actor, id);
    res.status(200).json({ success: true, data: item });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateInventoryItemSchema.parse(req.body);
    const item = await inventoryItemService.create(actor, data);
    res.status(201).json({ success: true, data: item, message: 'Inventory item created successfully' });
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = InventoryIdParamSchema.parse(req.params);
    const data = UpdateInventoryItemSchema.parse(req.body);
    const item = await inventoryItemService.update(actor, id, data);
    res.status(200).json({ success: true, data: item, message: 'Inventory item updated successfully' });
  },

  deactivate: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = InventoryIdParamSchema.parse(req.params);
    const item = await inventoryItemService.deactivate(actor, id);
    res.status(200).json({ success: true, data: item, message: 'Inventory item deactivated successfully' });
  },

  listLowStock: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { locationId } = LowStockQuerySchema.parse(req.query);
    const items = await inventoryItemService.listLowStock(actor, locationId);
    res.status(200).json({ success: true, data: items });
  },

  getTransactions: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = InventoryIdParamSchema.parse(req.params);
    const { locationId } = transactionsQuerySchema.parse(req.query);
    const transactions = await inventoryItemService.getTransactions(actor, id, locationId);
    res.status(200).json({ success: true, data: transactions });
  },
};
