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

const refreshRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

authRoutes.post('/auth/login', loginRateLimit, authController.login);
authRoutes.post('/auth/refresh', refreshRateLimit, authController.refresh);
// Logout only needs the refresh token cookie — no access token required.
// This ensures users can log out even when their access token has expired.
authRoutes.post('/auth/logout', authController.logout);
authRoutes.patch('/auth/change-password', authenticate, branchScope, requireRole(
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'HR_MANAGER',
  'ACCOUNTANT',
  'WAITER',
  'CHEF',
  'BARISTA',
  'STEWARD',
  'HOUSEKEEPING',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
), authController.changePassword);
authRoutes.post('/auth/verify-password', loginRateLimit, authenticate, branchScope, requireRole(
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'HR_MANAGER',
  'ACCOUNTANT',
  'WAITER',
  'CHEF',
  'BARISTA',
  'STEWARD',
  'HOUSEKEEPING',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
), authController.verifyPassword);
authRoutes.post('/auth/register-device', authenticate, branchScope, requireRole(
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'MANAGER',
  'HR_MANAGER',
  'ACCOUNTANT',
  'WAITER',
  'CHEF',
  'BARISTA',
  'STEWARD',
  'HOUSEKEEPING',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
), authController.registerDevice);
// Every authenticated role may set their own PIN — no role restriction beyond
// authentication (the route always acts on req.user.id, never a target id).
authRoutes.post('/users/me/pin', authenticate, branchScope, authController.setPin);

export default authRoutes;
