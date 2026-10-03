import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { otherIncomeService } from '../services/other-income-service';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateEntrySchema,
  UpdateEntrySchema,
  ListEntriesSchema,
  OtherIncomeIdParamSchema,
} from '../validators/other-income-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

/** Extract optional organizationId from query string (used by Directors). */
const getRequestedOrgId = (req: Request): string | undefined => {
  const v = req.query.siteId;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
};

export const otherIncomeController = {
  // ── Categories ──────────────────────────────────────────────────────────────

  listCategories: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const categories = await otherIncomeService.listCategories(actor, getRequestedOrgId(req));
    res.status(200).json({ success: true, data: categories });
  },

  listActiveCategories: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const categories = await otherIncomeService.listActiveCategories(actor, getRequestedOrgId(req));
    res.status(200).json({ success: true, data: categories });
  },

  createCategory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateCategorySchema.parse(req.body);
    const category = await otherIncomeService.createCategory(actor, input, getRequestedOrgId(req));
    res.status(201).json({
      success: true,
      data: category,
      message: 'Income category created',
    });
  },

  updateCategory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = OtherIncomeIdParamSchema.parse(req.params);
    const input = UpdateCategorySchema.parse(req.body);
    const category = await otherIncomeService.updateCategory(actor, id, input, getRequestedOrgId(req));
    res.status(200).json({
      success: true,
      data: category,
      message: 'Income category updated',
    });
  },

  // ── Entries ─────────────────────────────────────────────────────────────────

  listEntries: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = ListEntriesSchema.parse(req.query);
    const result = await otherIncomeService.listEntries(actor, input);
    const totalPages = Math.ceil(result.total / input.perPage);
    res.status(200).json({
      success: true,
      data: result.entries,
      pagination: {
        total: result.total,
        page: input.page,
        perPage: input.perPage,
        totalPages,
      },
    });
  },

  createEntry: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateEntrySchema.parse(req.body);
    const entry = await otherIncomeService.createEntry(actor, input);
    res.status(201).json({
      success: true,
      data: entry,
      message: 'Income entry recorded',
    });
  },

  updateEntry: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = OtherIncomeIdParamSchema.parse(req.params);
    const input = UpdateEntrySchema.parse(req.body);
    const entry = await otherIncomeService.updateEntry(actor, id, input);
    res.status(200).json({
      success: true,
      data: entry,
      message: 'Income entry updated',
    });
  },

  deleteEntry: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = OtherIncomeIdParamSchema.parse(req.params);
    await otherIncomeService.deleteEntry(actor, id);
    res.status(200).json({ success: true, message: 'Income entry deleted' });
  },
};
