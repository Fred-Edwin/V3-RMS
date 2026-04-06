import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { otherIncomeController } from '../controllers/other-income-controller';

const otherIncomeRoutes = Router();

// IMPORTANT: /active must be registered before /:id (literal before parameterised)

// ── Categories ────────────────────────────────────────────────────────────────

otherIncomeRoutes.get(
  '/other-income/categories/active',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'WAITER'),
  otherIncomeController.listActiveCategories,
);

otherIncomeRoutes.get(
  '/other-income/categories',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'WAITER'),
  otherIncomeController.listCategories,
);

otherIncomeRoutes.post(
  '/other-income/categories',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  otherIncomeController.createCategory,
);

otherIncomeRoutes.patch(
  '/other-income/categories/:id',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  otherIncomeController.updateCategory,
);

// ── Entries ───────────────────────────────────────────────────────────────────

// IMPORTANT: /entries must be registered before /entries/:id
otherIncomeRoutes.get(
  '/other-income/entries',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'WAITER'),
  otherIncomeController.listEntries,
);

otherIncomeRoutes.post(
  '/other-income/entries',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'WAITER'),
  otherIncomeController.createEntry,
);

otherIncomeRoutes.delete(
  '/other-income/entries/:id',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'WAITER'),
  otherIncomeController.deleteEntry,
);

export default otherIncomeRoutes;
