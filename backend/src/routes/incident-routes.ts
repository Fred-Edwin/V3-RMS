import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { incidentController } from '../controllers/incident-controller';

const incidentRoutes = Router();

incidentRoutes.get(
  '/incidents',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  incidentController.getIncidents,
);

export default incidentRoutes;
