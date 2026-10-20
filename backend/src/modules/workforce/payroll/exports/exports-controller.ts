import type { Request, Response } from 'express';
import { subjectOf } from '../../rota/rota-http';
import { monthParams } from '../review/review-validators';
import { exportMonth } from './exports-service';
import { exportBody } from './exports-validators';

export const exportsController = {
  /** Streams the file. Nothing is stored and nothing is cached by a browser or a proxy. */
  export: async (req: Request, res: Response): Promise<void> => {
    const file = await exportMonth(subjectOf(req), monthParams.parse(req.params).monthKey, exportBody.parse(req.body));
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Document-Number', file.documentNumber ?? 'draft');
    res.setHeader('X-Revision', String(file.revision));
    res.send(file.buffer);
  },
};
