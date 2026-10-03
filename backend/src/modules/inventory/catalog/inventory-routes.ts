import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireRole } from '../../../middleware/rbac';
import { allowDepartmentHead } from '../../../middleware/allow-department-head';
import { inventoryController } from './inventory-controller';
import { supplierController, uploadDocumentFile } from '../suppliers/supplier-controller';

const router = Router();

router.use(authenticate);

router.get(
  '/inventory/central-store-location',
  requireRole('STORE_MANAGER'),
  inventoryController.getCentralStoreLocation,
);

router.get(
  '/inventory/restock-levels/branches',
  requireRole('STORE_MANAGER'),
  inventoryController.listRestockBranches,
);

// ── Categories ─────────────────────────────────────────────────────────────

router.get(
  '/inventory/categories',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  inventoryController.listCategories,
);
router.post('/inventory/categories', requireRole('STORE_MANAGER'), inventoryController.createCategory);
router.patch('/inventory/categories/:id', requireRole('STORE_MANAGER'), inventoryController.renameCategory);
router.delete('/inventory/categories/:id', requireRole('STORE_MANAGER'), inventoryController.retireCategory);
router.post(
  '/inventory/categories/:id/restore',
  requireRole('STORE_MANAGER'),
  inventoryController.restoreCategory,
);

// ── Items ────────────────────────────────────────────────────────────────

router.get(
  '/inventory/items',
  allowDepartmentHead(requireRole('STORE_MANAGER', 'STORE_ATTENDANT')),
  inventoryController.listItems,
);
router.get(
  '/inventory/items/:id',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  inventoryController.getItemById,
);
router.get(
  '/inventory/items/:id/change-review',
  requireRole('STORE_MANAGER'),
  inventoryController.getItemChangeReview,
);
// The attendant adds stocked / raw items from the phone; the service enforces which types and fields (§29.4).
router.post('/inventory/items', requireRole('STORE_MANAGER', 'STORE_ATTENDANT'), inventoryController.createItem);
router.get('/inventory/items/:id/history', requireRole('STORE_MANAGER'), inventoryController.getItemHistory);
router.patch('/inventory/items/:id', requireRole('STORE_MANAGER'), inventoryController.updateItem);
router.delete('/inventory/items/:id', requireRole('STORE_MANAGER'), inventoryController.retireItem);
router.post('/inventory/items/:id/restore', requireRole('STORE_MANAGER'), inventoryController.restoreItem);

// ── Suppliers (supplier-*.ts; plan: docs/features/inventory/suppliers-plan.md) ──

const SM = 'STORE_MANAGER' as const;
const READ = ['STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'] as const;

router.get(
  '/inventory/suppliers',
  requireRole(...READ, 'STORE_ATTENDANT'),
  supplierController.listSuppliers,
);
// Registered before `/:id` so "quick" is never read as an id.
router.post('/inventory/suppliers/quick', requireRole(SM, 'STORE_ATTENDANT'), supplierController.quickAddSupplier);
router.get('/inventory/suppliers/summary', requireRole(...READ), supplierController.getListSummary);
router.get('/inventory/suppliers/:id', requireRole(...READ), supplierController.getSupplierById);
router.post('/inventory/suppliers', requireRole(SM), supplierController.createSupplier);
router.patch('/inventory/suppliers/:id', requireRole(SM), supplierController.updateSupplier);
router.patch('/inventory/suppliers/:id/status', requireRole(SM), supplierController.updateStatus);
router.get('/inventory/suppliers/:id/summary', requireRole(...READ), supplierController.getSummary);

router.get('/inventory/suppliers/:id/contacts', requireRole(...READ), supplierController.listContacts);
router.post('/inventory/suppliers/:id/contacts', requireRole(SM), supplierController.createContact);
router.patch('/inventory/suppliers/:id/contacts/:cid', requireRole(SM), supplierController.updateContact);
router.delete('/inventory/suppliers/:id/contacts/:cid', requireRole(SM), supplierController.deleteContact);

router.get('/inventory/suppliers/:id/payment-methods', requireRole(...READ), supplierController.listPayMethods);
router.get('/inventory/suppliers/:id/payment-methods/history', requireRole(...READ), supplierController.listPayMethodHistory);
router.get('/inventory/suppliers/:id/payment-methods/:pid', requireRole(...READ), supplierController.getPayMethod);
router.post('/inventory/suppliers/:id/payment-methods', requireRole(SM, 'ACCOUNTANT'), supplierController.createPayMethod);
router.patch(
  '/inventory/suppliers/:id/payment-methods/:pid',
  requireRole(SM, 'ACCOUNTANT'),
  supplierController.updatePayMethod,
);
router.delete(
  '/inventory/suppliers/:id/payment-methods/:pid',
  requireRole(SM, 'ACCOUNTANT'),
  supplierController.deletePayMethod,
);

router.get('/inventory/suppliers/:id/items', requireRole(...READ), supplierController.listItems);
router.post('/inventory/suppliers/:id/items', requireRole(SM), supplierController.addItem);
router.get('/inventory/suppliers/:id/catalog-summary', requireRole(...READ), supplierController.getCatalogSummary);
router.get('/inventory/suppliers/:id/pack-mismatches', requireRole(...READ), supplierController.listPackMismatches);
router.put('/inventory/suppliers/:id/items/:itemId', requireRole(SM), supplierController.putItem);
router.delete('/inventory/suppliers/:id/items/:itemId', requireRole(SM), supplierController.deleteItem);

router.get('/inventory/suppliers/:id/documents', requireRole(...READ), supplierController.listDocuments);
router.post(
  '/inventory/suppliers/:id/documents',
  requireRole(SM, 'ACCOUNTANT'),
  uploadDocumentFile,
  supplierController.uploadDocument,
);
router.get(
  '/inventory/suppliers/:id/documents/:docId/download',
  requireRole(...READ),
  supplierController.downloadDocument,
);
router.delete('/inventory/suppliers/:id/documents/:docId', requireRole(SM), supplierController.deleteDocument);

// ── Restock levels ───────────────────────────────────────────────────────

// Registered before any `/:id`-style route so "summary" is never read as an id.
router.get(
  '/inventory/restock-levels/summary',
  allowDepartmentHead(requireRole('STORE_MANAGER')),
  inventoryController.getRestockLevelsSummary,
);
router.get(
  '/inventory/restock-levels',
  allowDepartmentHead(requireRole('STORE_MANAGER')),
  inventoryController.listRestockLevels,
);
router.put(
  '/inventory/restock-levels',
  allowDepartmentHead(requireRole('STORE_MANAGER')),
  inventoryController.saveRestockLevels,
);
// Level history and put back (§30.5). `history` is registered with the other fixed paths, never read as an id.
router.get(
  '/inventory/restock-levels/history',
  allowDepartmentHead(requireRole('STORE_MANAGER')),
  inventoryController.listRestockHistory,
);
router.post(
  '/inventory/restock-levels/changes/:id/put-back',
  allowDepartmentHead(requireRole('STORE_MANAGER')),
  inventoryController.putBackRestockLevel,
);

export default router;
