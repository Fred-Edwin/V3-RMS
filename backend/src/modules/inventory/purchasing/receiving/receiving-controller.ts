import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { receivingService } from './receiving-service';
import { ReceiveSchema } from './receiving-validators';
import { z } from 'zod';

const IdParamSchema = z.object({ id: z.string().uuid() });

export const receivingController = {
  receive: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { id } = IdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await receivingService.receive(req.user, id, ReceiveSchema.parse(req.body)) });
  },
};
