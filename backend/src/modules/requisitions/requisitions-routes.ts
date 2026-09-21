import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireDepartmentHead } from '../../middleware/rbac';
import { requisitionsController } from './requisitions-controller';

const router = Router();

router.use(authenticate);

// ── Requisitions (Milestone Four, Session A — Department Head side) ────────
// Every route below is gated on the department-head marker, never
// requireRole('DEPARTMENT_HEAD') (a dead enum value — see the sibling fix in
// inventory-routes.ts). POST /requisitions and GET /requisitions are
// department-head-only in Session A; MANAGER access to the same paths is
// Session B's addition, not built here.

router.post('/requisitions', requireDepartmentHead, requisitionsController.openRequisition);
router.get('/requisitions', requireDepartmentHead, requisitionsController.listRequisitions);
router.get(
  '/requisitions/:id/sections/:departmentTag',
  requireDepartmentHead,
  requisitionsController.getSection,
);
router.patch(
  '/requisitions/:id/sections/:departmentTag/lines',
  requireDepartmentHead,
  requisitionsController.upsertLines,
);
router.post(
  '/requisitions/:id/sections/:departmentTag/submit',
  requireDepartmentHead,
  requisitionsController.submitSection,
);
router.post(
  '/requisitions/:id/sections/:departmentTag/recall',
  requireDepartmentHead,
  requisitionsController.recallSection,
);

export default router;
