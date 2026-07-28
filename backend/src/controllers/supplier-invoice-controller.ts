import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { supplierInvoiceService } from '../services/supplier-invoice-service';
import {
  CreateSupplierInvoiceSchema,
  RecordSupplierPaymentSchema,
  SupplierInvoiceIdParamSchema,
  SupplierInvoiceListQuerySchema,
} from '../validators/supplier-invoice-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const supplierInvoiceController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { supplierId, status } = SupplierInvoiceListQuerySchema.parse(req.query);
    const invoices = await supplierInvoiceService.list(actor, { supplierId, status });
    res.status(200).json({ success: true, data: invoices });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierInvoiceIdParamSchema.parse(req.params);
    const invoice = await supplierInvoiceService.getById(actor, id);
    res.status(200).json({ success: true, data: invoice });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateSupplierInvoiceSchema.parse(req.body);
    const invoice = await supplierInvoiceService.create(actor, data);
    res.status(201).json({ success: true, data: invoice, message: 'Supplier invoice recorded successfully' });
  },

  recordPayment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierInvoiceIdParamSchema.parse(req.params);
    const data = RecordSupplierPaymentSchema.parse(req.body);
    const invoice = await supplierInvoiceService.recordPayment(actor, id, data);
    res.status(201).json({ success: true, data: invoice, message: 'Supplier payment recorded successfully' });
  },
};
