import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { locationController } from '../controllers/location-controller';

const locationRoutes = Router();

// Read-only for both Central Store roles — every inventory screen needs to
// resolve the Central Store's Location.id before it can call any other
// inventory endpoint (locationId query params / body fields).
const bothRoles = requireRole('STORE_MANAGER', 'STORE_ATTENDANT');

locationRoutes.get('/locations', authenticate, branchScope, bothRoles, locationController.list);
locationRoutes.get('/locations/:id', authenticate, branchScope, bothRoles, locationController.getById);

export default locationRoutes;
