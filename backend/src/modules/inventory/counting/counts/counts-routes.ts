import { Router } from 'express';

/**
 * Counting, `counts/`: the reads (C1 summary, C2 list, C3 flagged lines, C4 repeat shortfalls, C5 detail).
 * Placeholder landed by the orchestrator; the counting back-end session builds the routes here (docs/sessions/stock-count-waste-be-counting.md).
 * `GET /counts/:id` is registered LAST in this folder: it matches any single segment.
 */
const router = Router();

export default router;
