import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { supplierService } from '../services/supplier-service';
import {
  AssignSupplierItemSchema,
  CreateSupplierSchema,
  SupplierIdParamSchema,
  SupplierItemParamSchema,
  UpdateSupplierSchema,
} from '../validators/supplier-schemas';
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
});

export const supplierController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { isActive } = listQuerySchema.parse(req.query);
    const suppliers = await supplierService.list(actor, isActive);
    res.status(200).json({ success: true, data: suppliers });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const supplier = await supplierService.getById(actor, id);
    res.status(200).json({ success: true, data: supplier });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateSupplierSchema.parse(req.body);
    const supplier = await supplierService.create(actor, data);
    res.status(201).json({ success: true, data: supplier, message: 'Supplier created successfully' });
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const data = UpdateSupplierSchema.parse(req.body);
    const supplier = await supplierService.update(actor, id, data);
    res.status(200).json({ success: true, data: supplier, message: 'Supplier updated successfully' });
  },

  deactivate: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const supplier = await supplierService.deactivate(actor, id);
    res.status(200).json({ success: true, data: supplier, message: 'Supplier deactivated successfully' });
  },

  getItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const items = await supplierService.getItemsForSupplier(actor, id);
    res.status(200).json({ success: true, data: items });
  },

  assignItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const data = AssignSupplierItemSchema.parse(req.body);
    const supplierItem = await supplierService.assignSupplierItem(actor, id, data);
    res.status(200).json({
      success: true,
      data: supplierItem,
      message: 'Supplier assigned to item successfully',
    });
  },

  removeItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, itemId } = SupplierItemParamSchema.parse(req.params);
    await supplierService.removeSupplierItem(actor, id, itemId);
    res.status(200).json({ success: true, message: 'Supplier-item assignment removed successfully' });
  },
};
