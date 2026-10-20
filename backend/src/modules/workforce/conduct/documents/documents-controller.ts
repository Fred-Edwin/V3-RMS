import type { Request, Response } from 'express';
import { deviceLabel, frontendOrigin, subjectOf } from '../_shared/conduct-http';
import { documentQuery, idParams, previewBody } from '../notices/notices-validators';
import { noticeDocument, previewDocument, type RenderedDocument } from './document-service';

/** A PDF answer: private (a letter about a person), never cached, `inline=1` for the phone viewer, else a download. */
function sendPdf(res: Response, doc: RenderedDocument, inline: boolean): void {
  res.status(200);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${doc.fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('ETag', `"${doc.hash}"`);
  res.send(doc.bytes);
}

export const documentsController = {
  document: async (req: Request, res: Response): Promise<void> => {
    const query = documentQuery.parse(req.query);
    const version = query.version === 'latest' ? 'latest' : Number(query.version);
    sendPdf(res, await noticeDocument(subjectOf(req), idParams.parse(req.params).id, version, frontendOrigin(), deviceLabel(req)), query.inline === '1');
  },
  preview: async (req: Request, res: Response): Promise<void> => {
    sendPdf(res, await previewDocument(subjectOf(req), previewBody.parse(req.body)), true);
  },
};
