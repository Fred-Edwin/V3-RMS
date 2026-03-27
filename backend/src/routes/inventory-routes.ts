import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { inventoryController } from '../controllers/inventory-controller';

const router = Router();

// ─── Suppliers ────────────────────────────────────────────────────────────────
router.get('/suppliers', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.getSuppliers);
router.post('/suppliers', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.createSupplier);
router.patch('/suppliers/:id', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.updateSupplier);

// ─── Raw Ingredients ──────────────────────────────────────────────────────────
router.get('/ingredients', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.getIngredients);
router.post('/ingredients', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.createIngredient);
router.patch('/ingredients/:id', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.updateIngredient);

// Conversions — IMPORTANT: register before /:id routes on ingredients
router.get('/ingredients/:id/conversions', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.getIngredientConversions);
router.post('/ingredients/:id/conversions', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.createIngredientConversion);

// ─── Supplier Deliveries ──────────────────────────────────────────────────────
router.get('/deliveries', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.getDeliveries);
router.post('/deliveries', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.logDelivery);

// ─── Requisitions ─────────────────────────────────────────────────────────────
// IMPORTANT: /requisitions/branch MUST be registered before /requisitions/:id
// to prevent Express matching the literal "branch" as an :id param.
router.get('/requisitions/branch', authenticate, requireRole('MANAGER'), inventoryController.getRequisitionsForBranch);
router.post('/requisitions', authenticate, requireRole('MANAGER'), inventoryController.createRequisition);

router.get('/requisitions', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.getRequisitions);
router.get('/requisitions/:id', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR', 'MANAGER'), inventoryController.getRequisitionById);
router.post('/requisitions/:id/dispatch', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.dispatchRequisition);
router.post('/requisitions/:id/receive', authenticate, requireRole('MANAGER', 'WAITER'), inventoryController.receiveRequisition);

// ─── Branch Stock ─────────────────────────────────────────────────────────────
// IMPORTANT: /stock/branch/all-items must be registered before /stock/branch to avoid Express matching 'all-items' as a param
router.get('/stock/branch/all-items', authenticate, requireRole('MANAGER'), inventoryController.getMenuItemsWithBranchStock);
router.get('/stock/branch', authenticate, requireRole('MANAGER', 'WAITER', 'CHEF', 'BARISTA'), inventoryController.getBranchStock);

// ─── Stocktake ────────────────────────────────────────────────────────────────
// Branch stocktake
router.get('/stocktake', authenticate, requireRole('MANAGER'), inventoryController.getStocktakes);
router.post('/stocktake', authenticate, requireRole('MANAGER'), inventoryController.submitStocktake);

// Central Kitchen stocktake — IMPORTANT: register before any parameterised stocktake routes
router.get('/stocktake/central', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.getCentralStocktakes);
router.post('/stocktake/central', authenticate, requireRole('STORE_MANAGER', 'DIRECTOR'), inventoryController.submitCentralStocktake);

// Cross-org stocktake history for Director — IMPORTANT: literal route, register before any future /:id routes
router.get('/stocktake/all', authenticate, requireRole('DIRECTOR'), inventoryController.getAllStocktakeSessions);

// ─── Overview & Reports ───────────────────────────────────────────────────────
router.get('/overview', authenticate, requireRole('DIRECTOR', 'STORE_MANAGER'), inventoryController.getInventoryOverview);
router.get('/reports/shrinkage', authenticate, requireRole('DIRECTOR'), inventoryController.getShrinkageReport);
router.get('/reports/discrepancies', authenticate, requireRole('DIRECTOR', 'STORE_MANAGER'), inventoryController.getDiscrepancyReport);

export default router;
