import { Router } from 'express';

/**
 * Counting, `review/`: the Manager's side (C27 decide lines, C28 approve preview, C29 approve with PIN) and the Director's
 * "Mark seen" (C30). Placeholder landed by the orchestrator; the counting back-end session builds the routes here
 * (docs/sessions/stock-count-waste-be-counting.md).
 */
const router = Router();

export default router;
