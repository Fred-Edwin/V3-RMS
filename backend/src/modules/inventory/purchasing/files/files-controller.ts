import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { UnauthorizedError } from '../../../../utils/errors';
import { MAX_SUPPLIER_DOCUMENT_BYTES } from '../../suppliers/supplier-files';
import { purchasingError } from '../_shared/purchasing-errors';
import { FileIdParamSchema } from './files-validators';
import { purchaseFileService } from './files-service';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SUPPLIER_DOCUMENT_BYTES, files: 1 } });

/** Single `file` part in memory; multer's size error becomes the contract's 422 `UPLOAD_TOO_LARGE`. */
export const uploadPurchaseFile: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(purchasingError('UPLOAD_TOO_LARGE', 'That file is too large. The limit is 10 MB.'));
    }
    return next(error);
  });
};

export const purchaseFileController = {
  upload: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(201).json({ success: true, data: await purchaseFileService.upload(actor, req.file) });
  },

  download: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = FileIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await purchaseFileService.getDownload(actor, id) });
  },
};
