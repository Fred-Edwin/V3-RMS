import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { payablesService } from './payables-service';
import { DepositSchema, DocumentSchema, IdParamSchema, InvoiceSchema, PaymentSchema, ReverseSchema, SettleSchema, VoidSchema } from './payables-validators';

const actorOf = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};
const idOf = (req: Request): string => IdParamSchema.parse(req.params).id;

export const payablesController = {
  recordDeposit: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ success: true, data: (await payablesService.recordDeposit(actorOf(req), idOf(req), DepositSchema.parse(req.body))).payment });
  },
  addInvoice: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ success: true, data: await payablesService.addInvoice(actorOf(req), idOf(req), InvoiceSchema.parse(req.body)) });
  },
  addDocument: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ success: true, data: await payablesService.addDocument(actorOf(req), idOf(req), DocumentSchema.parse(req.body)) });
  },
  settleDispute: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await payablesService.settleDispute(actorOf(req), idOf(req), SettleSchema.parse(req.body)) });
  },
  voidInvoice: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await payablesService.voidInvoice(actorOf(req), idOf(req), VoidSchema.parse(req.body)) });
  },
  recordPayment: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ success: true, data: await payablesService.recordPayment(actorOf(req), idOf(req), PaymentSchema.parse(req.body)) });
  },
  reversePayment: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ success: true, data: await payablesService.reversePayment(actorOf(req), idOf(req), ReverseSchema.parse(req.body)) });
  },
  getAdvice: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await payablesService.getAdvice(actorOf(req), idOf(req)) });
  },
};
