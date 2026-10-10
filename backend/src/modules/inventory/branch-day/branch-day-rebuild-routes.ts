import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';

/**
 * Branch day, rebuilt, all under /inventory/branch-day (docs/features/inventory/branch-day-contract.md §4, BD1 to BD21).
 * A PLACEHOLDER until the Block 4 back end fills it: it authenticates and has no endpoint yet. The old routes in `branch-day-routes.ts`
 * (`/branch-day/...`, Branch Manager only, with reopen and thresholds) keep running until this router replaces them, and that file is
 * deleted in the same commit as the old service.
 *
 * The head's own routes are the department rule in the service (an active head or member of a department of the branch;
 * `branch_day.count` is held by no role in the access table), so they carry `authenticate` only, like Deliveries and Branch waste.
 * The rest gate with `requireCapability(...)` from `_shared/central-store-access.ts` (never a new `requireRole` list); the Branch
 * Manager's own branch is a service rule. Literals sit BEFORE the `/days/:id` family, and `:id` only matches a uuid.
 *   Head (department rule; the Branch Manager on behalf with `branch_day.count_on_behalf`)
 *     BD1 GET /home   BD2 GET /opening   BD3 POST /opening/accept   BD4 POST /opening/recount/preview   BD5 POST /opening/recount
 *     BD6 GET /count   BD7 PUT /count   BD8 POST /count/sign   BD9 GET /mine/history   BD10 GET /mine/days/:id
 *   Readers (branch_day.read, branch_day.read_any_branch)
 *     BD11 GET /today   BD12 GET /days/:id/departments/:departmentId   BD13 GET /days/:id/close-summary (branch_day.close)
 *     BD15 GET /history   BD16 GET /days/:id   BD17 GET /days/:id/activity   BD18 GET /days/:id/documents   BD19 GET /days/:id/entries
 *     BD21 GET /days/:id/sheet
 *   Writes by job
 *     BD14 POST /days/:id/close (branch_day.close)   BD20 POST /days/:id/corrections (branch_day.correct)
 */
const router = Router();

router.use(authenticate);

export default router;
