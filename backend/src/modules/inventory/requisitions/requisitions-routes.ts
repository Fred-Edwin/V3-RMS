import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { ForbiddenError, UnauthorizedError } from '../../../utils/errors';
import { actorCan, type Capability } from '../_shared/central-store-access';
import { requisitionsController } from './requisitions-controller';

/**
 * The rebuilt Requisitions routes, all under /inventory/requisitions (docs/features/inventory/requisitions-contract.md §4).
 * Back end A owns R3, R8, R10 and R11 to R22; back end B owns R1, R2, R4, R5, R6, R7, R9 and the branch-code correction. The literal
 * paths (`/badges`, `/home`, `/history/mine`) sit BEFORE the `/:id` routes: `:id` is a uuid pattern here, so a literal path can
 * never be taken for an id, but the order is kept anyway.
 *
 * The gate is the access table's capability OR the department rule: a head holds no row of the table (contract §3), so a signed-in
 * department head passes the gate and the service applies the real rule (their own department, their own branch). Nobody else
 * passes without a capability. The service owns every finer check.
 */
const router = Router();

router.use(authenticate);

const capabilityOrHead =
  (...capabilities: Capability[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!req.user.isDepartmentHead && !capabilities.some((c) => actorCan(req.user as NonNullable<Request['user']>, c))) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };

const capability =
  (...capabilities: Capability[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!capabilities.some((c) => actorCan(req.user as NonNullable<Request['user']>, c))) throw new ForbiddenError('You do not have permission to perform this action');
    next();
  };

// A path segment that is not a uuid is never a requisition id (`/badges`, `/home`, `/history/mine`, `/branches/...`).
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
router.param('id', (_req, _res, next, value: string) => (UUID.test(value) ? next() : next('route')));

// --- Lists, badges, home, history (literal paths first; none can be taken for an id) -----------------------------------------
router.get('/', capabilityOrHead('requisitions.read'), requisitionsController.list); // R1
router.get('/badges', capabilityOrHead('requisitions.read'), requisitionsController.badges); // R2
router.get('/home', capabilityOrHead(), requisitionsController.home); // R7 (a head)
router.get('/history/mine', capabilityOrHead(), requisitionsController.historyMine); // R9 (a head)
router.patch('/branches/:branchId/code', capability('branches.set_code'), requisitionsController.setBranchCode); // Amendment 2, System Admin only

// --- Reads ---------------------------------------------------------------------------------------------------------------
router.get(`/:id/activity`, capabilityOrHead('requisitions.read'), requisitionsController.activity); // R4
router.get(`/:id/documents`, capabilityOrHead('requisitions.read'), requisitionsController.documents); // R5
router.get(`/:id/print`, capability('requisitions.read'), requisitionsController.print); // R6
router.get(`/:id`, capabilityOrHead('requisitions.read'), requisitionsController.getFile); // R3
router.get(`/:id/sections/:departmentId`, capabilityOrHead('requisitions.read', 'requisitions.start'), requisitionsController.getSection); // R8
router.get(`/:id/approve-summary`, capability('requisitions.approve'), requisitionsController.getApproveSummary); // R10

// --- Writes ---------------------------------------------------------------------------------------------------------------
router.post('/', capabilityOrHead('requisitions.start'), requisitionsController.start); // R11
router.put(`/:id/sections/:departmentId/lines`, capabilityOrHead('requisitions.start'), requisitionsController.saveLines); // R12
router.post(`/:id/sections/:departmentId/send`, capabilityOrHead('requisitions.start'), requisitionsController.sendSection); // R13
router.post(`/:id/sections/:departmentId/recall`, capabilityOrHead(), requisitionsController.recallSection); // R14
router.put(`/:id/urgent`, capabilityOrHead('requisitions.set_urgent'), requisitionsController.setUrgent); // R15
router.patch(`/:id/lines/:lineId`, capability('requisitions.change_quantity'), requisitionsController.changeQuantity); // R16
router.post(`/:id/sections/:departmentId/nudge`, capability('requisitions.nudge'), requisitionsController.nudge); // R17
router.post(`/:id/skip`, capability('requisitions.nudge'), requisitionsController.skip); // R18 (Amendment 2: a list of departments)
router.post(`/:id/approve`, capability('requisitions.approve'), requisitionsController.approve); // R19
router.post(`/:id/cancel`, capability('requisitions.cancel'), requisitionsController.cancel); // R20
router.post(`/:id/additions`, capabilityOrHead(), requisitionsController.addAddition); // R21
router.post(`/:id/additions/:additionId/approve`, capability('requisitions.approve'), requisitionsController.approveAddition); // R22

export default router;
