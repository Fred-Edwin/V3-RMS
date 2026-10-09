import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';

/**
 * Deliveries (the branch), all under /inventory/deliveries (docs/features/inventory/dispatch-contract.md §4, V1 to V6).
 * A PLACEHOLDER until back end D fills it: it authenticates and has no endpoint yet. The old router in `dispatch/dispatch-routes.ts`
 * (paths under /deliveries) keeps running until back end C deletes it.
 *
 * Order matters when the routes land: `GET /mine` BEFORE `GET /:id/...`. Counting is the department rule in the service (an active
 * member or the head of the receiving department, `deliveries.count`, held by no role in the table), and the Branch Manager confirms
 * for any department of the branch with `deliveries.confirm_on_behalf`; never a new `requireRole` list. NOTHING on V1 to V4 carries
 * the sent figure. The photo upload is multipart (5 MB, 3 per line).
 *   V1 GET /mine   V2 GET /:id/count   V3 PUT /:id/count and POST /:id/check
 *   V4 PUT /:id/lines/:lineId/reason, POST /:id/photos and DELETE /:id/photos/:photoId (Amendment 1 row 6)
 *   V5 GET /:id/confirm-preview   V6 POST /:id/confirm
 * V2 stamps `arrivedAt` the first time anyone from the department opens the delivery (Amendment 1 row 1).
 */
const router = Router();

router.use(authenticate);

export default router;
