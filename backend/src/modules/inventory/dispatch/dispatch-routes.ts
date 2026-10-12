import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/central-store-access';
import { dispatchController } from './dispatch-controller';

/**
 * The rebuilt Dispatch routes, all under /inventory/dispatch (docs/features/inventory/dispatch-contract.md §4, P1 to P9). Each route
 * gates itself with the access table (never a new `requireRole` list); the own-branch (Branch Manager) and own-history (Attendant)
 * narrowing of `dispatch.read` is a service rule (`dispatch-caller.ts`). Signing writes carry their idempotency key in the body.
 * `/queue`, `/mine` and `/pack/...` sit BEFORE `/:id`, and `:id` only matches a uuid, so a literal path is never taken for an id.
 *   P1 GET /queue (dispatch.pack)   P2 GET /pack/:requisitionId/departments/:departmentId (dispatch.pack)
 *   P3 PUT /pack/:requisitionId/departments/:departmentId/lines (dispatch.pack)   P4 GET /pack/:requisitionId/review (dispatch.pack)
 *   P5 POST /pack/:requisitionId/sign (dispatch.pack)   P6 GET /:id (dispatch.read)   P7 GET /:id/print?copy=store|branch (dispatch.read)
 *   P8 POST /:id/cancel (dispatch.cancel)   P9 GET /mine (dispatch.pack)
 * Carriers (P10) are in `carriers-routes.ts`, mounted at /inventory/carriers.
 */
const router = Router();

router.use(authenticate);

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
router.param('id', (_req, _res, next, value: string) => (UUID.test(value) ? next() : next('route')));

router.get('/queue', requireCapability('dispatch.pack'), dispatchController.queue); // P1
router.get('/mine', requireCapability('dispatch.pack'), dispatchController.mine); // P9
router.get('/pack/:requisitionId/review', requireCapability('dispatch.pack'), dispatchController.review); // P4
router.post('/pack/:requisitionId/sign', requireCapability('dispatch.pack'), dispatchController.sign); // P5
router.get('/pack/:requisitionId/departments/:departmentId', requireCapability('dispatch.pack'), dispatchController.getDepartment); // P2
router.put('/pack/:requisitionId/departments/:departmentId/lines', requireCapability('dispatch.pack'), dispatchController.saveLines); // P3

router.get('/:id/print', requireCapability('dispatch.read'), dispatchController.print); // P7
router.post('/:id/cancel', requireCapability('dispatch.cancel'), dispatchController.cancel); // P8
router.get('/:id', requireCapability('dispatch.read'), dispatchController.getFile); // P6

export default router;
