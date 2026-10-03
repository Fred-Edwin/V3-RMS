import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { UnauthorizedError } from '../../../utils/errors';
import { capabilitiesOf } from './central-store-access';

const router = Router();

router.use(authenticate);

/**
 * What the signed-in person may do in the Central Store: the same table the route guards read, so the front end never
 * keeps a second copy. A department head's restock access comes from the marker, not from the role's capabilities.
 */
router.get('/inventory/permissions/me', (req: Request, res: Response): void => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  res.status(200).json({
    success: true,
    data: {
      role: req.user.role,
      isDepartmentHead: req.user.isDepartmentHead ?? false,
      capabilities: capabilitiesOf(req.user.role),
    },
  });
});

export default router;
