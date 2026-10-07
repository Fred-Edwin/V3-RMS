import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/central-store-access';
import { allowDepartmentHead } from '../../../middleware/allow-department-head';
import { inventoryController } from './inventory-controller';
import { supplierController, uploadDocumentFile } from '../suppliers/supplier-controller';

const router = Router();

router.use(authenticate);

router.get('/inventory/central-store-location',
  requireCapability('restock.read'),
  inventoryController.getCentralStoreLocation,
);

router.get('/inventory/restock-levels/branches',
  requireCapability('restock.read'),
  inventoryController.listRestockBranches,
);

// ── Categories ─────────────────────────────────────────────────────────────

router.get('/inventory/categories',
  requireCapability('catalog.read'),
  inventoryController.listCategories,
);
router.post('/inventory/categories', requireCapability('catalog.write'), inventoryController.createCategory);
router.patch('/inventory/categories/:id', requireCapability('catalog.write'), inventoryController.renameCategory);
router.delete('/inventory/categories/:id', requireCapability('catalog.write'), inventoryController.retireCategory);
router.post('/inventory/categories/:id/restore',
  requireCapability('catalog.write'),
  inventoryController.restoreCategory,
);

// ── Items ────────────────────────────────────────────────────────────────

router.get('/inventory/items',
  allowDepartmentHead(requireCapability('catalog.read')),
  inventoryController.listItems,
);
router.get('/inventory/items/:id',
  requireCapability('catalog.read'),
  inventoryController.getItemById,
);
router.get('/inventory/items/:id/change-review',
  requireCapability('catalog.write'),
  inventoryController.getItemChangeReview,
);
// The attendant adds stocked / raw items from the phone; the service enforces which types and fields (§29.4).
router.post('/inventory/items', requireCapability('catalog.write', 'catalog.add_missing'), inventoryController.createItem);
router.get('/inventory/items/:id/history', requireCapability('catalog.read_history'), inventoryController.getItemHistory);
router.patch('/inventory/items/:id', requireCapability('catalog.write'), inventoryController.updateItem);
router.delete('/inventory/items/:id', requireCapability('catalog.write'), inventoryController.retireItem);
router.post('/inventory/items/:id/restore', requireCapability('catalog.write'), inventoryController.restoreItem);

// ── Suppliers (supplier-*.ts; plan: docs/features/inventory/suppliers-plan.md) ──

router.get('/inventory/suppliers',
  requireCapability('suppliers.read', 'suppliers.read_basic'),
  supplierController.listSuppliers,
);
// Registered before `/:id` so "quick" is never read as an id.
router.post('/inventory/suppliers/quick', requireCapability('suppliers.quick_add'), supplierController.quickAddSupplier);
router.get('/inventory/suppliers/summary', requireCapability('suppliers.read'), supplierController.getListSummary);
router.get('/inventory/suppliers/:id', requireCapability('suppliers.read'), supplierController.getSupplierById);
router.post('/inventory/suppliers', requireCapability('suppliers.write'), supplierController.createSupplier);
router.patch('/inventory/suppliers/:id', requireCapability('suppliers.write'), supplierController.updateSupplier);
router.patch('/inventory/suppliers/:id/status', requireCapability('suppliers.write'), supplierController.updateStatus);
router.get('/inventory/suppliers/:id/summary', requireCapability('suppliers.read'), supplierController.getSummary);

router.get('/inventory/suppliers/:id/contacts', requireCapability('suppliers.read'), supplierController.listContacts);
router.post('/inventory/suppliers/:id/contacts', requireCapability('suppliers.write'), supplierController.createContact);
router.patch('/inventory/suppliers/:id/contacts/:cid', requireCapability('suppliers.write'), supplierController.updateContact);
router.delete('/inventory/suppliers/:id/contacts/:cid', requireCapability('suppliers.write'), supplierController.deleteContact);

router.get('/inventory/suppliers/:id/payment-methods', requireCapability('suppliers.read_payment_details'), supplierController.listPayMethods);
router.get('/inventory/suppliers/:id/payment-methods/history', requireCapability('suppliers.read_payment_details'), supplierController.listPayMethodHistory);
router.get('/inventory/suppliers/:id/payment-methods/:pid', requireCapability('suppliers.read_payment_details'), supplierController.getPayMethod);
router.post('/inventory/suppliers/:id/payment-methods', requireCapability('suppliers.write_payment_methods'), supplierController.createPayMethod);
router.patch('/inventory/suppliers/:id/payment-methods/:pid',
  requireCapability('suppliers.write_payment_methods'),
  supplierController.updatePayMethod,
);
router.delete('/inventory/suppliers/:id/payment-methods/:pid',
  requireCapability('suppliers.write_payment_methods'),
  supplierController.deletePayMethod,
);

router.get('/inventory/suppliers/:id/items', requireCapability('suppliers.read'), supplierController.listItems);
router.post('/inventory/suppliers/:id/items', requireCapability('suppliers.write'), supplierController.addItem);
router.get('/inventory/suppliers/:id/catalog-summary', requireCapability('suppliers.read'), supplierController.getCatalogSummary);
router.get('/inventory/suppliers/:id/pack-mismatches', requireCapability('suppliers.read'), supplierController.listPackMismatches);
router.put('/inventory/suppliers/:id/items/:itemId', requireCapability('suppliers.write'), supplierController.putItem);
router.delete('/inventory/suppliers/:id/items/:itemId', requireCapability('suppliers.write'), supplierController.deleteItem);

router.get('/inventory/suppliers/:id/documents', requireCapability('suppliers.read'), supplierController.listDocuments);
router.post('/inventory/suppliers/:id/documents',
  requireCapability('suppliers.upload_documents'),
  uploadDocumentFile,
  supplierController.uploadDocument,
);
router.get('/inventory/suppliers/:id/documents/:docId/download',
  requireCapability('suppliers.read'),
  supplierController.downloadDocument,
);
router.delete('/inventory/suppliers/:id/documents/:docId', requireCapability('suppliers.write'), supplierController.deleteDocument);

// ── Restock levels ───────────────────────────────────────────────────────

// Registered before any `/:id`-style route so "summary" is never read as an id.
router.get('/inventory/restock-levels/summary',
  allowDepartmentHead(requireCapability('restock.read')),
  inventoryController.getRestockLevelsSummary,
);
router.get('/inventory/restock-levels',
  allowDepartmentHead(requireCapability('restock.read')),
  inventoryController.listRestockLevels,
);
router.put('/inventory/restock-levels',
  allowDepartmentHead(requireCapability('restock.write')),
  inventoryController.saveRestockLevels,
);
// Level history and put back (§30.5). `history` is registered with the other fixed paths, never read as an id.
router.get('/inventory/restock-levels/history',
  allowDepartmentHead(requireCapability('restock.read')),
  inventoryController.listRestockHistory,
);
router.post('/inventory/restock-levels/changes/:id/put-back',
  allowDepartmentHead(requireCapability('restock.write')),
  inventoryController.putBackRestockLevel,
);

export default router;
