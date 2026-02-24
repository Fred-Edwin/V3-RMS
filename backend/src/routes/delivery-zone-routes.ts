import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { deliveryZoneController } from '../controllers/delivery-zone-controller';

const deliveryZoneRoutes = Router();

deliveryZoneRoutes.get(
  '/delivery-zones',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA', 'MANAGER', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'DIRECTOR'),
  deliveryZoneController.listZones,
);

deliveryZoneRoutes.post(
  '/delivery-zones',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  deliveryZoneController.createZone,
);

deliveryZoneRoutes.patch(
  '/delivery-zones/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  deliveryZoneController.updateZone,
);

deliveryZoneRoutes.delete(
  '/delivery-zones/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  deliveryZoneController.deleteZone,
);

export default deliveryZoneRoutes;
