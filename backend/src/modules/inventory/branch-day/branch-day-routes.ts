import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/central-store-access';
import { branchDayController } from './branch-day-controller';

/**
 * Branch day, all under /inventory/branch-day (docs/features/inventory/branch-day-contract.md §4, BD1 to BD21).
 *
 * The head's own routes are the department rule in the service (an active head or member of an active department of the branch;
 * `branch_day.count` is held by no role in the access table, and the Branch Manager counts for a department with
 * `branch_day.count_on_behalf`), so they carry `authenticate` only, like Deliveries and Branch waste. The rest gate with
 * `requireCapability(...)` from `_shared/central-store-access.ts` (never a new `requireRole` list); the Branch Manager's own branch is a
 * service rule (`NOT_YOUR_BRANCH`). Literals sit BEFORE the `/days/:id` family, and `:id` only matches a uuid.
 *   Head (department rule; the Branch Manager on behalf)
 *     BD1 GET /home   BD2 GET /opening   BD3 POST /opening/accept   BD4 POST /opening/recount/preview   BD5 POST /opening/recount
 *     BD6 GET /count   BD7 PUT /count   BD8 POST /count/sign   BD9 GET /mine/history   BD10 GET /mine/days/:id
 *   Readers (branch_day.read, branch_day.read_any_branch)
 *     BD11 GET /today   BD12 GET /days/:id/departments/:departmentId   BD15 GET /history   BD16 GET /days/:id   BD17 GET /days/:id/activity
 *     BD18 GET /days/:id/documents   BD19 GET /days/:id/entries   BD21 GET /days/:id/sheet
 *   Writes by job
 *     BD13 GET /days/:id/close-summary and BD14 POST /days/:id/close (branch_day.close)   BD20 POST /days/:id/corrections (branch_day.correct)
 */
const router = Router();

router.use(authenticate);

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
router.param('id', (_req, _res, next, value: string) => (UUID.test(value) ? next() : next('route')));

const read = requireCapability('branch_day.read', 'branch_day.read_any_branch');

// The head
router.get('/home', branchDayController.home); // BD1
router.get('/opening', branchDayController.opening); // BD2
router.post('/opening/accept', branchDayController.acceptOpening); // BD3
router.post('/opening/recount/preview', branchDayController.previewRecount); // BD4
router.post('/opening/recount', branchDayController.recountOpening); // BD5
router.get('/count', branchDayController.getCount); // BD6
router.put('/count', branchDayController.saveCount); // BD7
router.post('/count/sign', branchDayController.signCount); // BD8
router.get('/mine/history', branchDayController.myHistory); // BD9
router.get('/mine/days/:id', branchDayController.myDay); // BD10

// The Branch Manager and the readers
router.get('/today', read, branchDayController.today); // BD11
router.get('/history', read, branchDayController.history); // BD15
router.get('/days/:id', read, branchDayController.dayFile); // BD16
router.get('/days/:id/departments/:departmentId', read, branchDayController.departmentFigures); // BD12
router.get('/days/:id/close-summary', requireCapability('branch_day.close'), branchDayController.closeSummary); // BD13
router.post('/days/:id/close', requireCapability('branch_day.close'), branchDayController.closeDay); // BD14
router.get('/days/:id/activity', read, branchDayController.activity); // BD17
router.get('/days/:id/documents', read, branchDayController.documents); // BD18
router.get('/days/:id/entries', read, branchDayController.entries); // BD19
router.post('/days/:id/corrections', requireCapability('branch_day.correct'), branchDayController.correctCount); // BD20
router.get('/days/:id/sheet', read, branchDayController.sheet); // BD21

export default router;
