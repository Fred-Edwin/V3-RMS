import { Router } from 'express';
import healthRoutes from './health-routes';
import authRoutes from './auth-routes';
import branchRoutes from './branch-routes';
import staffRoutes from './staff-routes';
import menuRoutes from './menu-routes';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use(authRoutes);
apiRouter.use(branchRoutes);
apiRouter.use(staffRoutes);
apiRouter.use(menuRoutes);

export default apiRouter;
