import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { UnauthorizedError } from '../../../utils/errors';
import { PHOTO_MAX_BYTES } from '../dispatch/_shared/dispatch-contract';
import { deliveryError } from './deliveries-errors';
import { deliveriesService } from './deliveries-service';
import {
  confirmDeliveryInputSchema,
  deliveryLineParamsSchema,
  deliveryParamsSchema,
  deliveryPhotoParamsSchema,
  listDeliveriesQuerySchema,
  photoParamsSchema,
  saveCountInputSchema,
  setReasonInputSchema,
  uploadPhotoFieldsSchema,
} from './deliveries-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PHOTO_MAX_BYTES, files: 1 } });

/** One `file` part in memory; multer's size error becomes the contract's 413 `PHOTO_TOO_LARGE`. */
export const uploadPhotoFile: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(deliveryError('PHOTO_TOO_LARGE', 'That photo is too large. The limit is 5 MB.'));
    }
    return next(error);
  });
};

export const deliveriesController = {
  list: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await deliveriesService.list(requireActor(req), listDeliveriesQuerySchema.parse(req.query)) });
  },

  /** V7: the department's own delivery file. */
  file: async (req: Request, res: Response): Promise<void> => {
    const { id } = deliveryParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await deliveriesService.file(requireActor(req), id) });
  },

  getCount: async (req: Request, res: Response): Promise<void> => {
    const { id } = deliveryParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await deliveriesService.getCount(requireActor(req), id) });
  },

  saveCount: async (req: Request, res: Response): Promise<void> => {
    const { id } = deliveryParamsSchema.parse(req.params);
    const input = saveCountInputSchema.parse(req.body);
    res.status(200).json({ success: true, data: await deliveriesService.saveCount(requireActor(req), id, input) });
  },

  check: async (req: Request, res: Response): Promise<void> => {
    const { id } = deliveryParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await deliveriesService.check(requireActor(req), id) });
  },

  setReason: async (req: Request, res: Response): Promise<void> => {
    const { id, lineId } = deliveryLineParamsSchema.parse(req.params);
    const input = setReasonInputSchema.parse(req.body);
    res.status(200).json({ success: true, data: await deliveriesService.setReason(requireActor(req), id, lineId, input) });
  },

  uploadPhoto: async (req: Request, res: Response): Promise<void> => {
    const { id } = deliveryParamsSchema.parse(req.params);
    const fields = uploadPhotoFieldsSchema.parse(req.body);
    res.status(201).json({ success: true, data: await deliveriesService.uploadPhoto(requireActor(req), id, fields, req.file) });
  },

  deletePhoto: async (req: Request, res: Response): Promise<void> => {
    const { id, photoId } = deliveryPhotoParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await deliveriesService.deletePhoto(requireActor(req), id, photoId) });
  },

  /** The bytes of one photo behind the login (the screen loads it with the caller's token). Not wrapped in the envelope. */
  readPhoto: async (req: Request, res: Response): Promise<void> => {
    const { photoId } = photoParamsSchema.parse(req.params);
    const { body, contentType } = await deliveriesService.readPhoto(requireActor(req), photoId);
    res.status(200).set({ 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' }).send(body);
  },

  confirmPreview: async (req: Request, res: Response): Promise<void> => {
    const { id } = deliveryParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await deliveriesService.confirmPreview(requireActor(req), id) });
  },

  confirm: async (req: Request, res: Response): Promise<void> => {
    const { id } = deliveryParamsSchema.parse(req.params);
    const input = confirmDeliveryInputSchema.parse(req.body);
    const data = await deliveriesService.confirm(requireActor(req), id, input);
    res.status(data.replayed ? 200 : 201).json({ success: true, data });
  },
};
