import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { historyService } from './history-service';
import { itemIdParamSchema, ledgerQuerySchema, stockCardQuerySchema } from './history-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const historyController = {
  /** S3 */
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await historyService.list(actor, ledgerQuerySchema.parse(req.query)) });
  },

  /** S4: the CSV as a download. */
  exportCsv: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { filename, csv } = await historyService.exportCsv(actor, ledgerQuerySchema.parse(req.query));
    res.status(200).type('text/csv').set('Content-Disposition', `attachment; filename="${filename}"`).send(csv);
  },

  /** S5 */
  card: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { itemId } = itemIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await historyService.card(actor, itemId, stockCardQuerySchema.parse(req.query)) });
  },
};
