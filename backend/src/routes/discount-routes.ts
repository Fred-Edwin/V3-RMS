import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { discountController } from '../controllers/discount-controller';

const discountRoutes = Router();

// List active discounts for the branch — waiters see active only, managers/directors see all
discountRoutes.get(
  '/discounts',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER', 'CHEF', 'BARISTA', 'ACCOUNTANT'),
  discountController.list,
);

// Create a new discount definition — director only
discountRoutes.post(
  '/discounts',
  authenticate,
  requireRole('DIRECTOR'),
  discountController.create,
);

// Update a discount — director only
discountRoutes.patch(
  '/discounts/:discountId',
  authenticate,
  requireRole('DIRECTOR'),
  discountController.update,
);

// Soft-delete (deactivate) a discount — director only
discountRoutes.delete(
  '/discounts/:discountId',
  authenticate,
  requireRole('DIRECTOR'),
  discountController.deactivate,
);

export default discountRoutes;
