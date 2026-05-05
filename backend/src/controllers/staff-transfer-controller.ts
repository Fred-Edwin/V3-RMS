import type { Request, Response } from 'express';
import { staffTransferService } from '../services/staff-transfer-service';
import { createTransferSchema, transferUserIdParamSchema } from '../validators/staff-transfer-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const staffTransferController = {
  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = createTransferSchema.parse(req.body);
    const transfer = await staffTransferService.createTransfer(actor, input);
    res.status(201).json({ success: true, data: { transfer }, message: 'Staff transferred successfully' });
  },

  listByUser: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id: userId } = transferUserIdParamSchema.parse(req.params);
    const transfers = await staffTransferService.listTransfers(actor, userId);
    res.status(200).json({ success: true, data: { transfers } });
  },
};
