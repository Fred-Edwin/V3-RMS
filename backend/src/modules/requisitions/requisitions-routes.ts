import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireDepartmentHead, requireRole } from '../../middleware/rbac';
import { requisitionsController } from './requisitions-controller';

const router = Router();

router.use(authenticate);

// ── Requisitions (Milestone Four) ───────────────────────────────────────────
// Mount order is load-bearing: `/requisitions/history` and
// `/requisitions/needs-approval` are literal paths and MUST register before
// any `/requisitions/:id` route below, or Express matches `:id` first and
// fails uuid validation with a confusing 400.
//
// Session B's manager routes use bare `requireRole('MANAGER')`, never
// `allowDepartmentHead(requireRole('MANAGER'))` (the house pattern
// elsewhere) — the latter would let a department head who is also flagged
// MANAGER-adjacent approve their own branch's requisition. A Branch Manager
// is a distinct role, not a department head with an extra flag.

router.get('/requisitions/history', requireRole('MANAGER'), requisitionsController.listHistory);
router.get('/requisitions/needs-approval', requireRole('MANAGER'), requisitionsController.listForManagerApproval);

// ── Session A (unchanged) — Department Head side ────────────────────────────
// Gated on the department-head marker, never requireRole('DEPARTMENT_HEAD')
// (a dead enum value — see the sibling fix in inventory-routes.ts).

router.post('/requisitions', requireDepartmentHead, requisitionsController.openRequisition);
router.get('/requisitions', requireDepartmentHead, requisitionsController.listRequisitions);
router.delete('/requisitions/:id', requireDepartmentHead, requisitionsController.cancelRequisition);

// ── Session B — Branch Manager approval ─────────────────────────────────────

router.get('/requisitions/:id', requireRole('MANAGER'), requisitionsController.getRequisitionForApproval);
router.post('/requisitions/:id/approve', requireRole('MANAGER'), requisitionsController.approveRequisition);
router.patch(
  '/requisitions/:id/sections/:departmentTag/approval',
  requireRole('MANAGER'),
  requisitionsController.upsertApprovalLines,
);
router.post(
  '/requisitions/:id/sections/:departmentTag/return',
  requireRole('MANAGER'),
  requisitionsController.returnSection,
);
router.post(
  '/requisitions/:id/sections/:departmentTag/nudge',
  requireRole('MANAGER'),
  requisitionsController.nudgeHead,
);

// ── Session A param routes (unchanged) — must stay LAST ─────────────────────

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
