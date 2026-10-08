import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';

/**
 * The rebuilt Requisitions routes, all under /inventory/requisitions (docs/features/inventory/requisitions-contract.md §4).
 * A PLACEHOLDER until back end A fills it: it authenticates and has no endpoint yet. The old Milestone Four router
 * (`requisitions-routes.ts`, paths under /requisitions) keeps running beside it until back end A deletes it in the same PR
 * that lands R1 to R22; at that point this file takes the name `requisitions-routes.ts`.
 *
 * Order matters when the routes land: `GET /badges`, `GET /home` and `GET /history/mine` BEFORE `GET /:id`.
 * Each route gates itself with `requireCapability(...)` from `_shared/central-store-access.ts` or the department rule in the
 * service (never a new `requireRole` list). Signing writes read the `Idempotency-Key` header.
 *   R1 GET /   R2 GET /badges   R3 GET /:id   R4 GET /:id/activity   R5 GET /:id/documents   R6 GET /:id/print
 *   R7 GET /home   R8 GET /:id/sections/:departmentId   R9 GET /history/mine   R10 GET /:id/approve-summary
 *   R11 POST /   R12 PUT /:id/sections/:departmentId/lines   R13 POST .../send   R14 POST .../recall   R15 PUT /:id/urgent
 *   R16 PATCH /:id/lines/:lineId   R17 POST .../nudge   R18 POST .../skip   R19 POST /:id/approve   R20 POST /:id/cancel
 *   R21 POST /:id/additions   R22 POST /:id/additions/:additionId/approve
 */
const router = Router();

router.use(authenticate);

export default router;
