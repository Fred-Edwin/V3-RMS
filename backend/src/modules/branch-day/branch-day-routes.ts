import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireDepartmentHead, requireRole } from '../../middleware/rbac';
import { branchDayController } from './branch-day-controller';

const router = Router();

router.use(authenticate);

// ── Branch day close (Milestone Six, Session 3) ─────────────────────────────
// Branch Manager only; reopen is also open to the Director (API only — there is
// no Director shell yet). Literal `/branch-day/today` registers before `:id`.

router.get('/branch-day/today', requireRole('MANAGER'), branchDayController.getToday);
// Session 4 — history + the department head's next-morning opening. Literals before `:id`.
router.get('/branch-day/history', requireRole('MANAGER'), branchDayController.getHistory);
router.get('/branch-day/opening', requireDepartmentHead, branchDayController.getOpening);
router.post('/branch-day/opening/accept', requireDepartmentHead, branchDayController.acceptOpening);
router.get('/branch-day/:id', requireRole('MANAGER'), branchDayController.getDetail);
router.get('/branch-day/:id/departments/:tag', requireRole('MANAGER'), branchDayController.getDepartment);
router.put('/branch-day/:id/departments/:tag/lines', requireRole('MANAGER'), branchDayController.saveLines);
router.post('/branch-day/:id/close', requireRole('MANAGER'), branchDayController.close);
router.post('/branch-day/:id/reopen', requireRole('MANAGER', 'DIRECTOR'), branchDayController.reopen);
router.get('/branch-day/:id/document', requireRole('MANAGER'), branchDayController.getDocument);

export default router;
