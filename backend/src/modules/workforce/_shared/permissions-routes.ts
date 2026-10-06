import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/authenticate';
import { UnauthorizedError } from '../../../utils/errors';
import { CAPABILITIES, ROLE_GRANTS, SCOPES, grantsOf, type AccessSubject, type Capability, type Scope } from './workforce-access';
import { tracksTime } from './tracks-time';

export const PermissionsQuerySchema = z.object({ asRole: z.string().optional() });

export const PermissionsMeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    role: z.string(),
    siteId: z.string().nullable(),
    isDepartmentHead: z.boolean(),
    departmentTag: z.string().nullable(),
    tracksTime: z.boolean(),
    capabilities: z.array(z.object({ capability: z.enum(CAPABILITIES), scope: z.enum(SCOPES) })),
  }),
});
export type PermissionsMe = z.infer<typeof PermissionsMeSchema>;

const router = Router();
router.use(authenticate);

/**
 * What the signed-in person may do in Workforce: the same table the route guards read, so the front end never keeps a
 * second copy. Demo only: the System Admin may preview another role's row with `?asRole=`; for anyone else it is ignored.
 */
router.get('/workforce/permissions/me', async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const { asRole } = PermissionsQuerySchema.parse(req.query);
  const preview = asRole !== undefined && req.user.role === 'SYSTEM_ADMIN' && asRole in ROLE_GRANTS ? asRole : null;
  const subject: AccessSubject = preview
    ? { id: req.user.id, role: preview as AccessSubject['role'], siteId: req.user.siteId, isDepartmentHead: false }
    : req.user;
  const clocks = await tracksTime(subject);
  const grants = grantsOf({ ...subject, tracksTime: clocks });
  const body: PermissionsMe = {
    success: true,
    data: {
      role: subject.role,
      siteId: subject.siteId,
      isDepartmentHead: subject.isDepartmentHead ?? false,
      departmentTag: subject.departmentTag ?? null,
      tracksTime: clocks,
      capabilities: (Object.entries(grants) as [Capability, Scope][]).map(([capability, scope]) => ({ capability, scope })),
    },
  };
  res.status(200).json(body);
});

export default router;
