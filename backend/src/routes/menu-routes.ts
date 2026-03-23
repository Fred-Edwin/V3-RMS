import { Router } from 'express';
import multer from 'multer';
import { menuController } from '../controllers/menu-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

const menuRoutes = Router();

menuRoutes.get(
  '/menu',
  authenticate,
  branchScope,
  requireRole(
    'WAITER',
    'CHEF',
    'BARISTA',
    'MANAGER',
    'DIRECTOR',
    'SYSTEM_ADMIN',
    'KITCHEN_DISPLAY',
    'BARISTA_DISPLAY',
  ),
  menuController.getMenu,
);

menuRoutes.get(
  '/menu/categories',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'STORE_MANAGER'),
  menuController.getCategories,
);

menuRoutes.post(
  '/menu/categories',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  menuController.createCategory,
);

menuRoutes.patch(
  '/menu/categories/:id',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  menuController.updateCategory,
);

menuRoutes.delete(
  '/menu/categories/:id',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  menuController.deleteCategory,
);

menuRoutes.post(
  '/menu/items/upload-image',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  upload.single('image'),
  menuController.uploadItemImage,
);

menuRoutes.post(
  '/menu/items',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  menuController.createItem,
);

menuRoutes.patch(
  '/menu/items/:id',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  menuController.updateItem,
);

menuRoutes.delete(
  '/menu/items/:id',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  menuController.deleteItem,
);

menuRoutes.patch(
  '/menu/items/:id/availability',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  menuController.setItemAvailability,
);

export default menuRoutes;
