import { Router } from 'express';
import healthRoutes from './health-routes';
import authRoutes from './auth-routes';
import branchRoutes from './branch-routes';
import staffRoutes from './staff-routes';
import menuRoutes from './menu-routes';
import orderRoutes from './order-routes';
import prepTicketRoutes from './prep-ticket-routes';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use(authRoutes);
apiRouter.use(branchRoutes);
apiRouter.use(staffRoutes);
apiRouter.use(menuRoutes);
apiRouter.use(orderRoutes);
apiRouter.use(prepTicketRoutes);

export default apiRouter;
