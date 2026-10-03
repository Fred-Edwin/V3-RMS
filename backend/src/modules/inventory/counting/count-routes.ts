import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireRole } from '../../../middleware/rbac';
import { countController } from './count-controller';
import { thresholdsController } from './thresholds-controller';

const router = Router();

router.use(authenticate);

// ── Central Store counting (Milestone Six, Session 2) ───────────────────────
// Blind count: the attendant's routes answer only through AttendantCountView.
// Literal `/inventory/counts/today` registers before the `:id` routes.

router.get('/inventory/counts', requireRole('STORE_MANAGER'), countController.list);
router.get('/inventory/counts/today', requireRole('STORE_ATTENDANT'), countController.getToday);
router.get('/inventory/counts/:id', requireRole('STORE_MANAGER', 'STORE_ATTENDANT'), countController.getById);
router.put('/inventory/counts/:id/lines', requireRole('STORE_ATTENDANT'), countController.saveLines);
router.post('/inventory/counts/:id/submit', requireRole('STORE_ATTENDANT'), countController.submit);
router.patch('/inventory/counts/:id/lines/:lineId', requireRole('STORE_MANAGER'), countController.decideLine);
router.post('/inventory/counts/:id/return', requireRole('STORE_MANAGER'), countController.returnCount);
router.post('/inventory/counts/:id/approve', requireRole('STORE_MANAGER'), countController.approve);
router.get('/inventory/counts/:id/print', requireRole('STORE_MANAGER'), countController.print);
router.post('/inventory/spot-counts', requireRole('STORE_MANAGER'), countController.createSpotCount);

// ── Counting thresholds (plan §1.9) ─────────────────────────────────────────
// SM writes the Central Store reason threshold; the Branch Manager writes their
// own branch's (Session 3). The Director amount is API-only this milestone.
router.get('/inventory/thresholds', requireRole('STORE_MANAGER', 'MANAGER'), thresholdsController.get);
router.put('/inventory/thresholds', requireRole('STORE_MANAGER', 'MANAGER'), thresholdsController.update);
router.put('/inventory/thresholds/director', requireRole('DIRECTOR'), thresholdsController.updateDirector);

export default router;
