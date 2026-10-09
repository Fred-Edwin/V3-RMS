import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';

/**
 * The rebuilt Dispatch routes, all under /inventory/dispatch (docs/features/inventory/dispatch-contract.md §4, P1 to P9).
 * A PLACEHOLDER until back end C fills it: it authenticates and has no endpoint yet. The old Milestone Five router
 * (`dispatch-routes.ts`, paths under /dispatch, /deliveries and /discrepancies) keeps running beside it until back end C deletes it
 * in the same PR that lands P1 to P9; at that point this file takes the name `dispatch-routes.ts`.
 *
 * Order matters when the routes land: `GET /queue` and `GET /mine` BEFORE `GET /:id`. Each route gates itself with
 * `requireCapability(...)` from `_shared/central-store-access.ts` (never a new `requireRole` list); the own-branch (Branch Manager)
 * and own-history (Attendant) narrowing of `dispatch.read` is a service rule. Signing writes take their idempotency key in the body.
 *   P1 GET /queue (dispatch.pack)   P2 GET /pack/:requisitionId/departments/:departmentId (dispatch.pack)
 *   P3 PUT /pack/:requisitionId/departments/:departmentId/lines (dispatch.pack)   P4 GET /pack/:requisitionId/review (dispatch.pack)
 *   P5 POST /pack/:requisitionId/sign (dispatch.pack)   P6 GET /:id (dispatch.read)   P7 GET /:id/print?copy=store|branch (dispatch.read)
 *   P8 POST /:id/cancel (dispatch.cancel)   P9 GET /mine (dispatch.pack)
 * Carriers (P10) are in `carriers-routes.ts`, mounted at /inventory/carriers.
 */
const router = Router();

router.use(authenticate);

export default router;
