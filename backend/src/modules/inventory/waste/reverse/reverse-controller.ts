import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { reverseService } from './reverse-service';
import { reverseWasteInputSchema, wasteIdParamSchema } from './reverse-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const reverseController = {
  /** W4 */
  reverse: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = wasteIdParamSchema.parse(req.params);
    const data = await reverseService.reverse(actor, id, reverseWasteInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Waste entry reversed' });
  },
};
