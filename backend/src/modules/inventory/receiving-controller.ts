import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { receivingService } from './receiving-service';
import { IdParamSchema } from './inventory-validators';
import {
  CreateExpectedDeliverySchema,
  CreateGoodsReceiptSchema,
  CreateInvoiceAdjustmentSchema,
  CreateSupplierInvoiceSchema,
  CreateSupplierPaymentSchema,
  ListExpectedDeliveriesQuerySchema,
  ListGoodsReceiptsQuerySchema,
  ListSupplierApQuerySchema,
  ReceivingHistoryQuerySchema,
  RecentSupplierItemsQuerySchema,
  ReverseSupplierPaymentSchema,
  SignGoodsReceiptSchema,
  UpdateGoodsReceiptSchema,
} from './receiving-validators';
import { z } from 'zod';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const PurchasingHistoryQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  supplierId: z.string().uuid().optional(),
  status: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const receivingController = {
  // ── Purchasing hub ───────────────────────────────────────────────────────

  getPurchasingSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = await receivingService.getPurchasingSummary(actor);
    res.status(200).json({ success: true, data });
  },

  getPurchasingHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = PurchasingHistoryQuerySchema.parse(req.query);
    const data = await receivingService.getPurchasingHistory(actor, query);
    res.status(200).json({ success: true, data });
  },

  // ── Receiving history (Attendant-safe, 2026-09-18 amendment) ─────────────

  getReceivingHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ReceivingHistoryQuerySchema.parse(req.query);
    const data = await receivingService.getReceivingHistory(actor, query);
    res.status(200).json({ success: true, data });
  },

  // ── Expected deliveries ──────────────────────────────────────────────────

  listExpectedDeliveries: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListExpectedDeliveriesQuerySchema.parse(req.query);
    const data = await receivingService.listExpectedDeliveries(actor, query);
    res.status(200).json({ success: true, data });
  },

  getExpectedDelivery: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await receivingService.getExpectedDelivery(actor, id);
    res.status(200).json({ success: true, data });
  },

  createExpectedDelivery: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateExpectedDeliverySchema.parse(req.body);
    const data = await receivingService.createExpectedDelivery(actor, input);
    res.status(201).json({ success: true, data, message: 'Expected delivery created successfully' });
  },

  cancelExpectedDelivery: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await receivingService.cancelExpectedDelivery(actor, id);
    res.status(200).json({ success: true, data, message: 'Expected delivery cancelled successfully' });
  },

  // ── Items ────────────────────────────────────────────────────────────────

  getLastPrice: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await receivingService.getLastPrice(actor, id);
    res.status(200).json({ success: true, data });
  },

  // ── Suppliers ────────────────────────────────────────────────────────────

  getRecentSupplierItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const { limit } = RecentSupplierItemsQuerySchema.parse(req.query);
    const data = await receivingService.getRecentSupplierItems(actor, id, limit);
    res.status(200).json({ success: true, data });
  },

  // ── Goods receipts ───────────────────────────────────────────────────────

  listGoodsReceipts: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListGoodsReceiptsQuerySchema.parse(req.query);
    const data = await receivingService.listGoodsReceipts(actor, query);
    res.status(200).json({ success: true, data });
  },

  getGoodsReceipt: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await receivingService.getGoodsReceipt(actor, id);
    res.status(200).json({ success: true, data });
  },

  createGoodsReceipt: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateGoodsReceiptSchema.parse(req.body);
    const data = await receivingService.createGoodsReceipt(actor, input);
    res.status(201).json({ success: true, data, message: 'Goods receipt saved as draft' });
  },

  updateGoodsReceipt: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = UpdateGoodsReceiptSchema.parse(req.body);
    const data = await receivingService.updateGoodsReceipt(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Goods receipt updated' });
  },

  signGoodsReceipt: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = SignGoodsReceiptSchema.parse(req.body);
    const data = await receivingService.signGoodsReceipt(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Goods receipt signed' });
  },

  // ── What we owe (Supplier AP) — S7 ───────────────────────────────────────

  getApSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = await receivingService.getApSummary(actor);
    res.status(200).json({ success: true, data });
  },

  listSupplierAp: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListSupplierApQuerySchema.parse(req.query);
    const data = await receivingService.listSupplierAp(actor, query);
    res.status(200).json({ success: true, data });
  },

  getSupplierApDetail: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await receivingService.getSupplierApDetail(actor, id);
    res.status(200).json({ success: true, data });
  },

  createSupplierInvoice: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateSupplierInvoiceSchema.parse(req.body);
    const data = await receivingService.createSupplierInvoice(actor, input);
    res.status(201).json({ success: true, data, message: 'Supplier invoice recorded' });
  },

  createInvoiceAdjustment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = CreateInvoiceAdjustmentSchema.parse(req.body);
    const data = await receivingService.createInvoiceAdjustment(actor, id, input);
    res.status(201).json({ success: true, data, message: 'Adjustment recorded' });
  },

  createSupplierPayment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateSupplierPaymentSchema.parse(req.body);
    const data = await receivingService.createSupplierPayment(actor, input);
    res.status(201).json({ success: true, data, message: 'Payment recorded' });
  },

  reverseSupplierPayment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = ReverseSupplierPaymentSchema.parse(req.body);
    const data = await receivingService.reverseSupplierPayment(actor, id, input);
    res.status(201).json({ success: true, data, message: 'Payment reversed' });
  },
};
