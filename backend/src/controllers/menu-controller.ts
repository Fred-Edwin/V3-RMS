import type { Request, Response } from 'express';
import { menuService } from '../services/menu-service';
import {
  availabilityQuerySchema,
  availabilitySchema,
  createCategorySchema,
  createItemSchema,
  menuQuerySchema,
  routeIdParamSchema,
  updateCategorySchema,
  updateItemSchema,
} from '../validators/menu-schemas';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { uploadImageBuffer } from '../utils/cloudinary';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

const parseRouteId = (req: Request): string => {
  return routeIdParamSchema.parse(req.params).id;
};

export const menuController = {
  getMenu: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = menuQuerySchema.parse(req.query);
    const menu = await menuService.getMenu(actor, query);

    res.status(200).json({
      success: true,
      data: menu,
    });
  },

  getCategories: async (_req: Request, res: Response): Promise<void> => {
    const categories = await menuService.getCategories();

    res.status(200).json({
      success: true,
      data: categories,
    });
  },

  createCategory: async (req: Request, res: Response): Promise<void> => {
    const data = createCategorySchema.parse(req.body);
    await menuService.createCategory(data);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
    });
  },

  updateCategory: async (req: Request, res: Response): Promise<void> => {
    const categoryId = parseRouteId(req);
    const data = updateCategorySchema.parse(req.body);
    await menuService.updateCategory(categoryId, data);

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
    });
  },

  deleteCategory: async (req: Request, res: Response): Promise<void> => {
    const categoryId = parseRouteId(req);
    await menuService.deleteCategory(categoryId);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  },

  createItem: async (req: Request, res: Response): Promise<void> => {
    const data = createItemSchema.parse(req.body);
    await menuService.createItem(data);

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
    });
  },

  updateItem: async (req: Request, res: Response): Promise<void> => {
    const itemId = parseRouteId(req);
    const data = updateItemSchema.parse(req.body);
    await menuService.updateItem(itemId, data);

    res.status(200).json({
      success: true,
      message: 'Menu item updated successfully',
    });
  },

  deleteItem: async (req: Request, res: Response): Promise<void> => {
    const itemId = parseRouteId(req);
    await menuService.deleteItem(itemId);

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  },

  uploadItemImage: async (req: Request, res: Response): Promise<void> => {
    requireActor(req);

    if (!req.file) {
      throw new ValidationError('No image file provided');
    }

    const imageUrl = await uploadImageBuffer(req.file.buffer, 'wendo/menu');

    res.status(200).json({
      success: true,
      data: { imageUrl },
    });
  },

  setItemAvailability: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const itemId = parseRouteId(req);
    const query = availabilityQuerySchema.parse(req.query);
    const data = availabilitySchema.parse(req.body);
    const availability = await menuService.setItemAvailability(
      itemId,
      actor,
      data.isAvailable,
      query.branchId,
    );

    res.status(200).json({
      success: true,
      data: availability,
      message: data.isAvailable
        ? 'Item restored as available at this branch'
        : 'Item marked as unavailable at this branch',
    });
  },
};
