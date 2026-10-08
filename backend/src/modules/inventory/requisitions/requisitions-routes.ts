import { Router } from 'express';

/**
 * RETIRED. The old Milestone Four endpoints (paths under /requisitions) were deleted with the Block 1 rebuild; the new ones live in
 * `requisitions-rebuild-routes.ts`, mounted at /inventory/requisitions.
 *
 * This empty router exists ONLY because `routes/index.ts` (the orchestrator's file, not back end A's) still imports it and mounts it
 * at the root. Orchestrator: delete that import and its `apiRouter.use(requisitionsRoutes)` line, then delete this file.
 */
const router = Router();

export default router;
