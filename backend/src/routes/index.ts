import { Router } from 'express';
import healthRoutes from './health-routes';
import authRoutes from './auth-routes';
import branchRoutes from './branch-routes';
import staffRoutes from './staff-routes';
import menuRoutes from './menu-routes';
import orderRoutes from './order-routes';
import prepTicketRoutes from './prep-ticket-routes';
import deliveryZoneRoutes from './delivery-zone-routes';
import shiftRoutes from './shift-routes';
import shiftAssignmentRoutes from './shift-assignment-routes';
import clockRoutes from './clock-routes';
import reportRoutes from './report-routes';
import incidentRoutes from './incident-routes';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use(authRoutes);
apiRouter.use(branchRoutes);
apiRouter.use(staffRoutes);
apiRouter.use(menuRoutes);
apiRouter.use(orderRoutes);
apiRouter.use(prepTicketRoutes);
apiRouter.use(deliveryZoneRoutes);
apiRouter.use(shiftRoutes);
apiRouter.use(shiftAssignmentRoutes);
apiRouter.use(clockRoutes);
apiRouter.use(reportRoutes);
apiRouter.use(incidentRoutes);

export default apiRouter;
