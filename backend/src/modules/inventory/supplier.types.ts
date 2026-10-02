/** Suppliers expansion — types inferred from the schemas in `supplier-validators.ts`. */
import type { z } from 'zod';
import type {
  CreateContactSchema,
  CreatePayMethodSchema,
  CreateSupplierItemSchema,
  CreateSupplierSchema,
  ListSuppliersQuerySchema,
  PutSupplierItemSchema,
  QuickAddSupplierSchema,
  SupplierDetailSchema,
  SupplierSchema,
  UpdateContactSchema,
  UpdatePayMethodSchema,
  UpdateSupplierSchema,
  UpdateSupplierStatusSchema,
  UploadSupplierDocumentSchema,
} from './supplier-validators';

export type Supplier = z.infer<typeof SupplierSchema>;
export type SupplierDetail = z.infer<typeof SupplierDetailSchema>;
export type ListSuppliersQuery = z.infer<typeof ListSuppliersQuerySchema>;
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
export type QuickAddSupplierInput = z.infer<typeof QuickAddSupplierSchema>;
export type UpdateSupplierStatusInput = z.infer<typeof UpdateSupplierStatusSchema>;
export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type CreatePayMethodInput = z.infer<typeof CreatePayMethodSchema>;
export type UpdatePayMethodInput = z.infer<typeof UpdatePayMethodSchema>;
export type CreateSupplierItemInput = z.infer<typeof CreateSupplierItemSchema>;
export type PutSupplierItemInput = z.infer<typeof PutSupplierItemSchema>;
export type UploadSupplierDocumentInput = z.infer<typeof UploadSupplierDocumentSchema>;

export interface UploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}
