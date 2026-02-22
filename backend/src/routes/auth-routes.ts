import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const authRoutes = Router();

const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

authRoutes.post('/auth/login', loginRateLimit, authController.login);
authRoutes.post('/auth/refresh', authController.refresh);
authRoutes.post('/auth/logout', authenticate, branchScope, requireRole(
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
), authController.logout);
authRoutes.patch('/auth/change-password', authenticate, branchScope, requireRole(
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
), authController.changePassword);
authRoutes.post('/auth/register-device', authenticate, branchScope, requireRole(
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
), authController.registerDevice);

export default authRoutes;
