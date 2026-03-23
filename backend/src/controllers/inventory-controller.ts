import type { Request, Response } from 'express';
import { inventoryService } from '../services/inventory-service';
import { inventoryRepository } from '../repositories/inventory-repository';
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  CreateIngredientSchema,
  UpdateIngredientSchema,
  CreateIngredientConversionSchema,
  LogDeliverySchema,
  CreateRequisitionSchema,
  DispatchRequisitionSchema,
  ReceiveRequisitionSchema,
  SubmitStocktakeSchema,
  SubmitCentralStocktakeSchema,
  InventoryReportQuerySchema,
  AllStocktakeQuerySchema,
} from '../validators/inventory-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new Error('Actor missing from request');
  }
  return req.user;
};

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const inventoryController = {
  getSuppliers: async (_req: Request, res: Response): Promise<void> => {
    const suppliers = await inventoryService.getSuppliers();
    res.json({ success: true, data: suppliers });
  },

  createSupplier: async (req: Request, res: Response): Promise<void> => {
    const data = CreateSupplierSchema.parse(req.body);
    const supplier = await inventoryService.createSupplier(data);
    res.status(201).json({ success: true, data: supplier, message: `Supplier ${supplier.name} added` });
  },

  updateSupplier: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const data = UpdateSupplierSchema.parse(req.body);
    const supplier = await inventoryService.updateSupplier(id, data);
    res.json({ success: true, data: supplier, message: 'Supplier updated' });
  },

  // ─── Raw Ingredients ────────────────────────────────────────────────────────

  getIngredients: async (_req: Request, res: Response): Promise<void> => {
    const ingredients = await inventoryService.getIngredients();
    res.json({ success: true, data: ingredients });
  },

  createIngredient: async (req: Request, res: Response): Promise<void> => {
    const data = CreateIngredientSchema.parse(req.body);
    const ingredient = await inventoryService.createIngredient(data);
    res.status(201).json({ success: true, data: ingredient, message: `${ingredient.name} added to ingredients` });
  },

  updateIngredient: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const data = UpdateIngredientSchema.parse(req.body);
    const ingredient = await inventoryService.updateIngredient(id, data);
    res.json({ success: true, data: ingredient, message: 'Ingredient updated' });
  },

  // ─── Ingredient Conversions ──────────────────────────────────────────────────

  getIngredientConversions: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const conversions = await inventoryService.getConversionsForIngredient(id);
    res.json({ success: true, data: conversions });
  },

  createIngredientConversion: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const data = CreateIngredientConversionSchema.parse(req.body);
    const conversion = await inventoryService.createConversion(id, data);
    res.status(201).json({ success: true, data: conversion, message: 'Conversion ratio saved' });
  },

  // ─── Supplier Deliveries ─────────────────────────────────────────────────────

  getDeliveries: async (req: Request, res: Response): Promise<void> => {
    const { ingredientId, supplierId, from, to } = req.query as Record<string, string | undefined>;
    const deliveries = await inventoryService.getDeliveries({ ingredientId, supplierId, from, to });
    res.json({ success: true, data: deliveries });
  },

  logDelivery: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = LogDeliverySchema.parse(req.body);
    const result = await inventoryService.logDelivery(data, actor.id);
    res.status(201).json({
      success: true,
      data: result,
      message: `Delivery of ${data.quantity} ${result.ingredient.unit} recorded for ${result.ingredient.name}`,
    });
  },

  // ─── Requisitions — CK view ─────────────────────────────────────────────────

  getRequisitions: async (req: Request, res: Response): Promise<void> => {
    const { status, date } = req.query as Record<string, string | undefined>;
    const requisitions = await inventoryService.getRequisitionsForCK({ status, date });
    res.json({ success: true, data: requisitions });
  },

  getRequisitionById: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const requisition = await inventoryService.getRequisitionWithCapacity(id);
    res.json({ success: true, data: requisition });
  },

  dispatchRequisition: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = req.params as { id: string };
    const data = DispatchRequisitionSchema.parse(req.body);
    const requisition = await inventoryService.dispatchRequisition(id, data, actor.id);
    res.json({ success: true, data: requisition, message: 'Requisition dispatched' });
  },

  // ─── Requisitions — Branch view ─────────────────────────────────────────────

  getRequisitionsForBranch: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const organizationId = actor.organizationId ?? '';
    const { status } = req.query as Record<string, string | undefined>;
    const requisitions = await inventoryService.getRequisitionsForBranch(organizationId, { status });
    res.json({ success: true, data: requisitions });
  },

  createRequisition: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const organizationId = actor.organizationId ?? '';
    const data = CreateRequisitionSchema.parse(req.body);
    const requisition = await inventoryService.createRequisition(organizationId, actor.id, data);
    res.status(201).json({ success: true, data: requisition, message: 'Requisition submitted' });
  },

  receiveRequisition: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = req.params as { id: string };
    const data = ReceiveRequisitionSchema.parse(req.body);
    const requisition = await inventoryService.receiveRequisition(id, data, actor.id);
    res.json({ success: true, data: requisition, message: 'Receipt confirmed' });
  },

  // ─── Branch Stock ────────────────────────────────────────────────────────────

  getBranchStock: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const organizationId = actor.organizationId ?? '';
    const stock = await inventoryRepository.getBranchStock(organizationId);
    res.json({ success: true, data: stock });
  },

  getMenuItemsWithBranchStock: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const organizationId = actor.organizationId ?? '';
    const items = await inventoryRepository.getMenuItemsWithBranchStock(organizationId);
    res.json({ success: true, data: items });
  },

  // ─── Stocktake ───────────────────────────────────────────────────────────────

  submitStocktake: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const organizationId = actor.organizationId ?? '';
    const data = SubmitStocktakeSchema.parse(req.body);
    const session = await inventoryService.submitStocktake(organizationId, actor.id, data);
    res.status(201).json({ success: true, data: session, message: `Stocktake recorded` });
  },

  getStocktakes: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const organizationId = actor.organizationId ?? '';
    const { from, to } = req.query as Record<string, string | undefined>;
    const sessions = await inventoryService.getStocktakes(organizationId, { from, to });
    res.json({ success: true, data: sessions });
  },

  submitCentralStocktake: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = SubmitCentralStocktakeSchema.parse(req.body);
    const result = await inventoryService.submitCentralStocktake(actor.id, data);
    res.status(201).json({ success: true, data: result, message: 'Central stocktake recorded' });
  },

  getCentralStocktakes: async (_req: Request, res: Response): Promise<void> => {
    const data = await inventoryService.getCentralStocktakes();
    res.json({ success: true, data });
  },

  // ─── Overview & Reports ──────────────────────────────────────────────────────

  getInventoryOverview: async (_req: Request, res: Response): Promise<void> => {
    const overview = await inventoryService.getInventoryOverview();
    res.json({ success: true, data: overview });
  },

  getShrinkageReport: async (req: Request, res: Response): Promise<void> => {
    const filters = InventoryReportQuerySchema.parse(req.query);
    const data = await inventoryService.getShrinkageReport(filters);
    res.json({ success: true, data });
  },

  getDiscrepancyReport: async (req: Request, res: Response): Promise<void> => {
    const filters = InventoryReportQuerySchema.parse(req.query);
    const data = await inventoryService.getDiscrepancyReport(filters);
    res.json({ success: true, data });
  },

  getAllStocktakeSessions: async (req: Request, res: Response): Promise<void> => {
    const { from, to } = AllStocktakeQuerySchema.parse(req.query);
    const sessions = await inventoryService.getAllStocktakeSessions({ from, to });
    res.json({ success: true, data: sessions });
  },
};

