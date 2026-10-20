import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, subjectOf } from '../../rota/rota-http';
import { monthParams } from '../review/review-validators';
import { downloadBankFile, payoutView } from './bank-service';

const downloadBody = z.object({ idempotencyKey: z.string().trim().min(8).max(80) }).strict();

export const bankController = {
  payout: async (req: Request, res: Response): Promise<void> => ok(res, await payoutView(subjectOf(req), monthParams.parse(req.params).monthKey)),

  /** Streams the CSV. The file is never stored and never cached by a browser or a proxy. */
  download: async (req: Request, res: Response): Promise<void> => {
    const file = await downloadBankFile(subjectOf(req), monthParams.parse(req.params).monthKey, downloadBody.parse(req.body));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Bank-File-Hash', file.hash);
    res.setHeader('X-Bank-File-Version', String(file.version));
    // The app is served from another origin than the API, so the browser may read these headers only when they are exposed.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Bank-File-Hash, X-Bank-File-Version');
    res.send(file.text); // no byte-order mark: the bytes are exactly what the hash was taken over, and banks reject a stray one
  },
};
