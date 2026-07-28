import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { supplierInvoiceController } from '../controllers/supplier-invoice-controller';

const supplierInvoiceRoutes = Router();

/**
 * Supplier AP — Manager-only, zero access for Attendant, not even
 * read-only (D-2, D-13, §8.3). Every route below uses managerOnly; there
 * is no "both roles" tier for this feature at all.
 */
const managerOnly = requireRole('STORE_MANAGER');

supplierInvoiceRoutes.get(
  '/supplier-invoices',
  authenticate,
  branchScope,
  managerOnly,
  supplierInvoiceController.list,
);

supplierInvoiceRoutes.get(
  '/supplier-invoices/:id',
  authenticate,
  branchScope,
  managerOnly,
  supplierInvoiceController.getById,
);

supplierInvoiceRoutes.post(
  '/supplier-invoices',
  authenticate,
  branchScope,
  managerOnly,
  supplierInvoiceController.create,
);

supplierInvoiceRoutes.post(
  '/supplier-invoices/:id/payments',
  authenticate,
  branchScope,
  managerOnly,
  supplierInvoiceController.recordPayment,
);

export default supplierInvoiceRoutes;
