import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { supplierAccountService } from './supplier-account-service';
import { IdParamSchema, StatementQuerySchema } from './supplier-account-validators';

const actorOf = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const supplierAccountController = {
  getOrders: async (req: Request, res: Response): Promise<void> => {
    const { id } = IdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierAccountService.getOrders(actorOf(req), id) });
  },

  getStatement: async (req: Request, res: Response): Promise<void> => {
    const { id } = IdParamSchema.parse(req.params);
    const query = StatementQuerySchema.parse(req.query);
    if (query.format === 'csv') {
      const { fileName, csv } = await supplierAccountService.getStatementCsv(actorOf(req), id, query);
      res.status(200).type('text/csv').set('Content-Disposition', `attachment; filename="${fileName}"`).send(csv);
      return;
    }
    res.status(200).json({ success: true, data: await supplierAccountService.getStatement(actorOf(req), id, query) });
  },
};
