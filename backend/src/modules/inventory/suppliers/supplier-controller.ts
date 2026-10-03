import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { UnauthorizedError, UnprocessableEntityError } from '../../../utils/errors';
import { MAX_SUPPLIER_DOCUMENT_BYTES } from './supplier-files';
import { supplierService } from './supplier-service';
import {
  CreateContactSchema,
  CreatePayMethodSchema,
  CreateSupplierItemSchema,
  CreateSupplierSchema,
  DeleteSupplierItemQuerySchema,
  ListSuppliersQuerySchema,
  ListSupplierDocumentsQuerySchema,
  PutSupplierItemSchema,
  QuickAddSupplierSchema,
  SupplierContactParamSchema,
  SupplierDocumentParamSchema,
  SupplierIdParamSchema,
  SupplierItemParamSchema,
  SupplierPayMethodParamSchema,
  UpdateContactSchema,
  UpdatePayMethodSchema,
  UpdateSupplierSchema,
  UpdateSupplierStatusSchema,
  UploadSupplierDocumentSchema,
} from './supplier-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SUPPLIER_DOCUMENT_BYTES, files: 1 } });

/** Single `file` part in memory; multer's size error becomes the contract's 422. */
export const uploadDocumentFile: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new UnprocessableEntityError('File is larger than 10 MB', 'FILE_TOO_LARGE'));
    }
    return next(error);
  });
};

export const supplierController = {
  listSuppliers: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListSuppliersQuerySchema.parse(req.query);
    const { data, pagination } = await supplierService.listSuppliers(actor, query);
    res.status(200).json({ success: true, data, pagination });
  },

  getSupplierById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.getSupplierById(actor, id) });
  },

  createSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateSupplierSchema.parse(req.body);
    const data = await supplierService.createSupplier(actor, input);
    res.status(201).json({ success: true, data, message: 'Supplier created successfully' });
  },

  updateSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const input = UpdateSupplierSchema.parse(req.body);
    const data = await supplierService.updateSupplier(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Supplier updated successfully' });
  },

  quickAddSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = QuickAddSupplierSchema.parse(req.body);
    const data = await supplierService.quickAddSupplier(actor, input);
    res.status(201).json({ success: true, data, message: 'Supplier added successfully' });
  },

  updateStatus: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const input = UpdateSupplierStatusSchema.parse(req.body);
    const data = await supplierService.updateStatus(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Supplier status updated successfully' });
  },

  retireSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const data = await supplierService.retireSupplier(actor, id);
    res.status(200).json({ success: true, data, message: 'Supplier retired successfully' });
  },

  restoreSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const data = await supplierService.restoreSupplier(actor, id);
    res.status(200).json({ success: true, data, message: 'Supplier restored successfully' });
  },

  // ── Contacts ─────────────────────────────────────────────────────────────

  listContacts: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.listContacts(actor, id) });
  },

  createContact: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const input = CreateContactSchema.parse(req.body);
    const data = await supplierService.createContact(actor, id, input);
    res.status(201).json({ success: true, data, message: 'Contact added successfully' });
  },

  updateContact: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, cid } = SupplierContactParamSchema.parse(req.params);
    const input = UpdateContactSchema.parse(req.body);
    const data = await supplierService.updateContact(actor, id, cid, input);
    res.status(200).json({ success: true, data, message: 'Contact updated successfully' });
  },

  deleteContact: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, cid } = SupplierContactParamSchema.parse(req.params);
    await supplierService.deleteContact(actor, id, cid);
    res.status(200).json({ success: true, data: null, message: 'Contact deleted successfully' });
  },

  // ── Payment methods ──────────────────────────────────────────────────────

  listPayMethods: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.listPayMethods(actor, id) });
  },

  listPayMethodHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.listPayMethodHistory(actor, id) });
  },

  getPayMethod: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, pid } = SupplierPayMethodParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.getPayMethod(actor, id, pid) });
  },

  createPayMethod: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const input = CreatePayMethodSchema.parse(req.body);
    const data = await supplierService.createPayMethod(actor, id, input);
    res.status(201).json({ success: true, data, message: 'Payment method added successfully' });
  },

  updatePayMethod: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, pid } = SupplierPayMethodParamSchema.parse(req.params);
    const input = UpdatePayMethodSchema.parse(req.body);
    const data = await supplierService.updatePayMethod(actor, id, pid, input);
    res.status(200).json({ success: true, data, message: 'Payment method updated successfully' });
  },

  deletePayMethod: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, pid } = SupplierPayMethodParamSchema.parse(req.params);
    await supplierService.deletePayMethod(actor, id, pid);
    res.status(200).json({ success: true, data: null, message: 'Payment method deleted successfully' });
  },

  // ── Catalog ──────────────────────────────────────────────────────────────

  listItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.listItems(actor, id) });
  },

  addItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const input = CreateSupplierItemSchema.parse(req.body);
    const data = await supplierService.addItem(actor, id, input);
    res.status(201).json({ success: true, data, message: 'Catalog line added successfully' });
  },

  listPackMismatches: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.listPackMismatches(actor, id) });
  },

  putItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, itemId } = SupplierItemParamSchema.parse(req.params);
    const input = PutSupplierItemSchema.parse(req.body);
    const data = await supplierService.putItem(actor, id, itemId, input);
    res.status(200).json({ success: true, data, message: 'Catalog row saved successfully' });
  },

  deleteItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, itemId } = SupplierItemParamSchema.parse(req.params);
    const { lineId } = DeleteSupplierItemQuerySchema.parse(req.query);
    await supplierService.deleteItem(actor, id, itemId, lineId);
    res.status(200).json({ success: true, data: null, message: 'Catalog row removed successfully' });
  },

  // ── Documents ────────────────────────────────────────────────────────────

  listDocuments: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const { limit } = ListSupplierDocumentsQuerySchema.parse(req.query);
    res.status(200).json({ success: true, data: await supplierService.listDocuments(actor, id, limit) });
  },

  uploadDocument: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    const input = UploadSupplierDocumentSchema.parse(req.body);
    const data = await supplierService.uploadDocument(actor, id, req.file, input);
    res.status(201).json({ success: true, data, message: 'Document uploaded successfully' });
  },

  downloadDocument: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, docId } = SupplierDocumentParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.getDocumentDownload(actor, id, docId) });
  },

  deleteDocument: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, docId } = SupplierDocumentParamSchema.parse(req.params);
    await supplierService.deleteDocument(actor, id, docId);
    res.status(200).json({ success: true, data: null, message: 'Document deleted successfully' });
  },

  // ── Summary ──────────────────────────────────────────────────────────────

  getListSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    res.status(200).json({ success: true, data: await supplierService.getListSummary(actor) });
  },

  getCatalogSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.getCatalogSummary(actor, id) });
  },

  getSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = SupplierIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await supplierService.getSummary(actor, id) });
  },
};
