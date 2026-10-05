import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { UnauthorizedError } from '../../../utils/errors';
import { ROLE_CAPABILITIES, capabilitiesOf } from './central-store-access';

const router = Router();

router.use(authenticate);

/**
 * What the signed-in person may do in the Central Store: the same table the route guards read, so the front end never
 * keeps a second copy. A department head's restock access comes from the marker, not from the role's capabilities.
 */
router.get('/inventory/permissions/me', (req: Request, res: Response): void => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  // Demo only: the System Admin may read another role's row to preview the screens as that role. Nobody is logged in as
  // anyone; this returns the same table row and nothing else. For anyone else `asRole` is ignored.
  const asRole = typeof req.query.asRole === 'string' ? req.query.asRole : null;
  const preview = asRole !== null && req.user.role === 'SYSTEM_ADMIN' && asRole in ROLE_CAPABILITIES ? asRole : null;
  res.status(200).json({
    success: true,
    data: {
      role: preview ?? req.user.role,
      isDepartmentHead: preview ? false : (req.user.isDepartmentHead ?? false),
      capabilities: capabilitiesOf(preview ?? req.user.role),
    },
  });
});

export default router;
