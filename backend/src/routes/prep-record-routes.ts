import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { prepRecordController } from '../controllers/prep-record-controller';

const prepRecordRoutes = Router();

const bothRoles = requireRole('STORE_MANAGER', 'STORE_ATTENDANT');
const managerOnly = requireRole('STORE_MANAGER');

// PrepRecipe routes registered first — "recipes" would otherwise be
// swallowed by the /prep-records/:id param route below.
prepRecordRoutes.get(
  '/prep-recipes',
  authenticate,
  branchScope,
  bothRoles,
  prepRecordController.listRecipes,
);

prepRecordRoutes.get(
  '/prep-recipes/:id',
  authenticate,
  branchScope,
  bothRoles,
  prepRecordController.getRecipeById,
);

prepRecordRoutes.get(
  '/prep-records/rolling-average',
  authenticate,
  branchScope,
  bothRoles,
  prepRecordController.getRollingAverage,
);

prepRecordRoutes.get(
  '/prep-records',
  authenticate,
  branchScope,
  bothRoles,
  prepRecordController.list,
);

prepRecordRoutes.get(
  '/prep-records/:id',
  authenticate,
  branchScope,
  bothRoles,
  prepRecordController.getById,
);

prepRecordRoutes.post(
  '/prep-records',
  authenticate,
  branchScope,
  bothRoles,
  prepRecordController.create,
);

/** Promote a Prep Record into a saved PrepRecipe — Manager-only (§8.3). */
prepRecordRoutes.post(
  '/prep-records/:id/promote',
  authenticate,
  branchScope,
  managerOnly,
  prepRecordController.promoteToRecipe,
);

export default prepRecordRoutes;
