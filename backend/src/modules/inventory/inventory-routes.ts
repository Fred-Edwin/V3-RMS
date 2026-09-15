import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { inventoryController } from './inventory-controller';

const router = Router();

router.use(authenticate);

router.get(
  '/inventory/central-store-location',
  requireRole('STORE_MANAGER'),
  inventoryController.getCentralStoreLocation,
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

router.get('/inventory/items', requireRole('STORE_MANAGER', 'STORE_ATTENDANT'), inventoryController.listItems);
router.get(
  '/inventory/items/:id',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  inventoryController.getItemById,
);
router.post('/inventory/items', requireRole('STORE_MANAGER'), inventoryController.createItem);
router.patch('/inventory/items/:id', requireRole('STORE_MANAGER'), inventoryController.updateItem);
router.delete('/inventory/items/:id', requireRole('STORE_MANAGER'), inventoryController.retireItem);
router.post('/inventory/items/:id/restore', requireRole('STORE_MANAGER'), inventoryController.restoreItem);

// ── Suppliers ────────────────────────────────────────────────────────────

router.get(
  '/inventory/suppliers',
  requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'),
  inventoryController.listSuppliers,
);
router.get(
  '/inventory/suppliers/:id',
  requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'),
  inventoryController.getSupplierById,
);
router.post('/inventory/suppliers', requireRole('STORE_MANAGER'), inventoryController.createSupplier);
router.patch('/inventory/suppliers/:id', requireRole('STORE_MANAGER'), inventoryController.updateSupplier);
router.delete('/inventory/suppliers/:id', requireRole('STORE_MANAGER'), inventoryController.retireSupplier);
router.post(
  '/inventory/suppliers/:id/restore',
  requireRole('STORE_MANAGER'),
  inventoryController.restoreSupplier,
);

// ── Restock levels ───────────────────────────────────────────────────────

router.get(
  '/inventory/restock-levels',
  requireRole('STORE_MANAGER', 'DEPARTMENT_HEAD'),
  inventoryController.listRestockLevels,
);
router.put(
  '/inventory/restock-levels',
  requireRole('STORE_MANAGER', 'DEPARTMENT_HEAD'),
  inventoryController.saveRestockLevels,
);

export default router;
