import { Router } from 'express';
import healthRoutes from './health-routes';
import authRoutes from './auth-routes';
import branchRoutes from './branch-routes';
import staffRoutes from './staff-routes';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use(authRoutes);
apiRouter.use(branchRoutes);
apiRouter.use(staffRoutes);

export default apiRouter;
